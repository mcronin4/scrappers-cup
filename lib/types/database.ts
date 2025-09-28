export interface Player {
  id: string
  name: string
  email: string
  current_rank: number
  initial_rank: number
  notes: string
  created_at: string
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

export interface RankingEvent {
  id: string
  event_type: 'match' | 'manual_adjustment'
  event_date: string
  match_id?: string  // For match events
  player_id?: string  // For manual adjustment events
  old_rank?: number   // For manual adjustment events
  new_rank?: number   // For manual adjustment events
  reason?: string     // For manual adjustment events
  created_at: string
}