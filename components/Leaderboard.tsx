'use client'

import { Player, MatchWithPlayers } from '@/lib/types/database'
import Link from 'next/link'

interface LeaderboardProps {
  players: Player[]
  matches: MatchWithPlayers[]
}

export default function Leaderboard({ players, matches }: LeaderboardProps) {
  // Calculate stats for each player
  const playerStats = players.map(player => {
    const playerMatches = matches.filter(
      match => match.player1_id === player.id || match.player2_id === player.id
    )

    const wins = playerMatches.filter(match => {
      return (match.player1_id === player.id && match.match_winner === 1) ||
             (match.player2_id === player.id && match.match_winner === 2)
    }).length

    const losses = playerMatches.length - wins

    // Calculate sets won/lost
    let setsWon = 0
    let setsLost = 0

    playerMatches.forEach(match => {
      const isPlayer1 = match.player1_id === player.id
      
      // Count set wins
      if ((isPlayer1 && match.set1_winner === 1) || (!isPlayer1 && match.set1_winner === 2)) {
        setsWon++
      } else {
        setsLost++
      }

      if ((isPlayer1 && match.set2_winner === 1) || (!isPlayer1 && match.set2_winner === 2)) {
        setsWon++
      } else {
        setsLost++
      }
    })

    return {
      player,
      totalMatches: playerMatches.length,
      wins,
      losses,
      setsWon,
      setsLost,
      winPercentage: playerMatches.length > 0 ? (wins / playerMatches.length) * 100 : 0
    }
  })

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">Current Standings</h2>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Rank
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Player
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Matches
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                W-L
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Win %
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Sets W-L
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {playerStats.map((stats) => (
              <tr key={stats.player.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  #{stats.player.current_rank}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <Link 
                    href={`/player/${stats.player.id}`}
                    className="text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {stats.player.name}
                  </Link>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {stats.totalMatches}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {stats.wins}-{stats.losses}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {stats.totalMatches > 0 ? `${stats.winPercentage.toFixed(1)}%` : '-'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {stats.setsWon}-{stats.setsLost}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {players.length === 0 && (
        <div className="px-6 py-8 text-center text-gray-500">
          No players found. Add players in the admin panel to get started.
        </div>
      )}
    </div>
  )
}