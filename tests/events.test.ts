/**
 * Simple test for the new event-based ranking system
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { applyPoisonLadderLogic, determineMatchWinner } from '../lib/utils/events'
import { determineMatchWinner as ladderDetermineMatchWinner } from '../lib/utils/ladder'
import type { Player, Match } from '../lib/types/database'

describe('Simplified Event System', () => {
  let mockPlayers: Player[]

  beforeEach(() => {
    mockPlayers = [
      {
        id: '1',
        name: 'Alice',
        email: 'alice@test.com',
        current_rank: 1,
        notes: '',
        created_at: '2024-01-01T00:00:00Z'
      },
      {
        id: '2',
        name: 'Bob',
        email: 'bob@test.com',
        current_rank: 2,
        notes: '',
        created_at: '2024-01-01T00:01:00Z'
      },
      {
        id: '3',
        name: 'Charlie',
        email: 'charlie@test.com',
        current_rank: 3,
        notes: '',
        created_at: '2024-01-01T00:02:00Z'
      }
    ]
  })

  describe('determineMatchWinner', () => {
    it('should determine winner correctly', () => {
      const match = {
        id: '1',
        player1_id: '1',
        player2_id: '2',
        date_played: '2024-01-02',
        set1_winner: 1 as 1 | 2,
        set1_p1_games: 6,
        set1_p2_games: 4,
        set2_winner: 1 as 1 | 2,
        set2_p1_games: 6,
        set2_p2_games: 3,
        created_at: '2024-01-02T00:00:00Z'
      }

      const winner = ladderDetermineMatchWinner(match)
      expect(winner).toBe(1)
    })
  })

  describe('applyPoisonLadderLogic', () => {
    it('should move winner to loser position and bump others down', () => {
      const match: Match = {
        id: '1',
        player1_id: '3', // Charlie (rank 3)
        player2_id: '1', // Alice (rank 1)
        date_played: '2024-01-02',
        set1_winner: 1, // Charlie wins
        set1_p1_games: 6,
        set1_p2_games: 4,
        set2_winner: 1,
        set2_p1_games: 6,
        set2_p2_games: 3,
        match_winner: 1, // Charlie wins
        created_at: '2024-01-02T00:00:00Z'
      }

      const updatedPlayers = applyPoisonLadderLogic(mockPlayers, match)
      
      // Charlie should move to rank 1
      const charlie = updatedPlayers.find(p => p.id === '3')
      expect(charlie?.current_rank).toBe(1)
      
      // Alice should move to rank 2
      const alice = updatedPlayers.find(p => p.id === '1')
      expect(alice?.current_rank).toBe(2)
      
      // Bob should move to rank 3
      const bob = updatedPlayers.find(p => p.id === '2')
      expect(bob?.current_rank).toBe(3)
    })

    it('should not change ranks if higher rank beats lower rank', () => {
      const match: Match = {
        id: '1',
        player1_id: '1', // Alice (rank 1)
        player2_id: '3', // Charlie (rank 3)
        date_played: '2024-01-02',
        set1_winner: 1, // Alice wins
        set1_p1_games: 6,
        set1_p2_games: 4,
        set2_winner: 1,
        set2_p1_games: 6,
        set2_p2_games: 3,
        match_winner: 1, // Alice wins
        created_at: '2024-01-02T00:00:00Z'
      }

      const updatedPlayers = applyPoisonLadderLogic(mockPlayers, match)
      
      // Ranks should remain the same
      expect(updatedPlayers.find(p => p.id === '1')?.current_rank).toBe(1)
      expect(updatedPlayers.find(p => p.id === '2')?.current_rank).toBe(2)
      expect(updatedPlayers.find(p => p.id === '3')?.current_rank).toBe(3)
    })
  })
})
