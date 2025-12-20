'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import GameHistory from '@/components/GameHistory'
import Navigation from '@/components/Navigation'
import { MatchWithPlayers } from '@/lib/types/database'

export default function HistoryPage() {
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
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
        // Fetch matches
        const { data: matchesData } = await supabase
          .from('matches')
          .select(`
            *,
            player1:players!matches_player1_id_fkey(*),
            player2:players!matches_player2_id_fkey(*)
          `)
          .order('date_played', { ascending: false })

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
            🏆 Game History 🏆
          </h1>
        </div>

        <div className="space-y-8">
          <GameHistory matches={matches} />
        </div>
      </main>
    </div>
  )
}
