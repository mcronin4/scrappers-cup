'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Player } from '@/lib/types/database'
import { recordManualAdjustment, rebuildAllRankings } from '@/lib/utils/events'

interface RankingManagerProps {
  players: Player[]
}

export default function RankingManager({ players }: RankingManagerProps) {
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [newRank, setNewRank] = useState('')
  const [reason, setReason] = useState('')
  const supabase = createClient()

  const sortedPlayers = players.sort((a, b) => a.current_rank - b.current_rank)

  const handleManualAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      if (!selectedPlayer || !newRank) {
        throw new Error('Please select a player and enter a new rank')
      }

      const player = players.find(p => p.id === selectedPlayer)
      if (!player) {
        throw new Error('Player not found')
      }

      const oldRank = player.current_rank
      const targetRank = parseInt(newRank)

      if (targetRank < 1 || targetRank > players.length) {
        throw new Error(`Rank must be between 1 and ${players.length}`)
      }

      // Record the manual adjustment event
      await recordManualAdjustment(supabase, selectedPlayer, oldRank, targetRank, reason || 'Manual adjustment')

      // Rebuild all rankings from initial state to apply this adjustment
      await rebuildAllRankings(supabase)

      setMessage('Player position updated successfully!')
      setSelectedPlayer('')
      setNewRank('')
      setReason('')

      // Refresh page
      setTimeout(() => window.location.reload(), 1000)

    } catch (error: unknown) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Manual Rank Adjustment */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-6">Move Player Position</h2>
        <p className="text-sm text-gray-600 mb-6">
          Move a player to a different position. This will automatically adjust all other players' positions accordingly.
        </p>
        
        <form onSubmit={handleManualAdjustment} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Player
              </label>
              <select
                value={selectedPlayer}
                onChange={(e) => setSelectedPlayer(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              >
                <option value="">Select Player</option>
                {sortedPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name} (Current: #{player.current_rank})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                New Position
              </label>
              <input
                type="number"
                min="1"
                max={players.length}
                value={newRank}
                onChange={(e) => setNewRank(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter new position"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reason (Optional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Reason for adjustment"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Adjusting Rank...' : 'Adjust Rank'}
          </button>
        </form>
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
