'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MatchWithPlayers, Match } from '@/lib/types/database'
// import { useRouter } from 'next/navigation'
import { determineMatchWinner } from '@/lib/utils/ladder'

interface MatchHistoryProps {
  matches: MatchWithPlayers[]
}

export default function MatchHistory({ matches: initialMatches }: MatchHistoryProps) {
  const [matches, setMatches] = useState<MatchWithPlayers[]>(initialMatches)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [editingMatch, setEditingMatch] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    date_played: '',
    set1_p1_games: 0,
    set1_p2_games: 0,
    set2_p1_games: 0,
    set2_p2_games: 0,
    tiebreaker_p1_points: '',
    tiebreaker_p2_points: '',
  })
  // const router = useRouter()
  const supabase = createClient()

  const handleEditMatch = (match: MatchWithPlayers) => {
    setEditingMatch(match.id)
    setEditForm({
      date_played: match.date_played,
      set1_p1_games: match.set1_p1_games,
      set1_p2_games: match.set1_p2_games,
      set2_p1_games: match.set2_p1_games,
      set2_p2_games: match.set2_p2_games,
      tiebreaker_p1_points: match.tiebreaker_p1_points?.toString() || '',
      tiebreaker_p2_points: match.tiebreaker_p2_points?.toString() || '',
    })
  }

  const handleSaveEdit = async () => {
    if (!editingMatch) return

    setLoading(true)
    try {
      // Determine set winners
      const set1_winner = editForm.set1_p1_games > editForm.set1_p2_games ? 1 as const : 2 as const
      const set2_winner = editForm.set2_p1_games > editForm.set2_p2_games ? 1 as const : 2 as const

      // Get the current match to preserve required fields
      const currentMatch = matches.find(m => m.id === editingMatch)
      if (!currentMatch) {
        throw new Error('Match not found')
      }

      // Prepare match data with all required fields
      const matchData = {
        id: currentMatch.id,
        player1_id: currentMatch.player1_id,
        player2_id: currentMatch.player2_id,
        date_played: editForm.date_played,
        set1_winner,
        set1_p1_games: editForm.set1_p1_games,
        set1_p2_games: editForm.set1_p2_games,
        set2_winner,
        set2_p1_games: editForm.set2_p1_games,
        set2_p2_games: editForm.set2_p2_games,
        tiebreaker_winner: null as (1 | 2) | null,
        tiebreaker_p1_points: null as number | null,
        tiebreaker_p2_points: null as number | null,
        created_at: currentMatch.created_at,
      }

      // Handle tiebreaker if both sets won by different players
      if (set1_winner !== set2_winner) {
        if (!editForm.tiebreaker_p1_points || !editForm.tiebreaker_p2_points) {
          throw new Error('Tiebreaker scores required when sets are split 1-1')
        }
        
        const tbP1 = parseInt(editForm.tiebreaker_p1_points)
        const tbP2 = parseInt(editForm.tiebreaker_p2_points)
        
        matchData.tiebreaker_winner = tbP1 > tbP2 ? 1 as const : 2 as const
        matchData.tiebreaker_p1_points = tbP1
        matchData.tiebreaker_p2_points = tbP2
      }

      // Determine match winner
      const match_winner = determineMatchWinner(matchData)
      const finalMatchData = { ...matchData, match_winner }

      // Update match in database (exclude id, player1_id, player2_id, created_at from update)
      const updateData = {
        date_played: finalMatchData.date_played,
        set1_winner: finalMatchData.set1_winner,
        set1_p1_games: finalMatchData.set1_p1_games,
        set1_p2_games: finalMatchData.set1_p2_games,
        set2_winner: finalMatchData.set2_winner,
        set2_p1_games: finalMatchData.set2_p1_games,
        set2_p2_games: finalMatchData.set2_p2_games,
        tiebreaker_winner: finalMatchData.tiebreaker_winner,
        tiebreaker_p1_points: finalMatchData.tiebreaker_p1_points,
        tiebreaker_p2_points: finalMatchData.tiebreaker_p2_points,
        match_winner: finalMatchData.match_winner,
      }
      const { error: matchError } = await supabase
        .from('matches')
        .update(updateData)
        .eq('id', editingMatch)

      if (matchError) {
        throw matchError
      }

      // Recalculate ladder rankings for all players
      const { data: allPlayers, error: playersError } = await supabase
        .from('players')
        .select('*')
        .order('current_rank', { ascending: true })

      if (playersError) {
        throw playersError
      }

      if (allPlayers) {
        // Reset all players to initial ranks, then recalculate from all matches
        const { data: allMatches } = await supabase
          .from('matches')
          .select('*')
          .order('date_played', { ascending: true })

        if (allMatches) {
          // Reset ranks to initial
          let currentPlayers = allPlayers.map(p => ({ ...p, current_rank: p.initial_rank }))
          
          // Apply all matches in chronological order
          const { updateLadderRankings } = await import('@/lib/utils/ladder')
          for (const match of allMatches) {
            currentPlayers = updateLadderRankings(currentPlayers, match as Match)
          }

          // Update all player rankings in database
          for (const player of currentPlayers) {
            const { error: updateError } = await supabase
              .from('players')
              .update({ current_rank: player.current_rank })
              .eq('id', player.id)

            if (updateError) {
              console.error('Error updating player rank:', updateError)
            }
          }
        }
      }

      setMessage('Match updated successfully! Rankings recalculated.')
      setEditingMatch(null)
      setEditForm({
        date_played: '',
        set1_p1_games: 0,
        set1_p2_games: 0,
        set2_p1_games: 0,
        set2_p2_games: 0,
        tiebreaker_p1_points: '',
        tiebreaker_p2_points: '',
      })

      // Update local state
      setMatches(matches.map(m => 
        m.id === editingMatch 
          ? { 
              ...m, 
              date_played: editForm.date_played,
              set1_winner: finalMatchData.set1_winner,
              set1_p1_games: finalMatchData.set1_p1_games,
              set1_p2_games: finalMatchData.set1_p2_games,
              set2_winner: finalMatchData.set2_winner,
              set2_p1_games: finalMatchData.set2_p1_games,
              set2_p2_games: finalMatchData.set2_p2_games,
              tiebreaker_winner: finalMatchData.tiebreaker_winner,
              tiebreaker_p1_points: finalMatchData.tiebreaker_p1_points,
              tiebreaker_p2_points: finalMatchData.tiebreaker_p2_points,
              match_winner: finalMatchData.match_winner
            }
          : m
      ))

    } catch (error: unknown) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingMatch(null)
    setEditForm({
      date_played: '',
      set1_p1_games: 0,
      set1_p2_games: 0,
      set2_p1_games: 0,
      set2_p2_games: 0,
      tiebreaker_p1_points: '',
      tiebreaker_p2_points: '',
    })
  }

  const handleDeleteMatch = async (matchId: string) => {
    if (!confirm('Are you sure you want to delete this match? This will recalculate all rankings.')) {
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', matchId)

      if (error) {
        throw error
      }

      // Recalculate rankings after deletion (same logic as edit)
      const { data: allPlayers } = await supabase
        .from('players')
        .select('*')
        .order('current_rank', { ascending: true })

      if (allPlayers) {
        const { data: allMatches } = await supabase
          .from('matches')
          .select('*')
          .order('date_played', { ascending: true })

        if (allMatches) {
          let currentPlayers = allPlayers.map(p => ({ ...p, current_rank: p.initial_rank }))
          
          const { updateLadderRankings } = await import('@/lib/utils/ladder')
          for (const match of allMatches) {
            currentPlayers = updateLadderRankings(currentPlayers, match as Match)
          }

          for (const player of currentPlayers) {
            await supabase
              .from('players')
              .update({ current_rank: player.current_rank })
              .eq('id', player.id)
          }
        }
      }

      setMessage('Match deleted successfully! Rankings recalculated.')
      setMatches(matches.filter(m => m.id !== matchId))

    } catch (error: unknown) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`)
    } finally {
      setLoading(false)
    }
  }

  const needsTiebreaker = () => {
    const set1Completed = editForm.set1_p1_games > 0 || editForm.set1_p2_games > 0
    const set2Completed = editForm.set2_p1_games > 0 || editForm.set2_p2_games > 0
    
    if (!set1Completed || !set2Completed) {
      return false
    }
    
    const set1Winner = editForm.set1_p1_games > editForm.set1_p2_games ? 1 : 2
    const set2Winner = editForm.set2_p1_games > editForm.set2_p2_games ? 1 : 2
    return set1Winner !== set2Winner
  }

  return (
    <div className="space-y-6">
      {message && (
        <div className={`p-4 rounded-md ${
          message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          {message}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Match History</h2>
          <p className="text-sm text-gray-600 mt-1">Edit or delete past matches. Rankings will be recalculated automatically.</p>
        </div>
        
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Players
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Score
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Winner
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {matches.map((match) => (
                <tr key={match.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingMatch === match.id ? (
                      <input
                        type="date"
                        value={editForm.date_played}
                        onChange={(e) => setEditForm({ ...editForm, date_played: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      (() => {
                        const [year, month, day] = match.date_played.split('-')
                        return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toLocaleDateString()
                      })()
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {match.player1.name} vs {match.player2.name}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {editingMatch === match.id ? (
                      <div className="space-y-2">
                        <div className="flex space-x-2 items-center">
                          <span className="text-xs text-gray-500">Set 1:</span>
                          <select
                            value={editForm.set1_p1_games}
                            onChange={(e) => setEditForm({ ...editForm, set1_p1_games: parseInt(e.target.value) })}
                            className="px-2 py-1 text-sm border border-gray-300 rounded"
                          >
                            {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                              <option key={num} value={num}>{num}</option>
                            ))}
                          </select>
                          <span>-</span>
                          <select
                            value={editForm.set1_p2_games}
                            onChange={(e) => setEditForm({ ...editForm, set1_p2_games: parseInt(e.target.value) })}
                            className="px-2 py-1 text-sm border border-gray-300 rounded"
                          >
                            {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                              <option key={num} value={num}>{num}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex space-x-2 items-center">
                          <span className="text-xs text-gray-500">Set 2:</span>
                          <select
                            value={editForm.set2_p1_games}
                            onChange={(e) => setEditForm({ ...editForm, set2_p1_games: parseInt(e.target.value) })}
                            className="px-2 py-1 text-sm border border-gray-300 rounded"
                          >
                            {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                              <option key={num} value={num}>{num}</option>
                            ))}
                          </select>
                          <span>-</span>
                          <select
                            value={editForm.set2_p2_games}
                            onChange={(e) => setEditForm({ ...editForm, set2_p2_games: parseInt(e.target.value) })}
                            className="px-2 py-1 text-sm border border-gray-300 rounded"
                          >
                            {[0, 1, 2, 3, 4, 5, 6, 7].map(num => (
                              <option key={num} value={num}>{num}</option>
                            ))}
                          </select>
                        </div>
                        {needsTiebreaker() && (
                          <div className="flex space-x-2 items-center bg-yellow-50 p-2 rounded">
                            <span className="text-xs text-gray-500">TB:</span>
                            <input
                              type="number"
                              min="0"
                              value={editForm.tiebreaker_p1_points}
                              onChange={(e) => setEditForm({ ...editForm, tiebreaker_p1_points: e.target.value })}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                              placeholder="P1"
                            />
                            <span>-</span>
                            <input
                              type="number"
                              min="0"
                              value={editForm.tiebreaker_p2_points}
                              onChange={(e) => setEditForm({ ...editForm, tiebreaker_p2_points: e.target.value })}
                              className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                              placeholder="P2"
                            />
                          </div>
                        )}
                      </div>
                    ) : (
                      <div>
                        {match.set1_p1_games}-{match.set1_p2_games}, {match.set2_p1_games}-{match.set2_p2_games}
                        {match.tiebreaker_winner && (
                          <span className="ml-2 text-gray-500">
                            (TB: {match.tiebreaker_p1_points}-{match.tiebreaker_p2_points})
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    <span className="font-medium">
                      {match.match_winner === 1 ? match.player1.name : match.player2.name}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {editingMatch === match.id ? (
                      <div className="flex space-x-2">
                        <button
                          onClick={handleSaveEdit}
                          className="text-green-600 hover:text-green-800"
                          disabled={loading}
                        >
                          Save
                        </button>
                        <button
                          onClick={handleCancelEdit}
                          className="text-gray-600 hover:text-gray-800"
                          disabled={loading}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleEditMatch(match)}
                          className="text-blue-600 hover:text-blue-800"
                          disabled={loading}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteMatch(match.id)}
                          className="text-red-600 hover:text-red-800"
                          disabled={loading}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        {matches.length === 0 && (
          <div className="px-6 py-8 text-center text-gray-500">
            No matches found. Enter some matches to see them here.
          </div>
        )}
      </div>
    </div>
  )
}