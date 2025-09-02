/**
 * Integration test file for end-to-end scenarios
 * Tests: complete workflows, complex ranking scenarios, system interactions
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  determineMatchWinner,
  updatePlayerRanks,
  rebuildRankingsFromTimeline,
  getActiveLeaderboard,
  getAllRankingChanges,
  normalizePlayerRanks
} from '../lib/utils/ladder'
import type { Player, Match, RankAdjustment } from '../lib/types/database'

// Mock Supabase client
const mockSupabase = {
  from: vi.fn(() => ({
    select: vi.fn(() => ({
      order: vi.fn(() => ({
        eq: vi.fn(),
        neq: vi.fn(),
        in: vi.fn(),
        not: vi.fn(),
        or: vi.fn()
      }))
    })),
    insert: vi.fn(),
    update: vi.fn(() => ({
      eq: vi.fn()
    })),
    delete: vi.fn(() => ({
      eq: vi.fn()
    }))
  }))
}

describe('End-to-End Integration Tests', () => {
  let mockPlayers: Player[]
  let mockMatches: Match[]
  let mockRankAdjustments: RankAdjustment[]

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create a realistic tournament scenario
    mockPlayers = [
      {
        id: '1',
        name: 'Alice',
        email: 'alice@test.com',
        initial_rank: 1,
        current_rank: 1,
        notes: '',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z'
      },
      {
        id: '2',
        name: 'Bob',
        email: 'bob@test.com',
        initial_rank: 2,
        current_rank: 2,
        notes: '',
        is_active: true,
        created_at: '2024-01-01T00:01:00Z'
      },
      {
        id: '3',
        name: 'Charlie',
        email: 'charlie@test.com',
        initial_rank: 3,
        current_rank: 3,
        notes: '',
        is_active: true,
        created_at: '2024-01-01T00:02:00Z'
      },
      {
        id: '4',
        name: 'David',
        email: 'david@test.com',
        initial_rank: 4,
        current_rank: 4,
        notes: '',
        is_active: true,
        created_at: '2024-01-01T00:03:00Z'
      },
      {
        id: '5',
        name: 'Eve',
        email: 'eve@test.com',
        initial_rank: 5,
        current_rank: 5,
        notes: '',
        is_active: true,
        created_at: '2024-01-01T00:04:00Z'
      },
      {
        id: '6',
        name: 'Frank',
        email: 'frank@test.com',
        initial_rank: 6,
        current_rank: 6,
        notes: '',
        is_active: false, // Inactive player
        created_at: '2024-01-01T00:05:00Z'
      }
    ]

    mockMatches = []
    mockRankAdjustments = []
  })

  describe('Complete Tournament Workflow', () => {
    it('should handle a full tournament with matches and rank adjustments', async () => {
      // Step 1: Initial state - all players in natural order
      let currentPlayers = [...mockPlayers]
      expect(currentPlayers.filter(p => p.is_active).length).toBe(5)

      // Step 2: Add some matches
      const match1: Match = {
        id: '1',
        player1_id: '2', // Bob (rank 2)
        player2_id: '1', // Alice (rank 1)
        player1_score: 21,
        player2_score: 19,
        created_at: '2024-01-02T00:00:00Z'
      }

      const match2: Match = {
        id: '2',
        player1_id: '4', // David (rank 4)
        player2_id: '3', // Charlie (rank 3)
        player1_score: 21,
        player2_score: 19,
        created_at: '2024-01-02T00:01:00Z'
      }

      // Update rankings after matches
      currentPlayers = updatePlayerRanks(currentPlayers, match1)
      currentPlayers = updatePlayerRanks(currentPlayers, match2)

      // Verify match results
      const alice = currentPlayers.find(p => p.id === '1')
      const bob = currentPlayers.find(p => p.id === '2')
      const charlie = currentPlayers.find(p => p.id === '3')
      const david = currentPlayers.find(p => p.id === '4')

      expect(bob?.current_rank).toBe(1) // Bob moved to rank 1
      expect(alice?.current_rank).toBe(2) // Alice moved to rank 2
      expect(david?.current_rank).toBe(3) // David moved to rank 3
      expect(charlie?.current_rank).toBe(4) // Charlie moved to rank 4

      // Step 3: Add rank adjustments
      const adjustment1: RankAdjustment = {
        id: '1',
        player_id: '5', // Eve
        old_rank: 5,
        new_rank: 1,
        reason: 'Admin moved Eve to top',
        created_at: '2024-01-03T00:00:00Z'
      }

      // Step 4: Test active leaderboard
      const activeLeaderboard = getActiveLeaderboard(currentPlayers)
      expect(activeLeaderboard).toHaveLength(5) // Only active players
      expect(activeLeaderboard[0].name).toBe('Bob') // Bob is display rank 1
      expect(activeLeaderboard[0].display_rank).toBe(1)
      expect(activeLeaderboard[0].current_rank).toBe(1) // Original rank preserved

      // Step 5: Test timeline rebuild
      mockMatches = [match1, match2]
      mockRankAdjustments = [adjustment1]

      // Mock Supabase responses
      mockSupabase.from.mockImplementation((table: string) => {
        const mockQuery = {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              eq: vi.fn(),
              neq: vi.fn(),
              in: vi.fn(),
              not: vi.fn(),
              or: vi.fn()
            }))
          }))
        }

        if (table === 'players') {
          mockQuery.select.mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: currentPlayers,
              error: null
            })
          })
        } else if (table === 'rank_adjustments') {
          mockQuery.select.mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockRankAdjustments.map(adj => ({
                ...adj,
                players: currentPlayers.find(p => p.id === adj.player_id)
              })),
              error: null
            })
          })
        } else if (table === 'matches') {
          mockQuery.select.mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockMatches.map(match => ({
                ...match,
                player1: currentPlayers.find(p => p.id === match.player1_id),
                player2: currentPlayers.find(p => p.id === match.player2_id)
              })),
              error: null
            })
          })
        }

        return mockQuery
      })

      const rebuildResult = await rebuildRankingsFromTimeline(mockSupabase)
      expect(rebuildResult.success).toBe(true)
      expect(rebuildResult.updatedPlayers).toHaveLength(6) // All players updated
    })

    it('should handle player deactivation and reactivation workflow', () => {
      // Step 1: Start with all active players
      let currentPlayers = [...mockPlayers]
      let activeLeaderboard = getActiveLeaderboard(currentPlayers)
      expect(activeLeaderboard).toHaveLength(5)

      // Step 2: Deactivate a player
      currentPlayers = currentPlayers.map(p => 
        p.id === '3' ? { ...p, is_active: false } : p
      )

      activeLeaderboard = getActiveLeaderboard(currentPlayers)
      expect(activeLeaderboard).toHaveLength(4)
      expect(activeLeaderboard.find(p => p.name === 'Charlie')).toBeUndefined()

      // Step 3: Add a match (should not include deactivated player)
      const match: Match = {
        id: '1',
        player1_id: '1', // Alice
        player2_id: '2', // Bob
        player1_score: 21,
        player2_score: 19,
        created_at: '2024-01-02T00:00:00Z'
      }

      currentPlayers = updatePlayerRanks(currentPlayers, match)

      // Step 4: Reactivate the player
      currentPlayers = currentPlayers.map(p => 
        p.id === '3' ? { ...p, is_active: true } : p
      )

      activeLeaderboard = getActiveLeaderboard(currentPlayers)
      expect(activeLeaderboard).toHaveLength(5)
      expect(activeLeaderboard.find(p => p.name === 'Charlie')).toBeDefined()

      // Charlie should still have his original rank (3)
      const charlie = activeLeaderboard.find(p => p.name === 'Charlie')
      expect(charlie?.current_rank).toBe(3)
    })
  })

  describe('Complex Ranking Scenarios', () => {
    it('should handle multiple rank adjustments with collisions', async () => {
      // Create players with initial ranks
      let currentPlayers = [...mockPlayers]

      // Add multiple rank adjustments that create collisions
      const adjustments: RankAdjustment[] = [
        {
          id: '1',
          player_id: '2', // Bob moves to rank 1
          old_rank: 2,
          new_rank: 1,
          reason: 'Admin adjustment 1',
          created_at: '2024-01-03T00:00:00Z'
        },
        {
          id: '2',
          player_id: '3', // Charlie also moves to rank 1
          old_rank: 3,
          new_rank: 1,
          reason: 'Admin adjustment 2',
          created_at: '2024-01-03T00:01:00Z'
        },
        {
          id: '3',
          player_id: '4', // David also moves to rank 1
          old_rank: 4,
          new_rank: 1,
          reason: 'Admin adjustment 3',
          created_at: '2024-01-03T00:02:00Z'
        }
      ]

      // Mock Supabase responses
      mockSupabase.from.mockImplementation((table: string) => {
        const mockQuery = {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              eq: vi.fn(),
              neq: vi.fn(),
              in: vi.fn(),
              not: vi.fn(),
              or: vi.fn()
            }))
          }))
        }

        if (table === 'players') {
          mockQuery.select.mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: currentPlayers,
              error: null
            })
          })
        } else if (table === 'rank_adjustments') {
          mockQuery.select.mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: adjustments.map(adj => ({
                ...adj,
                players: currentPlayers.find(p => p.id === adj.player_id)
              })),
              error: null
            })
          })
        } else if (table === 'matches') {
          mockQuery.select.mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        }

        return mockQuery
      })

      const rebuildResult = await rebuildRankingsFromTimeline(mockSupabase)
      expect(rebuildResult.success).toBe(true)

      // Check that rank collisions are resolved
      const finalRanks = rebuildResult.updatedPlayers.map(p => p.current_rank)
      const uniqueRanks = new Set(finalRanks)
      expect(uniqueRanks.size).toBe(finalRanks.length) // No duplicate ranks

      // The last adjustment (David) should get rank 1, others should be bumped down
      const david = rebuildResult.updatedPlayers.find(p => p.id === '4')
      const charlie = rebuildResult.updatedPlayers.find(p => p.id === '3')
      const bob = rebuildResult.updatedPlayers.find(p => p.id === '2')

      expect(david?.current_rank).toBe(1) // Last adjustment wins
      expect(charlie?.current_rank).toBe(2) // Bumped down
      expect(bob?.current_rank).toBe(3) // Bumped down
    })

    it('should handle mixed matches and rank adjustments in timeline', async () => {
      let currentPlayers = [...mockPlayers]

      // Create a complex timeline: match -> adjustment -> match -> adjustment
      const match1: Match = {
        id: '1',
        player1_id: '2', // Bob beats Alice
        player2_id: '1',
        player1_score: 21,
        player2_score: 19,
        created_at: '2024-01-02T00:00:00Z'
      }

      const adjustment1: RankAdjustment = {
        id: '1',
        player_id: '3', // Charlie moves to rank 1
        old_rank: 3,
        new_rank: 1,
        reason: 'Admin adjustment',
        created_at: '2024-01-02T00:01:00Z'
      }

      const match2: Match = {
        id: '2',
        player1_id: '4', // David beats Charlie
        player2_id: '3',
        player1_score: 21,
        player2_score: 19,
        created_at: '2024-01-02T00:02:00Z'
      }

      const adjustment2: RankAdjustment = {
        id: '2',
        player_id: '5', // Eve moves to rank 1
        old_rank: 5,
        new_rank: 1,
        reason: 'Final admin adjustment',
        created_at: '2024-01-02T00:03:00Z'
      }

      // Mock Supabase responses
      mockSupabase.from.mockImplementation((table: string) => {
        const mockQuery = {
          select: vi.fn(() => ({
            order: vi.fn(() => ({
              eq: vi.fn(),
              neq: vi.fn(),
              in: vi.fn(),
              not: vi.fn(),
              or: vi.fn()
            }))
          }))
        }

        if (table === 'players') {
          mockQuery.select.mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: currentPlayers,
              error: null
            })
          })
        } else if (table === 'rank_adjustments') {
          mockQuery.select.mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [adjustment1, adjustment2].map(adj => ({
                ...adj,
                players: currentPlayers.find(p => p.id === adj.player_id)
              })),
              error: null
            })
          })
        } else if (table === 'matches') {
          mockQuery.select.mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [match1, match2].map(match => ({
                ...match,
                player1: currentPlayers.find(p => p.id === match.player1_id),
                player2: currentPlayers.find(p => p.id === match.player2_id)
              })),
              error: null
            })
          })
        }

        return mockQuery
      })

      const rebuildResult = await rebuildRankingsFromTimeline(mockSupabase)
      expect(rebuildResult.success).toBe(true)

      // Final result should have Eve at rank 1 (last adjustment)
      const eve = rebuildResult.updatedPlayers.find(p => p.id === '5')
      expect(eve?.current_rank).toBe(1)

      // Test active leaderboard
      const activeLeaderboard = getActiveLeaderboard(rebuildResult.updatedPlayers)
      expect(activeLeaderboard[0].name).toBe('Eve')
      expect(activeLeaderboard[0].display_rank).toBe(1)
    })
  })

  describe('System Resilience', () => {
    it('should handle normalization after complex operations', () => {
      // Create players with duplicate and gap ranks
      const corruptedPlayers = [
        { ...mockPlayers[0], current_rank: 1 },
        { ...mockPlayers[1], current_rank: 1 }, // Duplicate rank 1
        { ...mockPlayers[2], current_rank: 3 }, // Gap at rank 2
        { ...mockPlayers[3], current_rank: 5 }, // Gap at rank 4
        { ...mockPlayers[4], current_rank: 5 }, // Duplicate rank 5
        { ...mockPlayers[5], current_rank: 7 }  // Gap at rank 6
      ]

      // Normalize the ranks
      const normalizedPlayers = normalizePlayerRanks(corruptedPlayers)
      
      // Check that all ranks are sequential and unique
      const ranks = normalizedPlayers.map(p => p.current_rank)
      expect(ranks).toEqual([1, 2, 3, 4, 5, 6])

      // Test active leaderboard with normalized players
      const activeLeaderboard = getActiveLeaderboard(normalizedPlayers)
      expect(activeLeaderboard).toHaveLength(5) // Only active players
      
      const displayRanks = activeLeaderboard.map(p => p.display_rank)
      expect(displayRanks).toEqual([1, 2, 3, 4, 5])
    })

    it('should handle edge cases in match processing', () => {
      let currentPlayers = [...mockPlayers]

      // Test tie game (should not change ranks)
      const tieMatch: Match = {
        id: '1',
        player1_id: '1',
        player2_id: '2',
        player1_score: 21,
        player2_score: 21,
        created_at: '2024-01-02T00:00:00Z'
      }

      const playersBeforeTie = [...currentPlayers]
      currentPlayers = updatePlayerRanks(currentPlayers, tieMatch)
      
      // Ranks should be unchanged for tie
      expect(currentPlayers).toEqual(playersBeforeTie)

      // Test match with inactive player (should not affect active players)
      const matchWithInactive: Match = {
        id: '2',
        player1_id: '6', // Frank (inactive)
        player2_id: '1', // Alice (active)
        player1_score: 21,
        player2_score: 19,
        created_at: '2024-01-02T00:01:00Z'
      }

      const playersBeforeInactiveMatch = [...currentPlayers]
      currentPlayers = updatePlayerRanks(currentPlayers, matchWithInactive)
      
      // Active players should be unchanged
      const activePlayersBefore = playersBeforeInactiveMatch.filter(p => p.is_active)
      const activePlayersAfter = currentPlayers.filter(p => p.is_active)
      expect(activePlayersAfter).toEqual(activePlayersBefore)
    })

    it('should maintain data consistency across operations', () => {
      let currentPlayers = [...mockPlayers]

      // Perform multiple operations
      const match1: Match = {
        id: '1',
        player1_id: '2',
        player2_id: '1',
        player1_score: 21,
        player2_score: 19,
        created_at: '2024-01-02T00:00:00Z'
      }

      currentPlayers = updatePlayerRanks(currentPlayers, match1)

      // Deactivate a player
      currentPlayers = currentPlayers.map(p => 
        p.id === '3' ? { ...p, is_active: false } : p
      )

      // Add another match
      const match2: Match = {
        id: '2',
        player1_id: '4',
        player2_id: '5',
        player1_score: 21,
        player2_score: 19,
        created_at: '2024-01-02T00:01:00Z'
      }

      currentPlayers = updatePlayerRanks(currentPlayers, match2)

      // Test active leaderboard
      const activeLeaderboard = getActiveLeaderboard(currentPlayers)
      
      // Should have correct number of active players
      expect(activeLeaderboard).toHaveLength(4)
      
      // All display ranks should be sequential
      const displayRanks = activeLeaderboard.map(p => p.display_rank)
      expect(displayRanks).toEqual([1, 2, 3, 4])
      
      // All players should be active
      expect(activeLeaderboard.every(p => p.is_active === true)).toBe(true)
      
      // Original current_ranks should be preserved
      activeLeaderboard.forEach(player => {
        expect(player.current_rank).toBeGreaterThan(0)
        expect(typeof player.current_rank).toBe('number')
      })
    })
  })

  describe('Performance and Scalability', () => {
    it('should handle large number of players efficiently', () => {
      // Create 100 players
      const manyPlayers: Player[] = Array.from({ length: 100 }, (_, i) => ({
        id: `player-${i}`,
        name: `Player ${i}`,
        email: `player${i}@test.com`,
        initial_rank: i + 1,
        current_rank: i + 1,
        notes: '',
        is_active: i % 2 === 0, // Every other player is active
        created_at: `2024-01-01T00:${i.toString().padStart(2, '0')}:00Z`
      }))

      const startTime = Date.now()
      const activeLeaderboard = getActiveLeaderboard(manyPlayers)
      const endTime = Date.now()

      expect(activeLeaderboard).toHaveLength(50) // Half are active
      expect(endTime - startTime).toBeLessThan(100) // Should complete quickly
      
      // Verify display ranks are correct
      const displayRanks = activeLeaderboard.map(p => p.display_rank)
      expect(displayRanks).toEqual(Array.from({ length: 50 }, (_, i) => i + 1))
    })

    it('should handle complex ranking scenarios efficiently', () => {
      // Create players with complex rank distribution
      const complexPlayers: Player[] = Array.from({ length: 50 }, (_, i) => ({
        id: `player-${i}`,
        name: `Player ${i}`,
        email: `player${i}@test.com`,
        initial_rank: i + 1,
        current_rank: (i * 2) + 1, // Create gaps: 1, 3, 5, 7, ...
        notes: '',
        is_active: true,
        created_at: `2024-01-01T00:${i.toString().padStart(2, '0')}:00Z`
      }))

      const startTime = Date.now()
      const normalizedPlayers = normalizePlayerRanks(complexPlayers)
      const activeLeaderboard = getActiveLeaderboard(normalizedPlayers)
      const endTime = Date.now()

      expect(normalizedPlayers).toHaveLength(50)
      expect(activeLeaderboard).toHaveLength(50)
      expect(endTime - startTime).toBeLessThan(100) // Should complete quickly
      
      // Verify normalization worked
      const ranks = normalizedPlayers.map(p => p.current_rank)
      expect(ranks).toEqual(Array.from({ length: 50 }, (_, i) => i + 1))
    })
  })
})