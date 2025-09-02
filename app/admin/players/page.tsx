'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import PlayerManagement from '@/components/admin/PlayerManagement'
import { Player, AllowedEmail } from '@/lib/types/database'

export default function PlayersPage() {
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [players, setPlayers] = useState<Player[]>([])
  const [allowedEmails, setAllowedEmails] = useState<AllowedEmail[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

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
        const [playersData, emailsData] = await Promise.all([
          supabase.from('players').select('*').eq('is_active', true).order('current_rank', { ascending: true }),
          supabase.from('allowed_emails').select('*').order('email', { ascending: true })
        ])

        setPlayers(playersData.data || [])
        setAllowedEmails(emailsData.data || [])
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
            Player Management
          </h1>
          <p className="text-gray-600">
            Add, edit, and manage players and access permissions
          </p>
        </div>
        
        <PlayerManagement 
          players={players} 
          allowedEmails={allowedEmails} 
        />
      </main>
    </div>
  )
}