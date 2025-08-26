import { Player, Match } from '@/lib/types/database'

export function updateLadderRankings(
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
  const updatedPlayers = [...players]

  // If winner has a lower rank number (higher position) than loser, move winner up
  if (winner.current_rank > loser.current_rank) {
    const winnerOldRank = winner.current_rank
    const loserRank = loser.current_rank

    // Move winner to loser's position
    winner.current_rank = loserRank

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

  // Sort by current rank
  return updatedPlayers.sort((a, b) => a.current_rank - b.current_rank)
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