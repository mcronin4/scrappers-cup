'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Player } from '@/lib/types/database'

interface InitialRankingsManagerProps {
  players: Player[]
}

export default function InitialRankingsManager({ players: initialPlayers }: InitialRankingsManagerProps) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [rankings, setRankings] = useState<{ [playerId: string]: number }>({})
  const supabase = createClient()

  useEffect(() => {
    setPlayers(initialPlayers)
    // Initialize rankings with current ranks
    const initialRankings: { [playerId: string]: number } = {}
    initialPlayers.forEach(player => {
      initialRankings[player.id] = player.current_rank
    })
    setRankings(initialRankings)
  }, [initialPlayers])

  const handleRankChange = (playerId: string, newRank: number) => {
    const newRankings = { ...rankings }
    newRankings[playerId] = newRank
    setRankings(newRankings)
  }

  const handleSetInitialRankings = async () => {
    if (!confirm('This will clear ALL matches and reset all player positions to your new settings. This action cannot be undone. Are you sure?')) {
      return
    }

    setLoading(true)
    setMessage('')

    try {
      // Validate that all ranks are unique and sequential
      const rankValues = Object.values(rankings)
      const uniqueRanks = new Set(rankValues)
      
      if (uniqueRanks.size !== rankValues.length) {
        throw new Error('All ranks must be unique')
      }

      const minRank = Math.min(...rankValues)
      const maxRank = Math.max(...rankValues)
      
      if (minRank !== 1 || maxRank !== players.length) {
        throw new Error(`Ranks must be from 1 to ${players.length}`)
      }

      // Clear all matches and ranking events
      const { clearAllData } = await import('@/lib/utils/events')
      await clearAllData(supabase)

      // Update all players with new initial_rank and current_rank
      for (const player of players) {
        const newRank = rankings[player.id]
        if (newRank) {
          const { error: updateError } = await supabase
            .from('players')
            .update({ 
              initial_rank: newRank,
              current_rank: newRank 
            })
            .eq('id', player.id)

          if (updateError) {
            throw updateError
          }
        }
      }

      setMessage('Player positions set successfully! All matches have been cleared.')
      
      // Refresh the page to show updated data
      setTimeout(() => window.location.reload(), 2000)

    } catch (error: unknown) {
      console.error('Error setting initial rankings:', error)
      setMessage(`Error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`)
    } finally {
      setLoading(false)
    }
  }

  const sortedPlayers = players.sort((a, b) => a.current_rank - b.current_rank)

  return (
    <div className="space-y-6">
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-red-800 mb-2">⚠️ Set Initial Rankings</h3>
        <p className="text-sm text-red-700">
          This will clear ALL existing matches and ranking events, then set the initial rankings for all players. 
          This is typically done once at the start of a tournament. This action cannot be undone.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Set Initial Rankings</h2>
        
        <div className="space-y-4">
          {sortedPlayers.map((player, index) => (
            <div key={player.id} className="flex items-center space-x-4 p-3 border border-gray-200 rounded-lg">
              <div className="w-8 text-sm font-medium text-gray-500">
                {index + 1}.
              </div>
              <div className="flex-1">
                <div className="font-medium text-gray-900">{player.name}</div>
                <div className="text-sm text-gray-500">Current: #{player.current_rank}</div>
              </div>
              <div className="flex items-center space-x-2">
                <label className="text-sm font-medium text-gray-700">Rank:</label>
                <input
                  type="number"
                  min="1"
                  max={players.length}
                  value={rankings[player.id] || player.current_rank}
                  onChange={(e) => handleRankChange(player.id, parseInt(e.target.value) || 1)}
                  className="w-16 px-2 py-1 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSetInitialRankings}
            disabled={loading}
            className="bg-red-600 text-white py-2 px-6 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Setting Initial Rankings...' : 'Set Initial Rankings'}
          </button>
        </div>
      </div>

      {message && (
        <div className={`text-center text-sm ${
          message.startsWith('Error') ? 'text-red-600' : 'text-green-600'
        }`}>
          {message}
        </div>
      )}
    </div>
  )
}
