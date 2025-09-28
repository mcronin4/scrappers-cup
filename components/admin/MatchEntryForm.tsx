'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Player, Match } from '@/lib/types/database'
import { determineMatchWinner } from '@/lib/utils/ladder'
import { useRouter } from 'next/navigation'

interface MatchEntryFormProps {
  players: Player[]
  onMatchAdded?: () => void
}

export default function MatchEntryForm({ players, onMatchAdded }: MatchEntryFormProps) {
  // Sort players by current rank
  const sortedPlayers = players.sort((a, b) => a.current_rank - b.current_rank)
  
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const [formData, setFormData] = useState({
    player1_id: '',
    player2_id: '',
    date_played: new Date().toISOString().split('T')[0],
    set1_p1_games: 0,
    set1_p2_games: 0,
    set2_p1_games: 0,
    set2_p2_games: 0,
    tiebreaker_p1_points: '',
    tiebreaker_p2_points: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('Validating match data...')

    try {
      // Validate form
      if (!formData.player1_id || !formData.player2_id) {
        throw new Error('Please select both players')
      }

      if (formData.player1_id === formData.player2_id) {
        throw new Error('Players must be different')
      }

      // Determine set winners
      const set1_winner = (formData.set1_p1_games > formData.set1_p2_games ? 1 : 2) as 1 | 2
      const set2_winner = (formData.set2_p1_games > formData.set2_p2_games ? 1 : 2) as 1 | 2

      // Prepare match data - use date_played for display, created_at will be used for ordering
      const matchData = {
        player1_id: formData.player1_id,
        player2_id: formData.player2_id,
        date_played: formData.date_played, // Keep as date for display purposes
        set1_winner,
        set1_p1_games: formData.set1_p1_games,
        set1_p2_games: formData.set1_p2_games,
        set2_winner,
        set2_p1_games: formData.set2_p1_games,
        set2_p2_games: formData.set2_p2_games,
        tiebreaker_winner: null as 1 | 2 | null,
        tiebreaker_p1_points: null as number | null,
        tiebreaker_p2_points: null as number | null,
      }

      // Handle tiebreaker if both sets won by different players
      if (set1_winner !== set2_winner) {
        if (!formData.tiebreaker_p1_points || !formData.tiebreaker_p2_points) {
          throw new Error('Tiebreaker scores required when sets are split 1-1')
        }
        
        const tbP1 = parseInt(formData.tiebreaker_p1_points)
        const tbP2 = parseInt(formData.tiebreaker_p2_points)
        
        matchData.tiebreaker_winner = (tbP1 > tbP2 ? 1 : 2) as 1 | 2
        matchData.tiebreaker_p1_points = tbP1
        matchData.tiebreaker_p2_points = tbP2
      }

      // Determine match winner
      const match_winner = determineMatchWinner({
        ...matchData,
        id: '', // Temporary ID, will be set by database
        created_at: new Date().toISOString() // Temporary timestamp, will be set by database
      })
      const finalMatchData = { ...matchData, match_winner }

      // Insert match and get the created match data with ID
      const { data: insertedMatch, error: matchError } = await supabase
        .from('matches')
        .insert([finalMatchData])
        .select()
        .single()

      if (matchError) {
        throw matchError
      }

      console.log('Inserted match with ID:', insertedMatch.id)

      setMessage('Updating player positions...')

      // Record match event and rebuild all rankings
      const { recordMatchEvent, rebuildAllRankings } = await import('@/lib/utils/events')
      
      // Record the match event with the actual match ID
      await recordMatchEvent(supabase, insertedMatch)
      
      setMessage('Calculating new rankings...')
      
      // Rebuild all rankings from initial state
      await rebuildAllRankings(supabase)

      setMessage('Match recorded successfully!')
      setFormData({
        player1_id: '',
        player2_id: '',
        date_played: new Date().toISOString().split('T')[0],
        set1_p1_games: 0,
        set1_p2_games: 0,
        set2_p1_games: 0,
        set2_p2_games: 0,
        tiebreaker_p1_points: '',
        tiebreaker_p2_points: '',
      })

      // Notify parent component to refresh data
      if (onMatchAdded) {
        onMatchAdded()
      }

    } catch (error: unknown) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`)
    } finally {
      setLoading(false)
    }
  }

  const needsTiebreaker = () => {
    // Only show tiebreaker if both sets are completed (have non-zero scores)
    const set1Completed = formData.set1_p1_games > 0 || formData.set1_p2_games > 0
    const set2Completed = formData.set2_p1_games > 0 || formData.set2_p2_games > 0
    
    if (!set1Completed || !set2Completed) {
      return false
    }
    
    const set1Winner = formData.set1_p1_games > formData.set1_p2_games ? 1 : 2
    const set2Winner = formData.set2_p1_games > formData.set2_p2_games ? 1 : 2
    return set1Winner !== set2Winner
  }

  return (
    <div className="bg-white rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Enter Match Result</h2>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Player 1
            </label>
            <select
              value={formData.player1_id}
              onChange={(e) => setFormData({ ...formData, player1_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select Player 1</option>
              {sortedPlayers.map((player) => (
                <                option key={player.id} value={player.id}>
                  {player.name} (#{player.current_rank})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Player 2
            </label>
            <select
              value={formData.player2_id}
              onChange={(e) => setFormData({ ...formData, player2_id: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            >
              <option value="">Select Player 2</option>
              {sortedPlayers.map((player) => (
                <                option key={player.id} value={player.id}>
                  {player.name} (#{player.current_rank})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date Played
          </label>
          <input
            type="date"
            value={formData.date_played}
            onChange={(e) => setFormData({ ...formData, date_played: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Set 1</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Player 1 Games
                </label>
                <select
                  value={formData.set1_p1_games}
                  onChange={(e) => setFormData({ ...formData, set1_p1_games: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Player 2 Games
                </label>
                <select
                  value={formData.set1_p2_games}
                  onChange={(e) => setFormData({ ...formData, set1_p2_games: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900">Set 2</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Player 1 Games
                </label>
                <select
                  value={formData.set2_p1_games}
                  onChange={(e) => setFormData({ ...formData, set2_p1_games: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Player 2 Games
                </label>
                <select
                  value={formData.set2_p2_games}
                  onChange={(e) => setFormData({ ...formData, set2_p2_games: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                    <option key={num} value={num}>{num}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {needsTiebreaker() && (
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Tiebreaker Required (Sets Split 1-1)</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Player 1 Tiebreaker Points
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.tiebreaker_p1_points}
                  onChange={(e) => setFormData({ ...formData, tiebreaker_p1_points: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={needsTiebreaker()}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Player 2 Tiebreaker Points
                </label>
                <input
                  type="number"
                  min="0"
                  value={formData.tiebreaker_p2_points}
                  onChange={(e) => setFormData({ ...formData, tiebreaker_p2_points: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required={needsTiebreaker()}
                />
              </div>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Recording Match...' : 'Record Match'}
        </button>

        {message && (
          <div className={`text-center text-sm ${
            message.startsWith('Error') ? 'text-red-600' : 'text-green-600'
          }`}>
            {message}
          </div>
        )}
      </form>
    </div>
  )
}