'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Leaderboard from '@/components/Leaderboard'
import Navigation from '@/components/Navigation'
import { Player, MatchWithPlayers } from '@/lib/types/database'

export default function Home() {
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
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
        // Fetch all players (backend stores all players)
        const { data: playersData } = await supabase
          .from('players')
          .select('*')
          .order('current_rank', { ascending: true })

        // Fetch matches
        const { data: matchesData } = await supabase
          .from('matches')
          .select(`
            *,
            player1:players!matches_player1_id_fkey(*),
            player2:players!matches_player2_id_fkey(*)
          `)
          .order('date_played', { ascending: false })

        setPlayers(playersData || [])
        setMatches(matchesData || [])
      } catch (error) {
        console.error('Error fetching data:', error)
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
    fetchData()
  }, [router, supabase])

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

  if (!user) {
    return null // Will redirect to login
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} isAdmin={isAdmin} />
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            🏆 Scrappers Cup Ladder 🏆
          </h1>
          <p className="text-gray-600">
            Tennis tournament ladder system
          </p>
        </div>
        
        <Leaderboard players={players.sort((a, b) => a.current_rank - b.current_rank)} matches={matches} />
      </main>
    </div>
  )
}