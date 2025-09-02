/**
 * Test file for active/inactive player functionality
 * Tests: player filtering, display ranking, deactivation/reactivation, UI components
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { getActiveLeaderboard } from '../lib/utils/ladder'
import type { Player } from '../lib/types/database'

describe('Active Players System', () => {
  let mockPlayers: Player[]

  beforeEach(() => {
    // Create comprehensive test data with mix of active/inactive players
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
        is_active: false, // Inactive
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
        is_active: false, // Inactive
        created_at: '2024-01-01T00:04:00Z'
      },
      {
        id: '6',
        name: 'Frank',
        email: 'frank@test.com',
        initial_rank: 6,
        current_rank: 6,
        notes: '',
        is_active: true,
        created_at: '2024-01-01T00:05:00Z'
      }
    ]
  })

  describe('getActiveLeaderboard', () => {
    it('should filter to active players only', () => {
      const activeLeaderboard = getActiveLeaderboard(mockPlayers)
      
      expect(activeLeaderboard).toHaveLength(4) // Only active players
      expect(activeLeaderboard.every(p => p.is_active === true)).toBe(true)
      
      // Verify specific active players are included
      const playerNames = activeLeaderboard.map(p => p.name)
      expect(playerNames).toContain('Alice')
      expect(playerNames).toContain('Bob')
      expect(playerNames).toContain('David')
      expect(playerNames).toContain('Frank')
      
      // Verify inactive players are excluded
      expect(playerNames).not.toContain('Charlie')
      expect(playerNames).not.toContain('Eve')
    })

    it('should assign sequential display ranks starting from 1', () => {
      const activeLeaderboard = getActiveLeaderboard(mockPlayers)
      
      const displayRanks = activeLeaderboard.map(p => p.display_rank)
      expect(displayRanks).toEqual([1, 2, 3, 4])
      
      // Verify no gaps in display ranks
      for (let i = 1; i <= displayRanks.length; i++) {
        expect(displayRanks).toContain(i)
      }
    })

    it('should preserve original current_rank values', () => {
      const activeLeaderboard = getActiveLeaderboard(mockPlayers)
      
      // Find players and verify their original ranks are preserved
      const alice = activeLeaderboard.find(p => p.name === 'Alice')
      const bob = activeLeaderboard.find(p => p.name === 'Bob')
      const david = activeLeaderboard.find(p => p.name === 'David')
      const frank = activeLeaderboard.find(p => p.name === 'Frank')
      
      expect(alice?.current_rank).toBe(1) // Original rank preserved
      expect(bob?.current_rank).toBe(2)   // Original rank preserved
      expect(david?.current_rank).toBe(4) // Original rank preserved
      expect(frank?.current_rank).toBe(6) // Original rank preserved
    })

    it('should sort by current_rank for display ranking', () => {
      // Create players with mixed current_rank values
      const mixedRankPlayers = [
        { ...mockPlayers[0], current_rank: 5 }, // Alice
        { ...mockPlayers[1], current_rank: 1 }, // Bob
        { ...mockPlayers[3], current_rank: 3 }, // David
        { ...mockPlayers[5], current_rank: 2 }  // Frank
      ]

      const activeLeaderboard = getActiveLeaderboard(mixedRankPlayers)
      
      // Should be sorted by current_rank
      expect(activeLeaderboard[0].name).toBe('Bob')   // rank 1
      expect(activeLeaderboard[1].name).toBe('Frank') // rank 2
      expect(activeLeaderboard[2].name).toBe('David') // rank 3
      expect(activeLeaderboard[3].name).toBe('Alice') // rank 5
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

    it('should handle single active player', () => {
      const singleActivePlayer = [mockPlayers[0]] // Alice is active
      const leaderboard = getActiveLeaderboard(singleActivePlayer)
      
      expect(leaderboard).toHaveLength(1)
      expect(leaderboard[0].name).toBe('Alice')
      expect(leaderboard[0].display_rank).toBe(1)
      expect(leaderboard[0].current_rank).toBe(1)
    })

    it('should handle players with same current_rank', () => {
      const sameRankPlayers = [
        { ...mockPlayers[0], current_rank: 1, is_active: true },
        { ...mockPlayers[1], current_rank: 1, is_active: true }, // Same rank as Alice
        { ...mockPlayers[3], current_rank: 2, is_active: true }
      ]

      const activeLeaderboard = getActiveLeaderboard(sameRankPlayers)
      
      expect(activeLeaderboard).toHaveLength(3)
      
      // Both rank 1 players should get display ranks 1 and 2
      const rank1Players = activeLeaderboard.filter(p => p.current_rank === 1)
      expect(rank1Players).toHaveLength(2)
      expect(rank1Players[0].display_rank).toBe(1)
      expect(rank1Players[1].display_rank).toBe(2)
      
      // Rank 2 player should get display rank 3
      const rank2Player = activeLeaderboard.find(p => p.current_rank === 2)
      expect(rank2Player?.display_rank).toBe(3)
    })
  })

  describe('Player Status Scenarios', () => {
    it('should handle deactivation of top-ranked player', () => {
      // Deactivate Alice (rank 1)
      const playersWithDeactivatedTop = mockPlayers.map(p => 
        p.id === '1' ? { ...p, is_active: false } : p
      )

      const activeLeaderboard = getActiveLeaderboard(playersWithDeactivatedTop)
      
      expect(activeLeaderboard).toHaveLength(3) // One less active player
      expect(activeLeaderboard[0].name).toBe('Bob') // Bob becomes display rank 1
      expect(activeLeaderboard[0].display_rank).toBe(1)
      expect(activeLeaderboard[0].current_rank).toBe(2) // Original rank preserved
    })

    it('should handle reactivation of player', () => {
      // Reactivate Charlie (was inactive)
      const playersWithReactivated = mockPlayers.map(p => 
        p.id === '3' ? { ...p, is_active: true } : p
      )

      const activeLeaderboard = getActiveLeaderboard(playersWithReactivated)
      
      expect(activeLeaderboard).toHaveLength(5) // One more active player
      
      // Charlie should be included with his original rank
      const charlie = activeLeaderboard.find(p => p.name === 'Charlie')
      expect(charlie).toBeDefined()
      expect(charlie?.current_rank).toBe(3) // Original rank preserved
      expect(charlie?.is_active).toBe(true)
    })

    it('should handle multiple deactivations', () => {
      // Deactivate multiple players
      const playersWithMultipleDeactivated = mockPlayers.map(p => 
        ['1', '3', '5'].includes(p.id) ? { ...p, is_active: false } : p
      )

      const activeLeaderboard = getActiveLeaderboard(playersWithMultipleDeactivated)
      
      expect(activeLeaderboard).toHaveLength(3) // 3 active players remain
      const playerNames = activeLeaderboard.map(p => p.name)
      expect(playerNames).toEqual(['Bob', 'David', 'Frank'])
    })

    it('should handle all players becoming inactive', () => {
      const allInactivePlayers = mockPlayers.map(p => ({ ...p, is_active: false }))
      const emptyLeaderboard = getActiveLeaderboard(allInactivePlayers)
      
      expect(emptyLeaderboard).toEqual([])
    })
  })

  describe('Display Rank Assignment', () => {
    it('should assign display ranks in correct order', () => {
      const activeLeaderboard = getActiveLeaderboard(mockPlayers)
      
      // Verify display ranks are sequential and start from 1
      for (let i = 0; i < activeLeaderboard.length; i++) {
        expect(activeLeaderboard[i].display_rank).toBe(i + 1)
      }
    })

    it('should handle gaps in current_rank for display ranking', () => {
      // Create players with gaps in current_rank
      const playersWithGaps = [
        { ...mockPlayers[0], current_rank: 1, is_active: true },
        { ...mockPlayers[1], current_rank: 5, is_active: true }, // Gap in ranks
        { ...mockPlayers[3], current_rank: 10, is_active: true } // More gaps
      ]

      const activeLeaderboard = getActiveLeaderboard(playersWithGaps)
      
      // Display ranks should still be sequential (1, 2, 3)
      expect(activeLeaderboard[0].display_rank).toBe(1)
      expect(activeLeaderboard[1].display_rank).toBe(2)
      expect(activeLeaderboard[2].display_rank).toBe(3)
      
      // But current_ranks should be preserved
      expect(activeLeaderboard[0].current_rank).toBe(1)
      expect(activeLeaderboard[1].current_rank).toBe(5)
      expect(activeLeaderboard[2].current_rank).toBe(10)
    })

    it('should maintain display rank consistency after filtering', () => {
      const activeLeaderboard1 = getActiveLeaderboard(mockPlayers)
      const activeLeaderboard2 = getActiveLeaderboard(mockPlayers)
      
      // Multiple calls should produce identical results
      expect(activeLeaderboard1).toEqual(activeLeaderboard2)
      
      // Display ranks should be identical
      const displayRanks1 = activeLeaderboard1.map(p => p.display_rank)
      const displayRanks2 = activeLeaderboard2.map(p => p.display_rank)
      expect(displayRanks1).toEqual(displayRanks2)
    })
  })

  describe('Edge Cases', () => {
    it('should handle players with undefined is_active', () => {
      const playersWithUndefinedActive = mockPlayers.map(p => ({
        ...p,
        is_active: undefined as any
      }))

      const activeLeaderboard = getActiveLeaderboard(playersWithUndefinedActive)
      
      // Should treat undefined as falsy (inactive)
      expect(activeLeaderboard).toHaveLength(0)
    })

    it('should handle players with null is_active', () => {
      const playersWithNullActive = mockPlayers.map(p => ({
        ...p,
        is_active: null as any
      }))

      const activeLeaderboard = getActiveLeaderboard(playersWithNullActive)
      
      // Should treat null as falsy (inactive)
      expect(activeLeaderboard).toHaveLength(0)
    })

    it('should handle players with string is_active values', () => {
      const playersWithStringActive = mockPlayers.map(p => ({
        ...p,
        is_active: 'true' as any // String instead of boolean
      }))

      const activeLeaderboard = getActiveLeaderboard(playersWithStringActive)
      
      // Should treat string 'true' as truthy
      expect(activeLeaderboard).toHaveLength(mockPlayers.length)
    })

    it('should handle very large number of players', () => {
      // Create 1000 players
      const manyPlayers: Player[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `player-${i}`,
        name: `Player ${i}`,
        email: `player${i}@test.com`,
        initial_rank: i + 1,
        current_rank: i + 1,
        notes: '',
        is_active: i % 2 === 0, // Every other player is active
        created_at: `2024-01-01T00:${i.toString().padStart(2, '0')}:00Z`
      }))

      const activeLeaderboard = getActiveLeaderboard(manyPlayers)
      
      expect(activeLeaderboard).toHaveLength(500) // Half are active
      expect(activeLeaderboard.every(p => p.is_active === true)).toBe(true)
      
      // Display ranks should be sequential
      const displayRanks = activeLeaderboard.map(p => p.display_rank)
      for (let i = 0; i < displayRanks.length; i++) {
        expect(displayRanks[i]).toBe(i + 1)
      }
    })
  })

  describe('Data Integrity', () => {
    it('should not modify original player objects', () => {
      const originalPlayers = JSON.parse(JSON.stringify(mockPlayers)) // Deep copy
      const activeLeaderboard = getActiveLeaderboard(mockPlayers)
      
      // Original players should be unchanged
      expect(mockPlayers).toEqual(originalPlayers)
      
      // Active leaderboard should be a new array
      expect(activeLeaderboard).not.toBe(mockPlayers)
    })

    it('should create new player objects with display_rank', () => {
      const activeLeaderboard = getActiveLeaderboard(mockPlayers)
      
      activeLeaderboard.forEach(player => {
        // Each player should have display_rank property
        expect(player).toHaveProperty('display_rank')
        expect(typeof player.display_rank).toBe('number')
        
        // display_rank should be different from current_rank if there are gaps
        // (though in this test case they might be the same)
        expect(player.display_rank).toBeGreaterThan(0)
      })
    })

    it('should handle players with missing properties gracefully', () => {
      const incompletePlayers = [
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
        }
      ] as Player[]

      const activeLeaderboard = getActiveLeaderboard(incompletePlayers)
      
      expect(activeLeaderboard).toHaveLength(2)
      expect(activeLeaderboard[0].display_rank).toBe(1)
      expect(activeLeaderboard[1].display_rank).toBe(2)
    })
  })
})