import { Player, Match } from '@/lib/types/database'

// Utility function to filter players to active only and re-rank them
export function getActiveLeaderboard(players: Player[]): Player[] {
  // Filter to active players only
  const activePlayers = players.filter((player: Player) => player.is_active === true)
  
  // Sort by current rank
  const sortedActivePlayers = [...activePlayers].sort((a: Player, b: Player) => a.current_rank - b.current_rank)
  
  // Add display rank for active leaderboard (don't modify actual current_rank)
  return sortedActivePlayers.map((player: Player, index: number) => ({
    ...player,
    display_rank: index + 1  // This is just for display, current_rank stays original
  }))
}

export function normalizePlayerRanks(players: Player[]): Player[] {
  // Sort players by current rank and reassign sequential ranks starting from 1
  const sortedPlayers = [...players].sort((a: Player, b: Player) => a.current_rank - b.current_rank)
  
  return sortedPlayers.map((player: Player, index: number) => ({
    ...player,
    current_rank: index + 1
  }))
}

export async function normalizeAllPlayerRanks(supabase: any): Promise<void> {
  // Utility function to fix any existing ranking gaps in the database
  console.log('Starting rank normalization...')
  
  const { data: allPlayers, error } = await supabase
    .from('players')
    .select('*')
    .order('current_rank', { ascending: true })

  if (error || !allPlayers) {
    console.error('Failed to fetch players for normalization:', error)
    throw new Error('Failed to fetch players for normalization')
  }

  console.log(`Found ${allPlayers.length} players to normalize`)

  // Log current rank distribution
  const currentRanks = allPlayers.map((p: Player) => p.current_rank).sort((a: number, b: number) => a - b)
  console.log('Current ranks:', currentRanks)

  // Check for gaps and duplicates before normalization
  const rankCounts: { [key: number]: number } = {}
  const allRanks = new Set<number>()
  
  allPlayers.forEach((player: Player) => {
    rankCounts[player.current_rank] = (rankCounts[player.current_rank] || 0) + 1
    allRanks.add(player.current_rank)
  })
  
  // Find missing ranks
  const sortedRanks = Array.from(allRanks).sort((a: number, b: number) => a - b)
  const missingRanks: number[] = []
  
  for (let i = 1; i <= allPlayers.length; i++) {
    if (!allRanks.has(i)) {
      missingRanks.push(i)
    }
  }
  
  if (missingRanks.length > 0) {
    console.warn('Missing ranks detected:', missingRanks)
  }
  
  const duplicateRanks = Object.entries(rankCounts).filter(([rank, count]: [string, number]) => count > 1)
  if (duplicateRanks.length > 0) {
    console.warn('Duplicate ranks detected:', duplicateRanks.map(([rank, count]: [string, number]) => `Rank ${rank}: ${count} players`))
  }

  const normalizedPlayers = normalizePlayerRanks(allPlayers)
  
  // Log the normalization changes
  console.log('Normalization changes:')
  allPlayers.forEach((original: Player, index: number) => {
    const normalized = normalizedPlayers[index]
    if (original.current_rank !== normalized.current_rank) {
      console.log(`${original.name}: ${original.current_rank} → ${normalized.current_rank}`)
    }
  })

  // Update all players in the database
  let successCount = 0
  let errorCount = 0
  
  for (const player of normalizedPlayers) {
    const { error: updateError } = await supabase
      .from('players')
      .update({ current_rank: player.current_rank })
      .eq('id', player.id)

    if (updateError) {
      console.error(`Error updating rank for player ${player.name}:`, updateError)
      errorCount++
    } else {
      successCount++
    }
  }
  
  console.log(`Normalization complete: ${successCount} successful updates, ${errorCount} errors`)
}

export function updateLadderRankings(
  players: Player[],
  match: Match
): Player[] {
  // Find the players involved in the match
  const player1 = players.find((p: Player) => p.id === match.player1_id)
  const player2 = players.find((p: Player) => p.id === match.player2_id)
  
  if (!player1 || !player2) {
    throw new Error('Players not found')
  }

  // Determine winner and loser
  const winner = match.match_winner === 1 ? player1 : player2
  const loser = match.match_winner === 1 ? player2 : player1

  // Create a copy of players array to avoid mutation
  const updatedPlayers = [...players]

  // If winner has a lower rank number (higher position) than loser, move winner up
  if (winner.current_rank > loser.current_rank) {
    const winnerOldRank = winner.current_rank
    const loserRank = loser.current_rank

    // Move winner to loser's position
    winner.current_rank = loserRank

    // Move everyone between loser's position and winner's old position down one
    updatedPlayers.forEach((player: Player) => {
      if (
        player.id !== winner.id &&
        player.current_rank >= loserRank &&
        player.current_rank < winnerOldRank
      ) {
        player.current_rank += 1
      }
    })
  }

  // Sort by current rank
  return updatedPlayers.sort((a: Player, b: Player) => a.current_rank - b.current_rank)
}

export function determineMatchWinner(match: Omit<Match, 'match_winner'>): 1 | 2 {
  let player1Sets = 0
  let player2Sets = 0

  // Count sets won
  if (match.set1_winner === 1) player1Sets++
  else player2Sets++

  if (match.set2_winner === 1) player1Sets++
  else player2Sets++

  // If tied 1-1, check tiebreaker
  if (player1Sets === player2Sets) {
    if (match.tiebreaker_winner) {
      return match.tiebreaker_winner
    }
    // If no tiebreaker, determine by games won in sets
    const player1Games = match.set1_p1_games + match.set2_p1_games
    const player2Games = match.set1_p2_games + match.set2_p2_games
    return player1Games > player2Games ? 1 : 2
  }

  return player1Sets > player2Sets ? 1 : 2
}

export async function recordRankAdjustment(
  supabase: any,
  playerId: string,
  oldRank: number,
  newRank: number,
  reason?: string
): Promise<void> {
  const { error } = await supabase
    .from('rank_adjustments')
    .insert({
      player_id: playerId,
      old_rank: oldRank,
      new_rank: newRank,
      reason: reason || 'Manual adjustment by admin'
    })

  if (error) {
    console.error('Error recording rank adjustment:', error)
    throw error
  }
}

export async function getEffectiveBaselineRanks(
  supabase: any,
  players: Player[]
): Promise<Player[]> {
  // Get all manual rank adjustments
  const { data: adjustments, error } = await supabase
    .from('rank_adjustments')
    .select('*')
    .order('adjusted_at', { ascending: false })

  if (error) {
    console.error('Error fetching rank adjustments:', error)
    // Fall back to natural order if we can't get adjustments
    return players.sort((a: Player, b: Player) => 
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    ).map((player: Player, index: number) => ({
      ...player,
      current_rank: index + 1
    }))
  }

  // Start with natural order (by creation date)
  const naturalOrder = [...players].sort((a: Player, b: Player) => 
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  ).map((player: Player, index: number) => ({
    ...player,
    current_rank: index + 1
  }))

  // If no adjustments, return natural order
  if (!adjustments || adjustments.length === 0) {
    console.log('No manual rank adjustments found, using natural order')
    return naturalOrder
  }

  console.log(`Found ${adjustments.length} manual rank adjustments`)

  // Get the most recent adjustment for each player
  const playerAdjustments = new Map<string, any>()
  for (const adjustment of adjustments) {
    if (!playerAdjustments.has(adjustment.player_id)) {
      playerAdjustments.set(adjustment.player_id, adjustment)
    }
  }

  // Apply adjustments and handle rank conflicts
  const adjustedPlayers = naturalOrder.map((player: Player) => {
    const adjustment = playerAdjustments.get(player.id)
    if (adjustment) {
      console.log(`${player.name}: natural rank ${player.current_rank} → adjusted to ${adjustment.new_rank}`)
      return {
        ...player,
        current_rank: adjustment.new_rank
      }
    }
    return player
  })

  // Resolve rank conflicts by ensuring only one player per rank
  const rankMap = new Map<number, Player>()
  const unassignedPlayers: Player[] = []
  
  // First pass: assign players to their desired ranks, handling conflicts
  for (const player of adjustedPlayers) {
    if (rankMap.has(player.current_rank)) {
      // Rank conflict - this player gets bumped down
      console.log(`Rank conflict at ${player.current_rank}: ${player.name} conflicts with ${rankMap.get(player.current_rank)?.name}`)
      unassignedPlayers.push(player)
    } else {
      rankMap.set(player.current_rank, player)
    }
  }
  
  // Second pass: assign unassigned players to available ranks
  let nextAvailableRank = 1
  for (const player of unassignedPlayers) {
    // Find the next available rank
    while (rankMap.has(nextAvailableRank)) {
      nextAvailableRank++
    }
    
    console.log(`Assigning ${player.name} to available rank ${nextAvailableRank}`)
    player.current_rank = nextAvailableRank
    rankMap.set(nextAvailableRank, player)
    nextAvailableRank++
  }
  
  // Convert map back to array and sort
  const baselinePlayers = Array.from(rankMap.values()).sort((a: Player, b: Player) => a.current_rank - b.current_rank)
  
  console.log('Final baseline ranks (with manual adjustments and conflict resolution):', 
    baselinePlayers.map((p: Player) => `${p.name}: ${p.current_rank}`)
  )
  
  return baselinePlayers
}

export async function clearOldRankAdjustments(
  supabase: any,
  daysOld: number = 30
): Promise<void> {
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - daysOld)
  
  const { error } = await supabase
    .from('rank_adjustments')
    .delete()
    .lt('adjusted_at', cutoffDate.toISOString())

  if (error) {
    console.error('Error clearing old rank adjustments:', error)
    throw error
  }
  
  console.log(`Cleared rank adjustments older than ${daysOld} days`)
}

export async function cleanupDeletedPlayerRecords(
  supabase: any,
  playerId: string
): Promise<void> {
  console.log(`Cleaning up records for deleted player ${playerId}...`)
  
  try {
    // Delete all rank adjustments for this player
    const { error: adjError } = await supabase
      .from('rank_adjustments')
      .delete()
      .eq('player_id', playerId)
    
    if (adjError) {
      console.error('Error deleting rank adjustments:', adjError)
    } else {
      console.log('Deleted rank adjustments for deleted player')
    }

    // Delete all matches involving this player
    const { error: matchError } = await supabase
      .from('matches')
      .delete()
      .or(`player1_id.eq.${playerId},player2_id.eq.${playerId}`)
    
    if (matchError) {
      console.error('Error deleting matches:', matchError)
    } else {
      console.log('Deleted matches for deleted player')
    }

    console.log('Cleanup completed for deleted player')
    
  } catch (error) {
    console.error('Error during player cleanup:', error)
    throw error
  }
}



export async function getRankAdjustmentsSummary(supabase: any): Promise<any[]> {
  const { data, error } = await supabase
    .from('rank_adjustments')
    .select(`
      *,
      players(name)
    `)
    .order('adjusted_at', { ascending: false })

  if (error) {
    console.error('Error fetching rank adjustments summary:', error)
    return []
  }

  return data || []
}

export async function getAllRankingChanges(supabase: any): Promise<any[]> {
  console.log('Fetching all ranking changes in chronological order...')
  
  try {
    // Get all rank adjustments with player names
    const { data: adjustments, error: adjError } = await supabase
      .from('rank_adjustments')
      .select(`
        *,
        players(name, is_active)
      `)
      .order('adjusted_at', { ascending: true })

    if (adjError) {
      console.error('Error fetching rank adjustments:', adjError)
      throw adjError
    }

    // Filter rank adjustments to only include those for active players
    const activeAdjustments = adjustments?.filter((adj: any) => 
      adj.players?.is_active === true
    ) || []

    // Get all matches with player names
    const { data: matches, error: matchError } = await supabase
      .from('matches')
      .select(`
        *,
        player1:players!matches_player1_id_fkey(name, is_active),
        player2:players!matches_player2_id_fkey(name, is_active)
      `)
      .order('created_at', { ascending: true })

    if (matchError) {
      console.error('Error fetching matches:', matchError)
      throw matchError
    }

    // Filter matches to only include those with active players
    const activeMatches = matches?.filter((match: any) => 
      match.player1?.is_active === true && match.player2?.is_active === true
    ) || []

    // Combine and sort all changes by timestamp
    const allChanges: any[] = []

    // Add rank adjustments with type identifier
    if (activeAdjustments) {
      activeAdjustments.forEach((adj: any) => {
        allChanges.push({
          ...adj,
          change_type: 'rank_adjustment',
          timestamp: adj.adjusted_at,
          player1_id: adj.player_id,
          player2_id: null,
          match_winner: null
        })
      })
    }

    // Add matches with type identifier and calculate rank changes
    if (activeMatches) {
      activeMatches.forEach((match: any) => {
        // Calculate the rank changes that occurred due to this match
        const rankChanges = calculateMatchRankChanges(match)
        
        allChanges.push({
          ...match,
          change_type: 'match',
          timestamp: match.created_at,
          player_id: null,
          old_rank: null,
          new_rank: null,
          rank_changes: rankChanges
        })
      })
    }

    // Sort by timestamp (chronological order)
    allChanges.sort((a: any, b: any) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())

    console.log(`Found ${allChanges.length} total changes: ${activeAdjustments?.length || 0} rank adjustments, ${activeMatches?.length || 0} matches`)
    
    // Log the timeline for debugging
    allChanges.forEach((change: any, index: number) => {
      if (change.change_type === 'rank_adjustment') {
        console.log(`${index + 1}. [${change.timestamp}] RANK ADJUSTMENT: Player ${change.player_id} ${change.old_rank} → ${change.new_rank}`)
      } else {
        const rankChangeText = change.rank_changes?.length > 0 
          ? ` (Rank changes: ${change.rank_changes.map((rc: any) => `${rc.player_name} ${rc.old_rank}→${rc.new_rank}`).join(', ')})`
          : ' (No rank changes)'
        console.log(`${index + 1}. [${change.timestamp}] MATCH: ${change.player1_id} vs ${change.player2_id} (Winner: ${change.match_winner})${rankChangeText}`)
      }
    })

    return allChanges

  } catch (error) {
    console.error('Error fetching all ranking changes:', error)
    throw error
  }
}

// Helper function to calculate rank changes for a match
function calculateMatchRankChanges(match: any): any[] {
  const rankChanges: any[] = []
  
  // Determine winner and loser based on match_winner
  const winner = match.match_winner === 1 ? match.player1 : match.player2
  const loser = match.match_winner === 1 ? match.player2 : match.player1
  
  // For now, we'll return a simplified structure
  // In a real implementation, you might want to store the actual ranks at the time of the match
  if (winner && loser) {
    rankChanges.push({
      player_id: match.match_winner === 1 ? match.player1_id : match.player2_id,
      player_name: winner.name,
      old_rank: '?', // We don't have historical ranks stored
      new_rank: '?',
      change_type: 'winner_moved_up'
    })
    
    rankChanges.push({
      player_id: match.match_winner === 1 ? match.player2_id : match.player1_id,
      player_name: loser.name,
      old_rank: '?',
      new_rank: '?',
      change_type: 'loser_moved_down'
    })
  }
  
  return rankChanges
}

export async function rebuildRankingsFromTimeline(supabase: any): Promise<{
  success: boolean
  updatedPlayers: any[]
  errorCount: number
  successCount: number
}> {
  console.log('Rebuilding rankings from unified timeline...')
  
  try {
    // Get all players in natural order (both active and inactive)
    const { data: allPlayers, error: playersError } = await supabase
      .from('players')
      .select('*')
      .order('created_at', { ascending: true })

    if (playersError || !allPlayers) {
      throw new Error('Failed to fetch players')
    }

    // Start with natural order (by creation date)
    let currentPlayers = allPlayers.map((player: Player, index: number) => ({
      ...player,
      current_rank: index + 1
    }))

    console.log('Starting with natural order:', currentPlayers.map((p: Player) => `${p.name}: ${p.current_rank}`))

    // Get all changes in chronological order
    const allChanges = await getAllRankingChanges(supabase)

    // Apply each change in order
    for (const change of allChanges) {
      if (change.change_type === 'rank_adjustment') {
        // Apply rank adjustment
        const player = currentPlayers.find((p: Player) => p.id === change.player_id)
        if (player) {
          console.log(`Applying rank adjustment: ${player.name} ${player.current_rank} → ${change.new_rank}`)
          
          // Find the player currently at the target rank
          const playerAtTargetRank = currentPlayers.find((p: Player) => p.current_rank === change.new_rank)
          
          if (playerAtTargetRank && playerAtTargetRank.id !== player.id) {
            // Someone else is at this rank - they get bumped down
            console.log(`Bumping ${playerAtTargetRank.name} down from rank ${change.new_rank}`)
            
            // Shift all players between the target rank and player's current rank
            currentPlayers.forEach((p: Player) => {
              if (p.id !== player.id && 
                  p.current_rank >= change.new_rank && 
                  p.current_rank < player.current_rank) {
                p.current_rank += 1
              }
            })
          }
          
          // Update the player's rank
          player.current_rank = change.new_rank
          
          // Re-sort to maintain order
          currentPlayers.sort((a: Player, b: Player) => a.current_rank - b.current_rank)
          
          console.log('After adjustment:', currentPlayers.map((p: Player) => `${p.name}: ${p.current_rank}`))
        }
      } else if (change.change_type === 'match') {
        // Apply match result
        console.log(`Applying match: ${change.player1_id} vs ${change.player2_id}`)
        currentPlayers = updateLadderRankings(currentPlayers, change)
        console.log('After match:', currentPlayers.map((p: Player) => `${p.name}: ${p.current_rank}`))
      }
    }

    // Update all players in the database with final ranks
    let successCount = 0
    let errorCount = 0

    for (const player of currentPlayers) {
      const { error: updateError } = await supabase
        .from('players')
        .update({ current_rank: player.current_rank })
        .eq('id', player.id)

      if (updateError) {
        console.error(`Error updating player ${player.name}:`, updateError)
        errorCount++
      } else {
        successCount++
      }
    }

    console.log(`Timeline rebuild complete: ${successCount} successful updates, ${errorCount} errors`)
    
    return {
      success: errorCount === 0,
      updatedPlayers: allPlayers,
      errorCount,
      successCount
    }
    
  } catch (error) {
    console.error('Error rebuilding rankings from timeline:', error)
    throw error
  }
}