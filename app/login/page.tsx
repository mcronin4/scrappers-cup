'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState<'email' | 'password'>('email')
  const [, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const router = useRouter()
  const supabase = createClient()

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      // Check if email is in allowed list
      const { data: allowedEmail, error } = await supabase
        .from('allowed_emails')
        .select('*')
        .eq('email', email)
        .single()

      if (error || !allowedEmail) {
        setMessage('Email not authorized. Please contact an admin.')
        return
      }

      if (allowedEmail.is_admin) {
        // Admin email - show password step
        setIsAdmin(true)
        setStep('password')
        setMessage('Admin access detected. Please enter the admin password.')
      } else {
        // Regular viewer - grant immediate access
        localStorage.setItem('scrappers_user_email', email)
        localStorage.setItem('scrappers_is_admin', 'false')
        
        setMessage('Access granted! Redirecting...')
        
        setTimeout(() => {
          router.push('/')
        }, 1000)
      }

    } catch {
      setMessage('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setMessage('')

    try {
      // Verify password with API route
      const response = await fetch('/api/admin/verify-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage(data.error || 'Invalid password')
        return
      }

      // Password correct - grant admin access
      localStorage.setItem('scrappers_user_email', email)
      localStorage.setItem('scrappers_is_admin', 'true')
      
      setMessage('Admin access granted! Redirecting...')
      
      setTimeout(() => {
        router.push('/')
      }, 1000)

    } catch {
      setMessage('An unexpected error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setStep('email')
    setIsAdmin(false)
    setPassword('')
    setMessage('')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Welcome to Scrappers Cup
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            {step === 'email' 
              ? 'Enter your authorized email to access the ladder'
              : 'Enter the admin password to continue'
            }
          </p>
        </div>

        {step === 'email' ? (
          <form className="mt-8 space-y-6" onSubmit={handleEmailSubmit}>
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Checking...' : 'Continue'}
              </button>
            </div>
          </form>
        ) : (
          <form className="mt-8 space-y-6" onSubmit={handlePasswordSubmit}>
            <div>
              <div className="mb-4 p-3 bg-blue-50 rounded-md">
                <p className="text-sm text-blue-800">
                  <strong>Admin Email:</strong> {email}
                </p>
              </div>
              
              <label htmlFor="password" className="sr-only">
                Admin Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                className="appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                placeholder="Admin password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            <div className="flex space-x-3">
              <button
                type="button"
                onClick={handleBack}
                disabled={loading}
                className="flex-1 py-2 px-4 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Verifying...' : 'Sign In'}
              </button>
            </div>
          </form>
        )}

        {message && (
          <div className={`text-center text-sm ${
            message.startsWith('Error') || message.includes('Invalid') || message.includes('not authorized')
              ? 'text-red-600' 
              : message.includes('Admin access detected')
              ? 'text-blue-600'
              : 'text-green-600'
          }`}>
            {message}
          </div>
        )}
      </div>
    </div>
  )
}