'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Player, AllowedEmail } from '@/lib/types/database'
import { getActiveLeaderboard } from '@/lib/utils/ladder'
// import { useRouter } from 'next/navigation'

interface PlayerManagementProps {
  players: Player[]
  allowedEmails: AllowedEmail[]
}

export default function PlayerManagement({ players: initialPlayers, allowedEmails: initialAllowedEmails }: PlayerManagementProps) {
  const [players, setPlayers] = useState<Player[]>(initialPlayers)
  const [inactivePlayers, setInactivePlayers] = useState<Player[]>([])
  const [showInactive, setShowInactive] = useState(false)
  
  // Create active leaderboard with display ranks
  const activeLeaderboard = getActiveLeaderboard(players)
  
  const fetchInactivePlayers = async () => {
    try {
      const { data: inactive, error } = await supabase
        .from('players')
        .select('*')
        .eq('is_active', false)
        .order('name', { ascending: true })

      if (error) {
        console.error('Error fetching inactive players:', error)
        return
      }

      setInactivePlayers(inactive || [])
    } catch (error) {
      console.error('Error fetching inactive players:', error)
    }
  }
  
  // Debug: Check for duplicate ranks in player management
  const rankCounts: { [key: number]: number } = {}
  players.forEach(player => {
    rankCounts[player.current_rank] = (rankCounts[player.current_rank] || 0) + 1
  })
  
  const duplicateRanks = Object.entries(rankCounts).filter(([rank, count]) => count > 1)
  if (duplicateRanks.length > 0) {
    console.warn('PlayerManagement: Duplicate ranks detected:', duplicateRanks.map(([rank, count]) => `Rank ${rank}: ${count} players`))
  }
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>(initialAllowedEmails)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  // const router = useRouter()
  const supabase = createClient()

  const [newPlayer, setNewPlayer] = useState({
    name: '',
    email: '',
    notes: '',
  })

  const [newEmail, setNewEmail] = useState({
    email: '',
    is_admin: false,
  })

  const [editingPlayer, setEditingPlayer] = useState<string | null>(null)
  const [editForm, setEditForm] = useState({
    name: '',
    email: '',
    notes: '',
  })

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      // Get next rank number by querying the database for the actual maximum rank among active players
      const { data: currentPlayers, error: countError } = await supabase
        .from('players')
        .select('current_rank')
        .eq('is_active', true)
        .order('current_rank', { ascending: false })
        .limit(1)
      
      if (countError) {
        throw countError
      }
      
      const nextRank = currentPlayers && currentPlayers.length > 0 
        ? currentPlayers[0].current_rank + 1 
        : 1

      const { error } = await supabase
        .from('players')
        .insert([{
          name: newPlayer.name,
          email: newPlayer.email,
          initial_rank: nextRank,
          current_rank: nextRank,
          notes: newPlayer.notes,
          is_active: true,
        }])

      if (error) {
        throw error
      }

      // Also add to allowed emails if not already there
      const { error: emailError } = await supabase
        .from('allowed_emails')
        .insert([{
          email: newPlayer.email,
          is_admin: false,
        }])

      // Ignore error if email already exists
      if (emailError && !emailError.message.includes('duplicate')) {
        throw emailError
      }

      setMessage('Player added successfully! Rebuilding rankings...')
      
      // Rebuild rankings from baseline after adding player
      try {
        const { rebuildRankingsFromTimeline } = await import('@/lib/utils/ladder')
        const result = await rebuildRankingsFromTimeline(supabase)
        console.log('Rebuild result:', result)
      } catch (rebuildError) {
        console.error('Error rebuilding rankings:', rebuildError)
        throw new Error(`Failed to rebuild rankings: ${rebuildError instanceof Error ? rebuildError.message : 'Unknown error'}`)
      }
      
      setMessage('Player added successfully! Rankings have been rebuilt from baseline.')
      setNewPlayer({ name: '', email: '', notes: '' })
      
      // Refresh the players data to show updated rankings (active players only)
      const { data: updatedPlayers, error: fetchError } = await supabase
        .from('players')
        .select('*')
        .eq('is_active', true)
        .order('current_rank', { ascending: true })

      if (fetchError) {
        throw fetchError
      }

      if (updatedPlayers) {
        setPlayers(updatedPlayers)
      }
      
      // Add to allowed emails if not already there
      const emailExists = allowedEmails.find(e => e.email === newPlayer.email)
      if (!emailExists) {
        const newEmailData = {
          id: crypto.randomUUID(), // Temporary ID
          email: newPlayer.email,
          is_admin: false,
          created_at: new Date().toISOString()
        }
        setAllowedEmails([...allowedEmails, newEmailData])
      }

    } catch (error: unknown) {
      console.error('Error adding player:', error)
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred'
      setMessage(`Error: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const handleAddEmail = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      const { error } = await supabase
        .from('allowed_emails')
        .insert([newEmail])

      if (error) {
        throw error
      }

      setMessage('Email access granted successfully!')
      setNewEmail({ email: '', is_admin: false })
      
      // Update local state to show changes immediately
      const newEmailData = {
        id: crypto.randomUUID(), // Temporary ID
        email: newEmail.email,
        is_admin: newEmail.is_admin,
        created_at: new Date().toISOString()
      }
      setAllowedEmails([...allowedEmails, newEmailData])

    } catch (error: unknown) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeactivatePlayer = async (playerId: string) => {
    if (!confirm('Are you sure you want to deactivate this player? They will be removed from the active leaderboard but all their matches and history will be preserved. You can reactivate them later.')) {
      return
    }

    setLoading(true)
    try {
      // Deactivate the player instead of deleting
      const { error } = await supabase
        .from('players')
        .update({ is_active: false })
        .eq('id', playerId)

      if (error) {
        throw error
      }

      setMessage('Player deactivated successfully! Rebuilding rankings...')
      
      // Rebuild rankings from unified timeline after deactivating player
      const { rebuildRankingsFromTimeline } = await import('@/lib/utils/ladder')
      await rebuildRankingsFromTimeline(supabase)
      
      setMessage('Player deactivated successfully! Rankings have been rebuilt from timeline.')
      
      // Refresh the players data to show updated rankings
      const { data: updatedPlayers, error: fetchError } = await supabase
        .from('players')
        .select('*')
        .eq('is_active', true)
        .order('current_rank', { ascending: true })

      if (fetchError) {
        throw fetchError
      }

      if (updatedPlayers) {
        setPlayers(updatedPlayers)
      }

    } catch (error: unknown) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleReactivatePlayer = async (playerId: string) => {
    if (!confirm('Are you sure you want to reactivate this player? They will be added back to the active leaderboard.')) {
      return
    }

    setLoading(true)
    try {
      // Reactivate the player
      const { error } = await supabase
        .from('players')
        .update({ is_active: true })
        .eq('id', playerId)

      if (error) {
        throw error
      }

      setMessage('Player reactivated successfully! Rebuilding rankings...')
      
      // Rebuild rankings from unified timeline after reactivating player
      const { rebuildRankingsFromTimeline } = await import('@/lib/utils/ladder')
      await rebuildRankingsFromTimeline(supabase)
      
      setMessage('Player reactivated successfully! Rankings have been rebuilt from timeline.')
      
      // Refresh the players data to show updated rankings
      const { data: updatedPlayers, error: fetchError } = await supabase
        .from('players')
        .select('*')
        .eq('is_active', true)
        .order('current_rank', { ascending: true })

      if (fetchError) {
        throw fetchError
      }

      if (updatedPlayers) {
        setPlayers(updatedPlayers)
      }

    } catch (error: unknown) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleNormalizeRanks = async () => {
    if (!confirm('Are you sure you want to normalize all player rankings? This will fix any gaps and duplicates in the ranking sequence.')) {
      return
    }

    setLoading(true)
    setMessage('Normalizing rankings... (check browser console for details)')
    
    try {
      const { normalizeAllPlayerRanks } = await import('@/lib/utils/ladder')
      await normalizeAllPlayerRanks(supabase)

      // Refresh the players data to show updated rankings (active players only)
      const { data: updatedPlayers, error: fetchError } = await supabase
        .from('players')
        .select('*')
        .eq('is_active', true)
        .order('current_rank', { ascending: true })

      if (fetchError) {
        throw fetchError
      }

      if (updatedPlayers) {
        console.log(`Refreshed ${updatedPlayers.length} active players after normalization`)
        setPlayers(updatedPlayers)
      }

      setMessage('Player rankings normalized successfully! Check browser console for detailed changes.')

    } catch (error: unknown) {
      console.error('Normalization error:', error)
      setMessage(`Error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteEmail = async (emailId: string) => {
    if (!confirm('Are you sure you want to revoke access for this email?')) {
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase
        .from('allowed_emails')
        .delete()
        .eq('id', emailId)

      if (error) {
        throw error
      }

      setMessage('Email access revoked successfully!')
      
      // Update local state to show changes immediately
      setAllowedEmails(allowedEmails.filter(e => e.id !== emailId))

    } catch (error: unknown) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleEditPlayer = (player: Player) => {
    setEditingPlayer(player.id)
    setEditForm({
      name: player.name,
      email: player.email,
      notes: player.notes || '',
    })
  }

  const handleSaveEdit = async () => {
    if (!editingPlayer) return

    setLoading(true)
    try {
      // Update player info
      const { error: playerError } = await supabase
        .from('players')
        .update({
          name: editForm.name,
          email: editForm.email,
          notes: editForm.notes,
        })
        .eq('id', editingPlayer)

      if (playerError) {
        throw playerError
      }

      // Update allowed_emails table if email changed
      const playerBeingEdited = players.find(p => p.id === editingPlayer)
      if (playerBeingEdited && playerBeingEdited.email !== editForm.email) {
        // Update the allowed_emails entry
        const { error: emailError } = await supabase
          .from('allowed_emails')
          .update({ email: editForm.email })
          .eq('email', playerBeingEdited.email)

        if (emailError) {
          // If update fails, try to insert new email entry
          const { error: insertError } = await supabase
            .from('allowed_emails')
            .insert([{ email: editForm.email, is_admin: false }])

          if (insertError) {
            console.warn('Could not update allowed_emails:', insertError)
          }
        }
      }

      setMessage('Player updated successfully!')
      setEditingPlayer(null)
      setEditForm({ name: '', email: '', notes: '' })
      
      // Update local state to show changes immediately
      setPlayers(players.map(p => 
        p.id === editingPlayer 
          ? { ...p, name: editForm.name, email: editForm.email, notes: editForm.notes }
          : p
      ))
      
      // Update allowed emails if email changed
      const editedPlayer = players.find(p => p.id === editingPlayer)
      if (editedPlayer && editedPlayer.email !== editForm.email) {
        setAllowedEmails(allowedEmails.map(e => 
          e.email === editedPlayer.email 
            ? { ...e, email: editForm.email }
            : e
        ))
      }

    } catch (error: unknown) {
      setMessage(`Error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCancelEdit = () => {
    setEditingPlayer(null)
    setEditForm({ name: '', email: '', notes: '' })
  }

    const handleUpdatePlayerRank = async (playerId: string, newRank: number) => {
    setLoading(true)
    try {
      // Find the player being updated
      const playerToUpdate = players.find(p => p.id === playerId)
      if (!playerToUpdate) return
      
      const oldRank = playerToUpdate.current_rank
      if (oldRank === newRank) return

      console.log(`Updating ${playerToUpdate.name} from rank ${oldRank} to ${newRank}`)

      // First, temporarily update the target player's rank in the database
      const { error: tempUpdateError } = await supabase
        .from('players')
        .update({ current_rank: newRank })
        .eq('id', playerId)

      if (tempUpdateError) {
        throw tempUpdateError
      }

      // Record the rank adjustment for the main player
      const { recordRankAdjustment } = await import('@/lib/utils/ladder')
      await recordRankAdjustment(supabase, playerId, oldRank, newRank, 'Manual adjustment by admin')

      setMessage(`Player rank updated successfully! ${playerToUpdate.name} moved from rank ${oldRank} to ${newRank}. Rebuilding rankings from timeline...`)
      
      // Now rebuild ALL rankings from unified timeline to ensure proper rebalancing
      const { rebuildRankingsFromTimeline } = await import('@/lib/utils/ladder')
      await rebuildRankingsFromTimeline(supabase)
      
      setMessage(`Player rank updated successfully! ${playerToUpdate.name} moved from rank ${oldRank} to ${newRank}. Rankings have been rebuilt from timeline.`)
      
      // Refresh the players data to show updated rankings (active players only)
      const { data: updatedPlayers, error: fetchError } = await supabase
        .from('players')
        .select('*')
        .eq('is_active', true)
        .order('current_rank', { ascending: true })

      if (fetchError) {
        throw fetchError
      }

      if (updatedPlayers) {
        setPlayers(updatedPlayers)
        console.log('Active players updated successfully:', updatedPlayers.map(p => `${p.name}: ${p.current_rank}`))
      }
      
    } catch (error: unknown) {
      console.error('Error in handleUpdatePlayerRank:', error)
      setMessage(`Error: ${error instanceof Error ? error.message : 'An unexpected error occurred'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {message && (
        <div className={`p-4 rounded-md ${
          message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
        }`}>
          {message}
        </div>
      )}

      {/* Add New Player */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Add New Player</h2>
        <form onSubmit={handleAddPlayer} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input
              type="text"
              placeholder="Player Name"
              value={newPlayer.name}
              onChange={(e) => setNewPlayer({ ...newPlayer, name: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
            <input
              type="email"
              placeholder="Email Address"
              value={newPlayer.email}
              onChange={(e) => setNewPlayer({ ...newPlayer, email: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              required
            />
          </div>
          <div>
            <textarea
              placeholder="Admin notes (optional)"
              value={newPlayer.notes}
              onChange={(e) => setNewPlayer({ ...newPlayer, notes: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 min-h-[60px] resize-vertical"
              rows={2}
            />
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Add Player
            </button>
          </div>
        </form>
      </div>

      {/* Current Players */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
          <h2 className="text-xl font-semibold text-gray-900">Current Players</h2>
          <button
            onClick={handleNormalizeRanks}
            disabled={loading}
            className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 text-sm"
          >
            Normalize Rankings
          </button>
        </div>
        <div className="mb-4 p-3 bg-gray-50 rounded-md border border-gray-200">
          <p className="text-xs text-gray-600">
            <strong>Active Rank:</strong> Sequential ranking for active players only (1, 2, 3...). 
            <strong>DB Rank:</strong> Database rank including inactive players (needed for consistency).
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Active Rank / DB Rank
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {activeLeaderboard.map((player) => (
                <tr key={player.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        #{player.display_rank}
                      </span>
                      <span className="text-xs text-gray-500">/</span>
                      <select
                        value={player.current_rank}
                        onChange={(e) => handleUpdatePlayerRank(player.id, parseInt(e.target.value))}
                        className="text-xs border border-gray-300 rounded px-1 py-1"
                        disabled={loading}
                      >
                        {Array.from({ length: Math.max(...players.map(p => p.current_rank)) }, (_, i) => i + 1).map(rank => (
                          <option key={rank} value={rank}>#{rank}</option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {editingPlayer === player.id ? (
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      player.name
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {editingPlayer === player.id ? (
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                      />
                    ) : (
                      player.email
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {editingPlayer === player.id ? (
                      <textarea
                        value={editForm.notes}
                        onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 min-h-[60px] resize-vertical"
                        placeholder="Admin notes about this player..."
                        rows={2}
                      />
                    ) : (
                      <div className="max-w-xs">
                        {player.notes ? (
                          <div className="text-gray-700 text-sm">
                            {player.notes}
                          </div>
                        ) : (
                          <span className="text-gray-400 italic">No notes</span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {editingPlayer === player.id ? (
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
                          onClick={() => handleEditPlayer(player)}
                          className="text-blue-600 hover:text-blue-800"
                          disabled={loading}
                        >
                          Edit
                        </button>
                                                 <button
                           onClick={() => handleDeactivatePlayer(player.id)}
                           className="text-red-600 hover:text-red-800"
                           disabled={loading}
                         >
                           Deactivate
                         </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
                 </div>
       </div>

       {/* Inactive Players */}
       <div className="bg-white rounded-lg shadow-sm overflow-hidden">
         <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center">
           <h2 className="text-xl font-semibold text-gray-900">Inactive Players</h2>
           <div className="flex items-center space-x-4">
             <button
               onClick={() => {
                 setShowInactive(!showInactive)
                 if (!showInactive) {
                   fetchInactivePlayers()
                 }
               }}
               className="bg-gray-600 text-white py-2 px-4 rounded-md hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-500 disabled:opacity-50 text-sm"
             >
               {showInactive ? 'Hide Inactive' : 'Show Inactive'}
             </button>
           </div>
         </div>
         {showInactive && (
           <div className="overflow-x-auto">
             <table className="min-w-full divide-y divide-gray-200">
               <thead className="bg-gray-50">
                 <tr>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Name
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Email
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     DB Rank
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Notes
                   </th>
                   <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                     Actions
                   </th>
                 </tr>
               </thead>
               <tbody className="bg-white divide-y divide-gray-200">
                 {inactivePlayers.map((player) => (
                   <tr key={player.id} className="hover:bg-gray-50">
                     <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                       {player.name}
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                       {player.email}
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                       #{player.current_rank}
                     </td>
                     <td className="px-6 py-4 text-sm text-gray-500">
                       <div className="max-w-xs">
                         {player.notes ? (
                           <div className="text-gray-700 text-sm">
                             {player.notes}
                           </div>
                         ) : (
                           <span className="text-gray-400 italic">No notes</span>
                         )}
                       </div>
                     </td>
                     <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                       <button
                         onClick={() => handleReactivatePlayer(player.id)}
                         className="text-green-600 hover:text-green-800"
                         disabled={loading}
                       >
                         Reactivate
                       </button>
                     </td>
                   </tr>
                 ))}
                 {inactivePlayers.length === 0 && (
                   <tr>
                     <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                       No inactive players found.
                     </td>
                   </tr>
                 )}
               </tbody>
             </table>
           </div>
         )}
       </div>

       {/* Add Email Access */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Grant Email Access</h2>
        <form onSubmit={handleAddEmail} className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <input
            type="email"
            placeholder="Email Address"
            value={newEmail.email}
            onChange={(e) => setNewEmail({ ...newEmail, email: e.target.value })}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            required
          />
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={newEmail.is_admin}
              onChange={(e) => setNewEmail({ ...newEmail, is_admin: e.target.checked })}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Admin Access</span>
          </label>
          <button
            type="submit"
            disabled={loading}
            className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50"
          >
            Grant Access
          </button>
        </form>
      </div>

      {/* Allowed Emails */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Allowed Email Addresses</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Email
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Access Level
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {allowedEmails.map((emailEntry) => (
                <tr key={emailEntry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {emailEntry.email}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                      emailEntry.is_admin ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {emailEntry.is_admin ? 'Admin' : 'Viewer'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <button
                      onClick={() => handleDeleteEmail(emailEntry.id)}
                      className="text-red-600 hover:text-red-800"
                      disabled={loading}
                    >
                      Revoke
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}