/**
 * Simple test to verify the test setup is working
 */

import { describe, it, expect } from 'vitest'

describe('Test Setup Verification', () => {
  it('should run basic tests', () => {
    expect(1 + 1).toBe(2)
  })

  it('should handle async operations', async () => {
    const result = await Promise.resolve('test')
    expect(result).toBe('test')
  })

  it('should work with objects', () => {
    const player = {
      id: '1',
      name: 'Test Player',
      current_rank: 1,
      initial_rank: 1,
    }
    
    expect(player.name).toBe('Test Player')
    expect(player.id).toBe('1')
    expect(player.current_rank).toBe(1)
    expect(player.initial_rank).toBe(1)
  })
})