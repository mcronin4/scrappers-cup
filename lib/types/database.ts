export interface Player {
  id: string
  name: string
  email: string
  initial_rank: number
  current_rank: number
  notes: string
  is_active: boolean
  created_at: string
  display_rank?: number  // Optional field added by getActiveLeaderboard for frontend display
}

export interface Match {
  id: string
  player1_id: string
  player2_id: string
  date_played: string
  set1_winner: 1 | 2
  set1_p1_games: number
  set1_p2_games: number
  set2_winner: 1 | 2
  set2_p1_games: number
  set2_p2_games: number
  tiebreaker_winner?: 1 | 2 | null
  tiebreaker_p1_points?: number | null
  tiebreaker_p2_points?: number | null
  match_winner: 1 | 2
  created_at: string
}

export interface AllowedEmail {
  id: string
  email: string
  is_admin: boolean
  created_at: string
}

export interface MatchWithPlayers extends Match {
  player1: Player
  player2: Player
}

export interface PlayerStats {
  player: Player
  total_matches: number
  wins: number
  losses: number
  sets_won: number
  sets_lost: number
  games_won: number
  games_lost: number
}

export interface RankAdjustment {
  id: string
  player_id: string
  old_rank: number
  new_rank: number
  reason?: string
  adjusted_by: string
  adjusted_at: string
}