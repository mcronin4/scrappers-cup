import { Match } from '@/lib/types/database'

// Simple match winner determination
export function determineMatchWinner(match: Omit<Match, 'match_winner'>): 1 | 2 {
  // If there was a retirement, the non-retiring player wins
  if (match.has_retirement && match.retired_player) {
    return match.retired_player === 1 ? 2 : 1
  }

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