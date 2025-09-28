import { Player, Match, RankingEvent } from '@/lib/types/database'

// Simple event-sourced ranking system
export async function recordMatchEvent(
  supabase: any,
  match: Match
): Promise<void> {
  console.log('Recording match event for match:', match.id)
  console.log('Match ID type:', typeof match.id)
  console.log('Match ID value:', JSON.stringify(match.id))
  
  if (!match.id || match.id === '') {
    throw new Error('Match ID is required but was empty or null')
  }
  
  // Get current players to calculate rank changes
  const { data: currentPlayers, error: playersError } = await supabase
    .from('players')
    .select('*')
    .order('current_rank', { ascending: true })

  if (playersError || !currentPlayers) {
    throw new Error('Failed to fetch players for rank calculation')
  }

  console.log('Current players before match:', currentPlayers.map((p: Player) => `${p.name}: ${p.current_rank}`))

  // Apply poison ladder logic to see what changes will happen
  const updatedPlayers = applyPoisonLadderLogic(currentPlayers, match)
  
  console.log('Players after match:', updatedPlayers.map((p: Player) => `${p.name}: ${p.current_rank}`))
  
  // Find the players involved in the match
  const player1 = currentPlayers.find((p: Player) => p.id === match.player1_id)
  const player2 = currentPlayers.find((p: Player) => p.id === match.player2_id)
  
  if (!player1 || !player2) {
    throw new Error('Players not found for rank calculation')
  }

  // Determine winner and loser
  const winner = match.match_winner === 1 ? player1 : player2
  const loser = match.match_winner === 1 ? player2 : player1

  // Find the updated ranks
  const winnerUpdated = updatedPlayers.find((p: Player) => p.id === winner.id)!
  const loserUpdated = updatedPlayers.find((p: Player) => p.id === loser.id)!

  console.log(`Winner: ${winner.name} (${winner.current_rank} → ${winnerUpdated.current_rank})`)
  console.log(`Loser: ${loser.name} (${loser.current_rank} → ${loserUpdated.current_rank})`)

  // Record the match event with actual rank changes
  // Use the match's created_at as the event_date for proper chronological ordering
  const eventData = {
    event_type: 'match',
    event_date: match.created_at, // Use created_at for proper chronological ordering
    match_id: match.id,
    player_id: winner.id, // Store the winner's ID as the primary player affected
    old_rank: winner.current_rank,
    new_rank: winnerUpdated.current_rank,
    reason: `Match: ${player1.name} vs ${player2.name}, Winner: ${winner.name} (${winner.current_rank} → ${winnerUpdated.current_rank})`
  }

  console.log('Inserting ranking event:', eventData)

  const { error } = await supabase
    .from('ranking_events')
    .insert(eventData)

  if (error) {
    console.error('Error recording match event:', error)
    throw error
  }

  console.log('Successfully recorded match event')
}

export async function updateMatchEvent(
  supabase: any,
  match: Match
): Promise<void> {
  console.log('=== updateMatchEvent called ===')
  console.log('Match ID:', match.id)
  
  // Get current players to calculate new rank changes
  const { data: currentPlayers, error: playersError } = await supabase
    .from('players')
    .select('*')
    .order('current_rank', { ascending: true })

  if (playersError || !currentPlayers) {
    throw new Error('Failed to fetch players for rank calculation')
  }

  console.log('Current players before match update:', currentPlayers.map((p: Player) => `${p.name}: ${p.current_rank}`))

  // Apply poison ladder logic to see what changes will happen
  const updatedPlayers = applyPoisonLadderLogic(currentPlayers, match)
  
  console.log('Players after match update:', updatedPlayers.map((p: Player) => `${p.name}: ${p.current_rank}`))
  
  // Find the players involved in the match
  const player1 = currentPlayers.find((p: Player) => p.id === match.player1_id)
  const player2 = currentPlayers.find((p: Player) => p.id === match.player2_id)
  
  if (!player1 || !player2) {
    throw new Error('Players not found for rank calculation')
  }

  // Determine winner and loser
  const winner = match.match_winner === 1 ? player1 : player2
  const loser = match.match_winner === 1 ? player2 : player1

  // Find the updated ranks
  const winnerUpdated = updatedPlayers.find((p: Player) => p.id === winner.id)!
  const loserUpdated = updatedPlayers.find((p: Player) => p.id === loser.id)!

  console.log(`Winner: ${winner.name} (${winner.current_rank} → ${winnerUpdated.current_rank})`)
  console.log(`Loser: ${loser.name} (${loser.current_rank} → ${loserUpdated.current_rank})`)

  // Update the existing ranking event with new data
  const { error: updateError } = await supabase
    .from('ranking_events')
    .update({
      player_id: winner.id, // Update to the new winner's ID
      old_rank: winner.current_rank,
      new_rank: winnerUpdated.current_rank,
      reason: `Match: ${player1.name} vs ${player2.name}, Winner: ${winner.name} (${winner.current_rank} → ${winnerUpdated.current_rank})`
    })
    .eq('match_id', match.id)

  if (updateError) {
    console.error('Failed to update ranking event:', updateError)
    throw updateError
  }

  // Update player rankings in the database
  await updatePlayersInDatabase(supabase, updatedPlayers)

  console.log('=== updateMatchEvent completed successfully ===')
}

export async function recordManualAdjustment(
  supabase: any,
  playerId: string,
  oldRank: number,
  newRank: number,
  reason: string = 'Manual adjustment'
): Promise<void> {
  // Record the manual adjustment event
  const { error } = await supabase
    .from('ranking_events')
    .insert({
      event_type: 'manual_adjustment',
      event_date: new Date().toISOString(),
      player_id: playerId,
      old_rank: oldRank,
      new_rank: newRank,
      reason: reason
    })

  if (error) {
    console.error('Error recording manual adjustment event:', error)
    throw error
  }
}

export function applyPoisonLadderLogic(
  players: Player[],
  match: Match
): Player[] {
  // Find the players involved in the match
  const player1 = players.find(p => p.id === match.player1_id)
  const player2 = players.find(p => p.id === match.player2_id)
  
  if (!player1 || !player2) {
    throw new Error('Players not found')
  }

  // Determine winner and loser
  const winner = match.match_winner === 1 ? player1 : player2
  const loser = match.match_winner === 1 ? player2 : player1

  // Create a copy of players array to avoid mutation
  const updatedPlayers = players.map(p => ({ ...p }))
  const winnerCopy = updatedPlayers.find(p => p.id === winner.id)!
  const loserCopy = updatedPlayers.find(p => p.id === loser.id)!

  // If winner has a higher rank number (lower position) than loser, move winner up
  // In poison ladder: lower rank number = better position, higher rank number = worse position
  if (winnerCopy.current_rank > loserCopy.current_rank) {
    const winnerOldRank = winnerCopy.current_rank
    const loserRank = loserCopy.current_rank

    // Move winner to loser's position
    winnerCopy.current_rank = loserRank

    // Move everyone between loser's position and winner's old position down one
    updatedPlayers.forEach(player => {
      if (
        player.id !== winner.id &&
        player.current_rank >= loserRank &&
        player.current_rank < winnerOldRank
      ) {
        player.current_rank += 1
      }
    })
  }

  // Sort by current rank and return
  return updatedPlayers.sort((a, b) => a.current_rank - b.current_rank)
}

export async function updatePlayersInDatabase(
  supabase: any,
  players: Player[]
): Promise<void> {
  // Update all players in the database
  for (const player of players) {
    const { error } = await supabase
      .from('players')
      .update({ current_rank: player.current_rank })
      .eq('id', player.id)

    if (error) {
      console.error(`Error updating player ${player.name}:`, error)
      throw error
    }
  }
}

export async function clearAllData(supabase: any): Promise<void> {
  console.log('Clearing all matches and ranking events...')
  
  try {
    // Clear all matches
    const { error: clearMatchesError } = await supabase
      .from('matches')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all matches

    if (clearMatchesError) {
      throw clearMatchesError
    }

    // Clear all ranking events
    const { error: clearEventsError } = await supabase
      .from('ranking_events')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000') // Delete all events

    if (clearEventsError) {
      throw clearEventsError
    }

    console.log('All data cleared successfully')
  } catch (error) {
    console.error('Error clearing data:', error)
    throw error
  }
}

export async function rebuildAllRankings(supabase: any): Promise<void> {
  console.log('Rebuilding all rankings from initial state...')
  
  try {
    // Get all players and reset to their initial_rank values
    const { data: allPlayers, error: playersError } = await supabase
      .from('players')
      .select('*')
      .order('created_at', { ascending: true })

    if (playersError || !allPlayers) {
      throw new Error('Failed to fetch players')
    }

    // Create initial ordered list based on initial_rank
    let orderedPlayers = allPlayers
      .map((player: Player) => ({ ...player }))
      .sort((a: Player, b: Player) => a.initial_rank - b.initial_rank)

    console.log('Initial ordered list:', orderedPlayers.map((p: Player) => `${p.name}: ${p.initial_rank}`))

    // Get all events in chronological order
    const { data: events, error: eventsError } = await supabase
      .from('ranking_events')
      .select('*')
      .order('event_date', { ascending: true })
      .order('created_at', { ascending: true })

    if (eventsError) {
      throw new Error('Failed to fetch events')
    }

    console.log(`Found ${events?.length || 0} events to replay`)

    // Process each event in chronological order
    for (const event of events || []) {
      if (event.event_type === 'match' && event.match_id) {
        console.log(`Processing match event: ${event.match_id}`)
        
        // Fetch the actual match data
        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .select('*')
          .eq('id', event.match_id)
          .single()

        if (matchError || !matchData) {
          console.warn(`Could not fetch match data for ${event.match_id}:`, matchError)
          continue
        }

        // Find winner and loser in the current ordered list
        const winnerIndex = orderedPlayers.findIndex((p: Player) => p.id === (matchData.match_winner === 1 ? matchData.player1_id : matchData.player2_id))
        const loserIndex = orderedPlayers.findIndex((p: Player) => p.id === (matchData.match_winner === 1 ? matchData.player2_id : matchData.player1_id))
        
        if (winnerIndex === -1 || loserIndex === -1) {
          console.warn(`Could not find players in ordered list for match ${event.match_id}`)
          continue
        }

        // Only apply poison ladder rule if winner is ranked lower than loser
        if (winnerIndex > loserIndex) {
          const winner = orderedPlayers[winnerIndex]
          const loser = orderedPlayers[loserIndex]
          
          // Store original ranks before moving
          const winnerOriginalRank = winnerIndex + 1
          const loserOriginalRank = loserIndex + 1
          
          // Remove winner from current position
          orderedPlayers.splice(winnerIndex, 1)
          
          // Insert winner at loser's position
          orderedPlayers.splice(loserIndex, 0, winner)
          
          // Update the ranking event with correct original rank
          const { error: updateError } = await supabase
            .from('ranking_events')
            .update({
              old_rank: winnerOriginalRank,
              new_rank: loserOriginalRank,
              reason: `Match: ${matchData.player1_id === winner.id ? 'Winner' : 'Loser'} vs ${matchData.player1_id === loser.id ? 'Winner' : 'Loser'}, Winner: ${winner.name} (${winnerOriginalRank} → ${loserOriginalRank})`
            })
            .eq('id', event.id)
          
          if (updateError) {
            console.warn(`Failed to update ranking event ${event.id}:`, updateError)
          }
          
          console.log(`Moved ${winner.name} from position ${winnerOriginalRank} to position ${loserOriginalRank} (${loser.name}'s position)`)
        } else {
          // Higher-ranked player won - no rank change needed
          const winner = orderedPlayers[winnerIndex]
          const loser = orderedPlayers[loserIndex]
          
          // Update the ranking event to reflect no change
          const { error: updateError } = await supabase
            .from('ranking_events')
            .update({
              old_rank: winnerIndex + 1,
              new_rank: winnerIndex + 1,
              reason: `Match: ${matchData.player1_id === winner.id ? 'Winner' : 'Loser'} vs ${matchData.player1_id === loser.id ? 'Winner' : 'Loser'}, Winner: ${winner.name} (no rank change - already ranked higher)`
            })
            .eq('id', event.id)
          
          if (updateError) {
            console.warn(`Failed to update ranking event ${event.id}:`, updateError)
          }
          
          console.log(`No rank change needed - ${winner.name} (position ${winnerIndex + 1}) already ranked higher than ${loser.name} (position ${loserIndex + 1})`)
        }
        
      } else if (event.event_type === 'manual_adjustment') {
        console.log(`Processing manual adjustment: Player ${event.player_id} to position ${event.new_rank}`)
        
        // Find the player in the ordered list
        const playerIndex = orderedPlayers.findIndex((p: Player) => p.id === event.player_id)
        if (playerIndex === -1) {
          console.warn(`Could not find player ${event.player_id} in ordered list`)
          continue
        }

        const targetPosition = event.new_rank! - 1 // Convert to 0-based index
        const player = orderedPlayers[playerIndex]
        const originalRank = playerIndex + 1
        
        // Remove player from current position
        orderedPlayers.splice(playerIndex, 1)
        
        // Insert player at target position
        orderedPlayers.splice(targetPosition, 0, player)
        
        // Update the ranking event with correct original rank
        const { error: updateError } = await supabase
          .from('ranking_events')
          .update({
            old_rank: originalRank,
            new_rank: event.new_rank,
            reason: `Manual adjustment: ${player.name} moved from position ${originalRank} to position ${event.new_rank}`
          })
          .eq('id', event.id)
        
        if (updateError) {
          console.warn(`Failed to update ranking event ${event.id}:`, updateError)
        }
        
        console.log(`Moved ${player.name} from position ${originalRank} to position ${event.new_rank}`)
      }
    }

    // Update current_rank for all players based on their position in the ordered list
    const currentPlayers = orderedPlayers.map((player: Player, index: number) => ({
      ...player,
      current_rank: index + 1
    }))

    // Update all players in the database
    await updatePlayersInDatabase(supabase, currentPlayers)
    
    console.log('All rankings rebuilt successfully')
    
  } catch (error) {
    console.error('Error rebuilding rankings:', error)
    throw error
  }
}

export async function replayEventsFromDate(
  supabase: any,
  fromDate: string
): Promise<void> {
  console.log(`Replaying events from ${fromDate}...`)
  
  try {
    // Get all players and reset to their initial_rank values
    const { data: allPlayers, error: playersError } = await supabase
      .from('players')
      .select('*')
      .order('created_at', { ascending: true })

    if (playersError || !allPlayers) {
      throw new Error('Failed to fetch players')
    }

    // Create initial ordered list based on initial_rank
    let orderedPlayers = allPlayers
      .map((player: Player) => ({ ...player }))
      .sort((a: Player, b: Player) => a.initial_rank - b.initial_rank)

    console.log('Initial ordered list:', orderedPlayers.map((p: Player) => `${p.name}: ${p.initial_rank}`))

    // Get all events from the specified date onwards
    const { data: events, error: eventsError } = await supabase
      .from('ranking_events')
      .select('*')
      .gte('event_date', fromDate)
      .order('event_date', { ascending: true })
      .order('created_at', { ascending: true })

    if (eventsError) {
      throw new Error('Failed to fetch events')
    }

    console.log(`Found ${events?.length || 0} events to replay from ${fromDate}`)

    // Process each event in chronological order
    for (const event of events || []) {
      if (event.event_type === 'match' && event.match_id) {
        console.log(`Processing match event: ${event.match_id}`)
        
        // Fetch the actual match data
        const { data: matchData, error: matchError } = await supabase
          .from('matches')
          .select('*')
          .eq('id', event.match_id)
          .single()

        if (matchError || !matchData) {
          console.warn(`Could not fetch match data for ${event.match_id}:`, matchError)
          continue
        }

        // Find winner and loser in the current ordered list
        const winnerIndex = orderedPlayers.findIndex((p: Player) => p.id === (matchData.match_winner === 1 ? matchData.player1_id : matchData.player2_id))
        const loserIndex = orderedPlayers.findIndex((p: Player) => p.id === (matchData.match_winner === 1 ? matchData.player2_id : matchData.player1_id))
        
        if (winnerIndex === -1 || loserIndex === -1) {
          console.warn(`Could not find players in ordered list for match ${event.match_id}`)
          continue
        }

        // Only apply poison ladder rule if winner is ranked lower than loser
        if (winnerIndex > loserIndex) {
          const winner = orderedPlayers[winnerIndex]
          const loser = orderedPlayers[loserIndex]
          
          // Store original ranks before moving
          const winnerOriginalRank = winnerIndex + 1
          const loserOriginalRank = loserIndex + 1
          
          // Remove winner from current position
          orderedPlayers.splice(winnerIndex, 1)
          
          // Insert winner at loser's position
          orderedPlayers.splice(loserIndex, 0, winner)
          
          // Update the ranking event with correct original rank
          const { error: updateError } = await supabase
            .from('ranking_events')
            .update({
              old_rank: winnerOriginalRank,
              new_rank: loserOriginalRank,
              reason: `Match: ${matchData.player1_id === winner.id ? 'Winner' : 'Loser'} vs ${matchData.player1_id === loser.id ? 'Winner' : 'Loser'}, Winner: ${winner.name} (${winnerOriginalRank} → ${loserOriginalRank})`
            })
            .eq('id', event.id)
          
          if (updateError) {
            console.warn(`Failed to update ranking event ${event.id}:`, updateError)
          }
          
          console.log(`Moved ${winner.name} from position ${winnerOriginalRank} to position ${loserOriginalRank} (${loser.name}'s position)`)
        } else {
          // Higher-ranked player won - no rank change needed
          const winner = orderedPlayers[winnerIndex]
          const loser = orderedPlayers[loserIndex]
          
          // Update the ranking event to reflect no change
          const { error: updateError } = await supabase
            .from('ranking_events')
            .update({
              old_rank: winnerIndex + 1,
              new_rank: winnerIndex + 1,
              reason: `Match: ${matchData.player1_id === winner.id ? 'Winner' : 'Loser'} vs ${matchData.player1_id === loser.id ? 'Winner' : 'Loser'}, Winner: ${winner.name} (no rank change - already ranked higher)`
            })
            .eq('id', event.id)
          
          if (updateError) {
            console.warn(`Failed to update ranking event ${event.id}:`, updateError)
          }
          
          console.log(`No rank change needed - ${winner.name} (position ${winnerIndex + 1}) already ranked higher than ${loser.name} (position ${loserIndex + 1})`)
        }
        
      } else if (event.event_type === 'manual_adjustment') {
        console.log(`Processing manual adjustment: Player ${event.player_id} to position ${event.new_rank}`)
        
        // Find the player in the ordered list
        const playerIndex = orderedPlayers.findIndex((p: Player) => p.id === event.player_id)
        if (playerIndex === -1) {
          console.warn(`Could not find player ${event.player_id} in ordered list`)
          continue
        }

        const targetPosition = event.new_rank! - 1 // Convert to 0-based index
        const player = orderedPlayers[playerIndex]
        const originalRank = playerIndex + 1
        
        // Remove player from current position
        orderedPlayers.splice(playerIndex, 1)
        
        // Insert player at target position
        orderedPlayers.splice(targetPosition, 0, player)
        
        // Update the ranking event with correct original rank
        const { error: updateError } = await supabase
          .from('ranking_events')
          .update({
            old_rank: originalRank,
            new_rank: event.new_rank,
            reason: `Manual adjustment: ${player.name} moved from position ${originalRank} to position ${event.new_rank}`
          })
          .eq('id', event.id)
        
        if (updateError) {
          console.warn(`Failed to update ranking event ${event.id}:`, updateError)
        }
        
        console.log(`Moved ${player.name} from position ${originalRank} to position ${event.new_rank}`)
      }
    }

    // Update current_rank for all players based on their position in the ordered list
    const currentPlayers = orderedPlayers.map((player: Player, index: number) => ({
      ...player,
      current_rank: index + 1
    }))

    // Update all players in the database
    await updatePlayersInDatabase(supabase, currentPlayers)
    
    console.log('Event replay completed successfully')
    
  } catch (error) {
    console.error('Error replaying events:', error)
    throw error
  }
}
