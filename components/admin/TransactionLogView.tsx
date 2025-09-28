'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface RankingEvent {
  id: string
  event_type: 'match' | 'manual_adjustment'
  event_date: string
  match_id?: string
  player_id?: string
  old_rank?: number
  new_rank?: number
  reason?: string
  created_at: string
  matches?: {
    id: string
    player1_id: string
    player2_id: string
    match_winner: number
    date_played: string
    player1: { name: string }
    player2: { name: string }
  }
  players?: {
    name: string
  }
}

export default function TransactionLogView() {
  const [events, setEvents] = useState<RankingEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const supabase = createClient()

  const fetchEvents = async () => {
    try {
      setLoading(true)
      
      const { data, error } = await supabase
        .from('ranking_events')
        .select(`
          *,
          players(name)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        throw error
      }

      setEvents(data || [])
    } catch (error) {
      console.error('Error fetching events:', error)
      setMessage('Error fetching events')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEvents()
  }, [])

  const handleDeleteEvent = async (eventId: string) => {
    if (!confirm('Are you sure you want to delete this event? This will update all player positions.')) {
      return
    }

    try {
      // Get the event to find its details
      const { data: eventToDelete, error: fetchError } = await supabase
        .from('ranking_events')
        .select('event_date, event_type, match_id')
        .eq('id', eventId)
        .single()

      if (fetchError || !eventToDelete) {
        throw new Error('Failed to fetch event details')
      }

      // If it's a match event, also delete the associated match
      if (eventToDelete.event_type === 'match' && eventToDelete.match_id) {
        const { error: deleteMatchError } = await supabase
          .from('matches')
          .delete()
          .eq('id', eventToDelete.match_id)

        if (deleteMatchError) {
          console.warn('Failed to delete associated match:', deleteMatchError)
          // Continue anyway as the CASCADE should handle it
        }
      }

      // Delete the ranking event
      const { error } = await supabase
        .from('ranking_events')
        .delete()
        .eq('id', eventId)

      if (error) {
        throw error
      }

      // Rebuild all rankings from initial state
      const { rebuildAllRankings } = await import('@/lib/utils/events')
      await rebuildAllRankings(supabase)

      setMessage('Event deleted successfully! Player positions have been updated.')
      
      // Refresh the events
      await fetchEvents()
      
    } catch (error: unknown) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`)
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading events...</p>
        </div>
      </div>
    )
  }

  return (
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Activity Log</h2>
            <p className="text-sm text-gray-600 mt-1">
          All player position changes and match results in chronological order
        </p>
        </div>
        
        <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Action
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {events.map((event) => (
              <tr key={event.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {formatDate(event.created_at)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    event.event_type === 'match' 
                      ? 'bg-blue-100 text-blue-800' 
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    {event.event_type === 'match' ? 'Match Result' : 'Position Change'}
                                 </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-900">
                  {event.event_type === 'match' ? (
                    <div>
                      <div className="font-medium">
                        Match Result
                               </div>
                      <div className="text-gray-500 text-xs">
                        {event.players?.name && event.old_rank && event.new_rank 
                          ? `${event.players.name}: ${event.old_rank} → ${event.new_rank}`
                          : event.reason || `Match ID: ${event.match_id}`
                        }
                           </div>
                         </div>
                  ) : event.event_type === 'manual_adjustment' && event.players ? (
                    <div>
                      <div className="font-medium">
                        {event.players.name} position change
                    </div>
                      <div className="text-gray-500 text-xs">
                        {event.old_rank} → {event.new_rank}
                        {event.reason && ` (${event.reason})`}
              </div>
            </div>
          ) : (
                    <span className="text-gray-400">Unknown event</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <button
                    onClick={() => handleDeleteEvent(event.id)}
                    className="text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
            {events.length === 0 && (
              <tr>
                <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                  No events found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      
      {message && (
        <div className={`px-6 py-4 text-sm ${
          message.startsWith('Error') ? 'text-red-600' : 'text-green-600'
        }`}>
          {message}
            </div>
          )}
    </div>
  )
} 