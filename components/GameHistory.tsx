'use client'

import { MatchWithPlayers } from '@/lib/types/database'

interface GameHistoryProps {
  matches: MatchWithPlayers[]
}

export default function GameHistory({ matches }: GameHistoryProps) {
  // Sort matches by created_at for proper chronological order (newest first)
  const sortedMatches = [...matches].sort((a, b) => 
    new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  )

  return (
    <div className="bg-white rounded-lg shadow-sm overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-900">Recent Games</h2>
        <p className="text-sm text-gray-600 mt-1">Latest matches played in the tournament</p>
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
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedMatches.map((match) => (
              <tr key={match.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {(() => {
                    // Handle both date-only and full timestamp formats
                    const date = new Date(match.date_played)
                    return date.toLocaleDateString()
                  })()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {match.player1.name} vs {match.player2.name}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <div>
                    {match.set1_p1_games}-{match.set1_p2_games}, {match.set2_p1_games}-{match.set2_p2_games}
                    {match.tiebreaker_winner && (
                      <span className="ml-2 text-gray-500">
                        (TB: {match.tiebreaker_p1_points}-{match.tiebreaker_p2_points})
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  <span className="font-medium text-green-600">
                    {match.match_winner === 1 ? match.player1.name : match.player2.name}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {matches.length === 0 && (
        <div className="px-6 py-8 text-center text-gray-500">
          No matches found. Matches will appear here once they are played.
        </div>
      )}
    </div>
  )
}
