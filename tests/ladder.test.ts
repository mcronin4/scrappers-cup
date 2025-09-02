/**
 * Test file for core ladder ranking logic
 * Tests: match processing, rank adjustments, timeline rebuilds, active player filtering
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

describe('Ladder Ranking System', () => {
  let mockPlayers: Player[]
  let mockMatches: Match[]
  let mockRankAdjustments: RankAdjustment[]

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks()
    
    // Create test players (mix of active and inactive)
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
        is_active: false, // Inactive player
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
      }
    ]

    mockMatches = [
      {
        id: '1',
        player1_id: '1',
        player2_id: '2',
        player1_score: 21,
        player2_score: 19,
        created_at: '2024-01-02T00:00:00Z'
      },
      {
        id: '2',
        player1_id: '3',
        player2_id: '5',
        player1_score: 19,
        player2_score: 21,
        created_at: '2024-01-02T00:01:00Z'
      }
    ]

    mockRankAdjustments = [
      {
        id: '1',
        player_id: '3',
        old_rank: 3,
        new_rank: 1,
        reason: 'Admin adjustment',
        created_at: '2024-01-03T00:00:00Z'
      }
    ]
  })

  describe('determineMatchWinner', () => {
    it('should determine winner correctly for valid scores', () => {
      const match1 = { player1_score: 21, player2_score: 19 }
      const match2 = { player1_score: 15, player2_score: 21 }
      const match3 = { player1_score: 21, player2_score: 21 }

      expect(determineMatchWinner(match1)).toBe('player1')
      expect(determineMatchWinner(match2)).toBe('player2')
      expect(determineMatchWinner(match3)).toBe(null)
    })

    it('should handle edge cases', () => {
      const match1 = { player1_score: 0, player2_score: 21 }
      const match2 = { player1_score: 21, player2_score: 0 }

      expect(determineMatchWinner(match1)).toBe('player2')
      expect(determineMatchWinner(match2)).toBe('player1')
    })
  })

  describe('updatePlayerRanks', () => {
    it('should update ranks correctly for a match', () => {
      const match = {
        id: '1',
        player1_id: '2', // Bob (rank 2)
        player2_id: '1', // Alice (rank 1)
        player1_score: 21,
        player2_score: 19,
        created_at: '2024-01-02T00:00:00Z'
      }

      const updatedPlayers = updatePlayerRanks(mockPlayers, match)

      // Bob should move to rank 1, Alice should move to rank 2
      const bob = updatedPlayers.find(p => p.id === '2')
      const alice = updatedPlayers.find(p => p.id === '1')

      expect(bob?.current_rank).toBe(1)
      expect(alice?.current_rank).toBe(2)
    })

    it('should not affect other players when updating ranks', () => {
      const match = {
        id: '1',
        player1_id: '2',
        player2_id: '1',
        player1_score: 21,
        player2_score: 19,
        created_at: '2024-01-02T00:00:00Z'
      }

      const updatedPlayers = updatePlayerRanks(mockPlayers, match)
      const charlie = updatedPlayers.find(p => p.id === '3')
      const eve = updatedPlayers.find(p => p.id === '5')

      expect(charlie?.current_rank).toBe(3)
      expect(eve?.current_rank).toBe(5)
    })
  })

  describe('getActiveLeaderboard', () => {
    it('should filter to active players only', () => {
      const activeLeaderboard = getActiveLeaderboard(mockPlayers)
      
      expect(activeLeaderboard).toHaveLength(4) // Only active players
      expect(activeLeaderboard.every(p => p.is_active === true)).toBe(true)
      expect(activeLeaderboard.find(p => p.name === 'David')).toBeUndefined()
    })

    it('should assign sequential display ranks', () => {
      const activeLeaderboard = getActiveLeaderboard(mockPlayers)
      
      const displayRanks = activeLeaderboard.map(p => p.display_rank)
      expect(displayRanks).toEqual([1, 2, 3, 4])
    })

    it('should preserve original current_rank', () => {
      const activeLeaderboard = getActiveLeaderboard(mockPlayers)
      
      const alice = activeLeaderboard.find(p => p.name === 'Alice')
      expect(alice?.current_rank).toBe(1) // Original rank preserved
      expect(alice?.display_rank).toBe(1) // Display rank assigned
    })

    it('should handle empty player list', () => {
      const emptyLeaderboard = getActiveLeaderboard([])
      expect(emptyLeaderboard).toEqual([])
    })

    it('should handle all inactive players', () => {
      const allInactivePlayers = mockPlayers.map(p => ({ ...p, is_active: false }))
      const emptyLeaderboard = getActiveLeaderboard(allInactivePlayers)
      expect(emptyLeaderboard).toEqual([])
    })
  })

  describe('normalizePlayerRanks', () => {
    it('should fix duplicate ranks', () => {
      const playersWithDuplicates = [
        { ...mockPlayers[0], current_rank: 1 },
        { ...mockPlayers[1], current_rank: 1 }, // Duplicate rank 1
        { ...mockPlayers[2], current_rank: 3 },
        { ...mockPlayers[3], current_rank: 4 },
        { ...mockPlayers[4], current_rank: 5 }
      ]

      const normalized = normalizePlayerRanks(playersWithDuplicates)
      const ranks = normalized.map(p => p.current_rank)
      
      expect(ranks).toEqual([1, 2, 3, 4, 5])
    })

    it('should fix gaps in ranks', () => {
      const playersWithGaps = [
        { ...mockPlayers[0], current_rank: 1 },
        { ...mockPlayers[1], current_rank: 3 }, // Gap at rank 2
        { ...mockPlayers[2], current_rank: 5 }, // Gap at rank 4
        { ...mockPlayers[3], current_rank: 6 },
        { ...mockPlayers[4], current_rank: 7 }
      ]

      const normalized = normalizePlayerRanks(playersWithGaps)
      const ranks = normalized.map(p => p.current_rank)
      
      expect(ranks).toEqual([1, 2, 3, 4, 5])
    })

    it('should maintain relative order', () => {
      const shuffledPlayers = [
        { ...mockPlayers[2], current_rank: 1 },
        { ...mockPlayers[0], current_rank: 2 },
        { ...mockPlayers[4], current_rank: 3 },
        { ...mockPlayers[1], current_rank: 4 },
        { ...mockPlayers[3], current_rank: 5 }
      ]

      const normalized = normalizePlayerRanks(shuffledPlayers)
      
      // Should maintain the relative ranking order
      expect(normalized[0].id).toBe('3') // Charlie stays first
      expect(normalized[1].id).toBe('1') // Alice stays second
      expect(normalized[2].id).toBe('5') // Eve stays third
    })
  })

  describe('getAllRankingChanges', () => {
    beforeEach(() => {
      // Mock the Supabase responses
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

        if (table === 'rank_adjustments') {
          mockQuery.select.mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockRankAdjustments.map(adj => ({
                ...adj,
                players: mockPlayers.find(p => p.id === adj.player_id)
              })),
              error: null
            })
          })
        } else if (table === 'matches') {
          mockQuery.select.mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockMatches.map(match => ({
                ...match,
                player1: mockPlayers.find(p => p.id === match.player1_id),
                player2: mockPlayers.find(p => p.id === match.player2_id)
              })),
              error: null
            })
          })
        }

        return mockQuery
      })
    })

    it('should return combined timeline of changes', async () => {
      const changes = await getAllRankingChanges(mockSupabase)
      
      expect(changes).toHaveLength(3) // 2 matches + 1 rank adjustment
      expect(changes.some(c => c.change_type === 'match')).toBe(true)
      expect(changes.some(c => c.change_type === 'rank_adjustment')).toBe(true)
    })

    it('should sort changes chronologically', async () => {
      const changes = await getAllRankingChanges(mockSupabase)
      
      for (let i = 1; i < changes.length; i++) {
        const prevDate = new Date(changes[i - 1].created_at)
        const currDate = new Date(changes[i].created_at)
        expect(prevDate.getTime()).toBeLessThanOrEqual(currDate.getTime())
      }
    })

    it('should include rank changes for matches', async () => {
      const changes = await getAllRankingChanges(mockSupabase)
      const matchChanges = changes.filter(c => c.change_type === 'match')
      
      expect(matchChanges.length).toBeGreaterThan(0)
      matchChanges.forEach(change => {
        expect(change.rank_changes).toBeDefined()
        expect(Array.isArray(change.rank_changes)).toBe(true)
      })
    })
  })

  describe('rebuildRankingsFromTimeline', () => {
    beforeEach(() => {
      // Mock Supabase responses for rebuild
      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'players') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockPlayers,
                error: null
              })
            })
          }
        }
        
        // For rank_adjustments and matches, use the same mock as getAllRankingChanges
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

        if (table === 'rank_adjustments') {
          mockQuery.select.mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockRankAdjustments.map(adj => ({
                ...adj,
                players: mockPlayers.find(p => p.id === adj.player_id)
              })),
              error: null
            })
          })
        } else if (table === 'matches') {
          mockQuery.select.mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mockMatches.map(match => ({
                ...match,
                player1: mockPlayers.find(p => p.id === match.player1_id),
                player2: mockPlayers.find(p => p.id === match.player2_id)
              })),
              error: null
            })
          })
        }

        return mockQuery
      })
    })

    it('should rebuild rankings from timeline correctly', async () => {
      const result = await rebuildRankingsFromTimeline(mockSupabase)
      
      expect(result.success).toBe(true)
      expect(result.updatedPlayers).toBeDefined()
      expect(result.updatedPlayers.length).toBe(mockPlayers.length)
    })

    it('should handle rank collisions by bumping players down', async () => {
      // Create a scenario with rank collisions
      const collisionAdjustments = [
        {
          id: '1',
          player_id: '2', // Bob moves to rank 1
          old_rank: 2,
          new_rank: 1,
          reason: 'Admin adjustment',
          created_at: '2024-01-03T00:00:00Z'
        },
        {
          id: '2',
          player_id: '3', // Charlie also moves to rank 1
          old_rank: 3,
          new_rank: 1,
          reason: 'Admin adjustment',
          created_at: '2024-01-03T00:01:00Z'
        }
      ]

      mockSupabase.from.mockImplementation((table: string) => {
        if (table === 'players') {
          return {
            select: vi.fn().mockReturnValue({
              order: vi.fn().mockResolvedValue({
                data: mockPlayers,
                error: null
              })
            })
          }
        }
        
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

        if (table === 'rank_adjustments') {
          mockQuery.select.mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: collisionAdjustments.map(adj => ({
                ...adj,
                players: mockPlayers.find(p => p.id === adj.player_id)
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

      const result = await rebuildRankingsFromTimeline(mockSupabase)
      
      expect(result.success).toBe(true)
      
      // Check that rank collisions are resolved
      const finalRanks = result.updatedPlayers.map(p => p.current_rank)
      const uniqueRanks = new Set(finalRanks)
      expect(uniqueRanks.size).toBe(finalRanks.length) // No duplicate ranks
    })
  })

  describe('Edge Cases', () => {
    it('should handle empty player list', () => {
      const emptyLeaderboard = getActiveLeaderboard([])
      expect(emptyLeaderboard).toEqual([])
    })

    it('should handle single player', () => {
      const singlePlayer = [mockPlayers[0]]
      const leaderboard = getActiveLeaderboard(singlePlayer)
      
      expect(leaderboard).toHaveLength(1)
      expect(leaderboard[0].display_rank).toBe(1)
    })

    it('should handle players with same created_at timestamp', () => {
      const sameTimePlayers = mockPlayers.map((p, index) => ({
        ...p,
        created_at: '2024-01-01T00:00:00Z',
        id: `player-${index}`
      }))

      const normalized = normalizePlayerRanks(sameTimePlayers)
      expect(normalized).toHaveLength(sameTimePlayers.length)
    })
  })
})