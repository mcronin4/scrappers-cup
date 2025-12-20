'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Navigation from '@/components/Navigation'
import ContactInfo from '@/components/ContactInfo'
import { Player } from '@/lib/types/database'

export default function ContactPage() {
  const [user, setUser] = useState<{ email: string } | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [players, setPlayers] = useState<Player[]>([])
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
        // Fetch all players - sorted alphabetically by name as default
        const { data: playersData } = await supabase
          .from('players')
          .select('*')
          .order('name', { ascending: true })

        setPlayers(playersData || [])
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
            Contact Info
          </h1>
        </div>

        <div className="space-y-8">
          <ContactInfo players={players} />
        </div>
      </main>
    </div>
  )
}

