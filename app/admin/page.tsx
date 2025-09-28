'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import MatchEntryForm from '@/components/admin/MatchEntryForm'
import MatchHistory from '@/components/admin/MatchHistory'
import RankingManager from '@/components/admin/RankingManager'
import InitialRankingsManager from '@/components/admin/InitialRankingsManager'
import TransactionLogView from '@/components/admin/TransactionLogView'
import { Player, MatchWithPlayers } from '@/lib/types/database'

export default function AdminPage() {
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [matches, setMatches] = useState<MatchWithPlayers[]>([])
  const [activeTab, setActiveTab] = useState<'enter' | 'history' | 'rankings' | 'initial-rankings' | 'transaction-log'>('enter')
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  const handleMatchAdded = async () => {
    // Refresh matches and players after a new match is added
    try {
      const [playersData, matchesData] = await Promise.all([
        supabase.from('players').select('*').order('name', { ascending: true }),
        supabase.from('matches').select(`
          *,
          player1:players!matches_player1_id_fkey(*),
          player2:players!matches_player2_id_fkey(*)
        `).order('created_at', { ascending: false })
      ])

      setPlayers(playersData.data || [])
      setMatches(matchesData.data || [])
    } catch (error) {
      console.error('Error refreshing data after match added:', error)
    }
  }

  useEffect(() => {
    const checkAuth = () => {
      const email = localStorage.getItem('scrappers_user_email')
      const isAdmin = localStorage.getItem('scrappers_is_admin') === 'true'
      
      if (!email) {
        router.push('/login')
        return
      }

      if (!isAdmin) {
        router.push('/')
        return
      }

      setUser({ email })
    }

    const fetchData = async () => {
      try {
        const [playersData, matchesData] = await Promise.all([
          supabase.from('players').select('*').order('name', { ascending: true }),
          supabase.from('matches').select(`
            *,
            player1:players!matches_player1_id_fkey(*),
            player2:players!matches_player2_id_fkey(*)
          `).order('created_at', { ascending: false })
        ])

        setPlayers(playersData.data || [])
        setMatches(matchesData.data || [])
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
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navigation user={user} isAdmin={true} />
      <main className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Admin Panel
          </h1>
          <p className="text-gray-600">
            Enter match results and manage the tournament
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-sm">
            <button
              onClick={() => setActiveTab('enter')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'enter'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Enter Match
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'history'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Match History
            </button>

            <button
              onClick={() => setActiveTab('rankings')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'rankings'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Move Players
            </button>

            <button
              onClick={() => setActiveTab('initial-rankings')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'initial-rankings'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Reset Positions
            </button>

            <button
              onClick={() => setActiveTab('transaction-log')}
              className={`px-6 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'transaction-log'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Activity Log
            </button>
          </div>
        </div>
        
        {/* Tab Content */}
        {activeTab === 'enter' ? (
          <div className="max-w-2xl mx-auto">
            <MatchEntryForm players={players} onMatchAdded={handleMatchAdded} />
          </div>
        ) : activeTab === 'history' ? (
          <div className="max-w-6xl mx-auto">
            <MatchHistory matches={matches} onMatchesUpdated={handleMatchAdded} />
          </div>
        ) : activeTab === 'rankings' ? (
          <div className="max-w-4xl mx-auto">
            <RankingManager players={players} />
          </div>
        ) : activeTab === 'initial-rankings' ? (
          <div className="max-w-4xl mx-auto">
            <InitialRankingsManager players={players} />
          </div>
        ) : (
          <div className="max-w-6xl mx-auto">
            <TransactionLogView />
          </div>
        )}
      </main>
    </div>
  )
}