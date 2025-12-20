'use client'

import { useState, useMemo } from 'react'
import { Player } from '@/lib/types/database'

interface ContactInfoProps {
  players: Player[]
}

export default function ContactInfo({ players: initialPlayers }: ContactInfoProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set())
  const [copyMessage, setCopyMessage] = useState('')
  const [sortBy, setSortBy] = useState<'name' | 'email'>('name')

  // Filter and sort players
  const filteredAndSortedPlayers = useMemo(() => {
    const filtered = initialPlayers.filter(player => 
      player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      player.email.toLowerCase().includes(searchQuery.toLowerCase())
    )

    // Sort alphabetically (create a new array to avoid mutation)
    const sorted = [...filtered].sort((a, b) => {
      if (sortBy === 'name') {
        return a.name.localeCompare(b.name)
      } else {
        return a.email.localeCompare(b.email)
      }
    })

    return sorted
  }, [initialPlayers, searchQuery, sortBy])

  const handleSelectPlayer = (playerId: string) => {
    const newSelected = new Set(selectedPlayers)
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId)
    } else {
      newSelected.add(playerId)
    }
    setSelectedPlayers(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedPlayers.size === filteredAndSortedPlayers.length) {
      setSelectedPlayers(new Set())
    } else {
      setSelectedPlayers(new Set(filteredAndSortedPlayers.map(p => p.id)))
    }
  }

  const copyEmail = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email)
      setCopyMessage(`Copied: ${email}`)
      setTimeout(() => setCopyMessage(''), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      setCopyMessage('Failed to copy email')
      setTimeout(() => setCopyMessage(''), 2000)
    }
  }

  const copySelectedEmails = async () => {
    if (selectedPlayers.size === 0) {
      setCopyMessage('No players selected')
      setTimeout(() => setCopyMessage(''), 2000)
      return
    }

    const selectedEmails = filteredAndSortedPlayers
      .filter(player => selectedPlayers.has(player.id))
      .map(player => player.email)
      .join(',')

    try {
      await navigator.clipboard.writeText(selectedEmails)
      setCopyMessage(`Copied ${selectedPlayers.size} email${selectedPlayers.size > 1 ? 's' : ''}`)
      setTimeout(() => setCopyMessage(''), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
      setCopyMessage('Failed to copy emails')
      setTimeout(() => setCopyMessage(''), 2000)
    }
  }

  const allSelected = filteredAndSortedPlayers.length > 0 && selectedPlayers.size === filteredAndSortedPlayers.length

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Instruction note */}
      <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
        <p className="text-sm text-gray-700">
          <strong>How to use:</strong> Select the player, or multiple players, you want to reach out to for a match. 
          Copy the address(es) selected. Open up your email and start a new email. Paste in the email address(es) copied 
          from the website so you can reach out to schedule a match.
        </p>
      </div>

      {/* Search and controls */}
      <div className="px-6 py-4 border-b border-gray-200">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex gap-2 items-center">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'name' | 'email')}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="name">Sort by Name</option>
              <option value="email">Sort by Email</option>
            </select>

            {selectedPlayers.size > 0 && (
              <button
                onClick={copySelectedEmails}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 font-medium"
              >
                Copy Selected ({selectedPlayers.size})
              </button>
            )}
          </div>
        </div>

        {copyMessage && (
          <div className="mt-3 px-4 py-2 bg-green-100 text-green-800 rounded-md text-sm">
            {copyMessage}
          </div>
        )}
      </div>

      {/* Players table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={handleSelectAll}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Player Name
              </th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Email
              </th>
              <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredAndSortedPlayers.map((player) => (
              <tr key={player.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="checkbox"
                    checked={selectedPlayers.has(player.id)}
                    onChange={() => handleSelectPlayer(player.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {player.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                  {player.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button
                    onClick={() => copyEmail(player.email)}
                    className="text-blue-600 hover:text-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 rounded px-2 py-1"
                    title="Copy email address"
                  >
                    Copy
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredAndSortedPlayers.length === 0 && (
        <div className="px-6 py-8 text-center text-gray-500">
          {searchQuery ? 'No players found matching your search.' : 'No players found.'}
        </div>
      )}

      {filteredAndSortedPlayers.length > 0 && (
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-sm text-gray-600">
          Showing {filteredAndSortedPlayers.length} of {initialPlayers.length} player{initialPlayers.length !== 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

