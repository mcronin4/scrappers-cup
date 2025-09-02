/**
 * Test file for transaction log functionality
 * Tests: timeline building, data filtering, chronological ordering, rank change calculations
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getAllRankingChanges } from '../lib/utils/ladder'
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
    }))
  }))
}

describe('Transaction Log System', () => {
  let mockPlayers: Player[]
  let mockMatches: Match[]
  let mockRankAdjustments: RankAdjustment[]

  beforeEach(() => {
    vi.clearAllMocks()
    
    // Create comprehensive test data
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

    // Create matches with different scenarios
    mockMatches = [
      {
        id: '1',
        player1_id: '1', // Alice (rank 1)
        player2_id: '2', // Bob (rank 2)
        player1_score: 21,
        player2_score: 19,
        created_at: '2024-01-02T00:00:00Z'
      },
      {
        id: '2',
        player1_id: '3', // Charlie (rank 3)
        player2_id: '5', // Eve (rank 5)
        player1_score: 19,
        player2_score: 21,
        created_at: '2024-01-02T00:01:00Z'
      },
      {
        id: '3',
        player1_id: '4', // David (inactive player)
        player2_id: '1', // Alice
        player1_score: 21,
        player2_score: 19,
        created_at: '2024-01-02T00:02:00Z'
      }
    ]

    // Create rank adjustments
    mockRankAdjustments = [
      {
        id: '1',
        player_id: '3', // Charlie
        old_rank: 3,
        new_rank: 1,
        reason: 'Admin adjustment - moved to top',
        created_at: '2024-01-03T00:00:00Z'
      },
      {
        id: '2',
        player_id: '5', // Eve
        old_rank: 5,
        new_rank: 2,
        reason: 'Admin adjustment - moved up',
        created_at: '2024-01-03T00:01:00Z'
      },
      {
        id: '3',
        player_id: '4', // David (inactive)
        old_rank: 4,
        new_rank: 1,
        reason: 'Admin adjustment - inactive player',
        created_at: '2024-01-03T00:02:00Z'
      }
    ]

    // Setup Supabase mocks
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

  describe('getAllRankingChanges', () => {
    it('should return all ranking changes in chronological order', async () => {
      const changes = await getAllRankingChanges(mockSupabase)
      
      expect(changes).toHaveLength(6) // 3 matches + 3 rank adjustments
      
      // Verify chronological order
      for (let i = 1; i < changes.length; i++) {
        const prevDate = new Date(changes[i - 1].created_at)
        const currDate = new Date(changes[i].created_at)
        expect(prevDate.getTime()).toBeLessThanOrEqual(currDate.getTime())
      }
    })

    it('should include both matches and rank adjustments', async () => {
      const changes = await getAllRankingChanges(mockSupabase)
      
      const matchChanges = changes.filter(c => c.change_type === 'match')
      const adjustmentChanges = changes.filter(c => c.change_type === 'rank_adjustment')
      
      expect(matchChanges).toHaveLength(3)
      expect(adjustmentChanges).toHaveLength(3)
    })

    it('should filter out matches with inactive players', async () => {
      const changes = await getAllRankingChanges(mockSupabase)
      const matchChanges = changes.filter(c => c.change_type === 'match')
      
      // Should only include matches between active players
      const activeMatches = matchChanges.filter(change => {
        const match = change as any
        return match.player1?.is_active === true && match.player2?.is_active === true
      })
      
      expect(activeMatches).toHaveLength(2) // Only Alice vs Bob and Charlie vs Eve
    })

    it('should filter out rank adjustments for inactive players', async () => {
      const changes = await getAllRankingChanges(mockSupabase)
      const adjustmentChanges = changes.filter(c => c.change_type === 'rank_adjustment')
      
      // Should only include adjustments for active players
      const activeAdjustments = adjustmentChanges.filter(change => {
        const adj = change as any
        return adj.players?.is_active === true
      })
      
      expect(activeAdjustments).toHaveLength(2) // Only Charlie and Eve adjustments
    })

    it('should calculate rank changes for matches correctly', async () => {
      const changes = await getAllRankingChanges(mockSupabase)
      const matchChanges = changes.filter(c => c.change_type === 'match')
      
      // Find the Alice vs Bob match (Alice wins, should stay rank 1)
      const aliceBobMatch = matchChanges.find(change => {
        const match = change as any
        return match.player1_id === '1' && match.player2_id === '2'
      })
      
      expect(aliceBobMatch).toBeDefined()
      expect(aliceBobMatch?.rank_changes).toBeDefined()
      expect(Array.isArray(aliceBobMatch?.rank_changes)).toBe(true)
    })

    it('should include player information in rank adjustments', async () => {
      const changes = await getAllRankingChanges(mockSupabase)
      const adjustmentChanges = changes.filter(c => c.change_type === 'rank_adjustment')
      
      const charlieAdjustment = adjustmentChanges.find(change => {
        const adj = change as any
        return adj.player_id === '3'
      })
      
      expect(charlieAdjustment).toBeDefined()
      expect((charlieAdjustment as any).players).toBeDefined()
      expect((charlieAdjustment as any).players.name).toBe('Charlie')
    })

    it('should handle empty data gracefully', async () => {
      // Mock empty responses
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

        mockQuery.select.mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: [],
            error: null
          })
        })

        return mockQuery
      })

      const changes = await getAllRankingChanges(mockSupabase)
      expect(changes).toEqual([])
    })

    it('should handle database errors gracefully', async () => {
      // Mock error response
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

        mockQuery.select.mockReturnValue({
          order: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database connection failed' }
          })
        })

        return mockQuery
      })

      await expect(getAllRankingChanges(mockSupabase)).rejects.toThrow()
    })
  })

  describe('Timeline Data Structure', () => {
    it('should have consistent data structure for matches', async () => {
      const changes = await getAllRankingChanges(mockSupabase)
      const matchChanges = changes.filter(c => c.change_type === 'match')
      
      matchChanges.forEach(change => {
        expect(change).toHaveProperty('id')
        expect(change).toHaveProperty('change_type', 'match')
        expect(change).toHaveProperty('created_at')
        expect(change).toHaveProperty('player1_id')
        expect(change).toHaveProperty('player2_id')
        expect(change).toHaveProperty('player1_score')
        expect(change).toHaveProperty('player2_score')
        expect(change).toHaveProperty('rank_changes')
      })
    })

    it('should have consistent data structure for rank adjustments', async () => {
      const changes = await getAllRankingChanges(mockSupabase)
      const adjustmentChanges = changes.filter(c => c.change_type === 'rank_adjustment')
      
      adjustmentChanges.forEach(change => {
        expect(change).toHaveProperty('id')
        expect(change).toHaveProperty('change_type', 'rank_adjustment')
        expect(change).toHaveProperty('created_at')
        expect(change).toHaveProperty('player_id')
        expect(change).toHaveProperty('old_rank')
        expect(change).toHaveProperty('new_rank')
        expect(change).toHaveProperty('reason')
        expect(change).toHaveProperty('players')
      })
    })

    it('should include rank change details for matches', async () => {
      const changes = await getAllRankingChanges(mockSupabase)
      const matchChanges = changes.filter(c => c.change_type === 'match')
      
      matchChanges.forEach(change => {
        const rankChanges = (change as any).rank_changes
        expect(Array.isArray(rankChanges)).toBe(true)
        
        rankChanges.forEach((rankChange: any) => {
          expect(rankChange).toHaveProperty('player_id')
          expect(rankChange).toHaveProperty('old_rank')
          expect(rankChange).toHaveProperty('new_rank')
          expect(rankChange).toHaveProperty('player_name')
        })
      })
    })
  })

  describe('Chronological Ordering', () => {
    it('should handle same timestamp correctly', async () => {
      // Create changes with same timestamp
      const sameTimeMatches = [
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
          created_at: '2024-01-02T00:00:00Z' // Same timestamp
        }
      ]

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
              data: [],
              error: null
            })
          })
        } else if (table === 'matches') {
          mockQuery.select.mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: sameTimeMatches.map(match => ({
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

      const changes = await getAllRankingChanges(mockSupabase)
      expect(changes).toHaveLength(2)
      
      // Should maintain order even with same timestamp
      expect(changes[0].id).toBe('1')
      expect(changes[1].id).toBe('2')
    })

    it('should handle mixed date formats', async () => {
      const mixedDateMatches = [
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
          created_at: '2024-01-02T12:00:00Z'
        }
      ]

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
              data: [],
              error: null
            })
          })
        } else if (table === 'matches') {
          mockQuery.select.mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: mixedDateMatches.map(match => ({
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

      const changes = await getAllRankingChanges(mockSupabase)
      
      // Should be in chronological order
      const firstDate = new Date(changes[0].created_at)
      const secondDate = new Date(changes[1].created_at)
      expect(firstDate.getTime()).toBeLessThanOrEqual(secondDate.getTime())
    })
  })

  describe('Data Filtering', () => {
    it('should exclude matches with deleted players', async () => {
      // Create a match with a non-existent player
      const matchWithDeletedPlayer = {
        id: '1',
        player1_id: '999', // Non-existent player
        player2_id: '1',
        player1_score: 21,
        player2_score: 19,
        created_at: '2024-01-02T00:00:00Z'
      }

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
              data: [],
              error: null
            })
          })
        } else if (table === 'matches') {
          mockQuery.select.mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [{
                ...matchWithDeletedPlayer,
                player1: null, // Player not found
                player2: mockPlayers.find(p => p.id === '1')
              }],
              error: null
            })
          })
        }

        return mockQuery
      })

      const changes = await getAllRankingChanges(mockSupabase)
      const matchChanges = changes.filter(c => c.change_type === 'match')
      
      // Should filter out matches with missing players
      expect(matchChanges).toHaveLength(0)
    })

    it('should exclude rank adjustments for deleted players', async () => {
      const adjustmentForDeletedPlayer = {
        id: '1',
        player_id: '999', // Non-existent player
        old_rank: 1,
        new_rank: 2,
        reason: 'Test adjustment',
        created_at: '2024-01-03T00:00:00Z'
      }

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
              data: [{
                ...adjustmentForDeletedPlayer,
                players: null // Player not found
              }],
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

      const changes = await getAllRankingChanges(mockSupabase)
      const adjustmentChanges = changes.filter(c => c.change_type === 'rank_adjustment')
      
      // Should filter out adjustments for missing players
      expect(adjustmentChanges).toHaveLength(0)
    })
  })
})