'use client'

import { useEffect, useState, use } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import Link from 'next/link'
import { Player, MatchWithPlayers } from '@/lib/types/database'

interface PlayerPageProps {
  params: Promise<{ id: string }>
}

export default function PlayerPage({ params }: PlayerPageProps) {
  const resolvedParams = use(params)
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [player, setPlayer] = useState<Player | null>(null)
  const [matches, setMatches] = useState<MatchWithPlayers[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const checkAuth = () => {
      const email = localStorage.getItem('scrappers_user_email')
      const adminStatus = localStorage.getItem('scrappers_is_admin') === 'true'
      
      if (!email) {
        router.push('/login')
        return
      }

      setUser({ email })
      setIsAdmin(adminStatus)
    }

    const fetchData = async () => {
      try {
        // Fetch player details
        const { data: playerData, error: playerError } = await supabase
          .from('players')
          .select('*')
          .eq('id', resolvedParams.id)
          .single()

        if (playerError || !playerData) {
          router.push('/404')
          return
        }

        // Fetch player's matches
        const { data: matchesData } = await supabase
          .from('matches')
          .select(`
            *,
            player1:players!matches_player1_id_fkey(*),
            player2:players!matches_player2_id_fkey(*)
          `)
          .or(`player1_id.eq.${resolvedParams.id},player2_id.eq.${resolvedParams.id}`)
          .order('date_played', { ascending: false })

        setPlayer(playerData)
        setMatches(matchesData || [])
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
    fetchData()
  }, [resolvedParams.id, router, supabase])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (!user || !player) {
    return null
  }

  // Calculate player stats
  const playerMatches = matches
  const wins = playerMatches.filter(match => {
    return (match.player1_id === player.id && match.match_winner === 1) ||
           (match.player2_id === player.id && match.match_winner === 2)
  }).length

  const losses = playerMatches.length - wins

  let setsWon = 0
  let setsLost = 0
  let gamesWon = 0
  let gamesLost = 0

  playerMatches.forEach(match => {
    const isPlayer1 = match.player1_id === player.id
    
    // Count set wins/losses
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

    // Count games won/lost
    if (isPlayer1) {
      gamesWon += match.set1_p1_games + match.set2_p1_games
      gamesLost += match.set1_p2_games + match.set2_p2_games
    } else {
      gamesWon += match.set1_p2_games + match.set2_p2_games
      gamesLost += match.set1_p1_games + match.set2_p1_games
    }

    // Note: Tiebreaker points are NOT counted as games
    // They are separate from regular game counts
  })

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} isAdmin={isAdmin} />
      <main className="container mx-auto px-4 py-8">
        <div className="mb-6">
          <Link 
            href="/"
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            ← Back to Leaderboard
          </Link>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold text-gray-900">{player.name}</h1>
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">#{player.current_rank}</div>
              <div className="text-sm text-gray-500">Current Rank</div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{playerMatches.length}</div>
              <div className="text-sm text-gray-500">Matches Played</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{wins}</div>
              <div className="text-sm text-gray-500">Wins</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{losses}</div>
              <div className="text-sm text-gray-500">Losses</div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {playerMatches.length > 0 ? `${((wins / playerMatches.length) * 100).toFixed(1)}%` : '0%'}
              </div>
              <div className="text-sm text-gray-500">Win Rate</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-xl font-bold text-gray-900">{setsWon}-{setsLost}</div>
              <div className="text-sm text-gray-500">Sets (W-L)</div>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-xl font-bold text-gray-900">{gamesWon}-{gamesLost}</div>
              <div className="text-sm text-gray-500">Games (W-L)</div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Match History</h2>
          </div>
          
          {playerMatches.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Opponent
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Result
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Score
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {playerMatches.map((match) => {
                    const isPlayer1 = match.player1_id === player.id
                    const opponent = isPlayer1 ? match.player2 : match.player1
                    const won = (isPlayer1 && match.match_winner === 1) || (!isPlayer1 && match.match_winner === 2)
                    
                    return (
                      <tr key={match.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {(() => {
                            const [year, month, day] = match.date_played.split('-')
                            return new Date(parseInt(year), parseInt(month) - 1, parseInt(day)).toLocaleDateString()
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Link 
                            href={`/player/${opponent.id}`}
                            className="text-blue-600 hover:text-blue-800 font-medium"
                          >
                            {opponent.name}
                          </Link>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            won ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {won ? 'W' : 'L'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {isPlayer1 ? 
                            `${match.set1_p1_games}-${match.set1_p2_games}, ${match.set2_p1_games}-${match.set2_p2_games}` :
                            `${match.set1_p2_games}-${match.set1_p1_games}, ${match.set2_p2_games}-${match.set2_p1_games}`
                          }
                          {match.tiebreaker_winner && (
                            <span className="ml-2 text-gray-500">
                              (TB: {isPlayer1 ? 
                                `${match.tiebreaker_p1_points}-${match.tiebreaker_p2_points}` :
                                `${match.tiebreaker_p2_points}-${match.tiebreaker_p1_points}`
                              })
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-6 py-8 text-center text-gray-500">
              No matches played yet.
            </div>
          )}
        </div>
      </main>
    </div>
  )
}