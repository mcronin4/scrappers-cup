'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface NavigationProps {
  user: { email: string }
  isAdmin: boolean
}

export default function Navigation({ user, isAdmin }: NavigationProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)
  const router = useRouter()

  const handleSignOut = () => {
    localStorage.removeItem('scrappers_user_email')
    localStorage.removeItem('scrappers_is_admin')
    router.push('/login')
  }

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen)
  }

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false)
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-8">
            <Link href="/" className="text-xl font-bold text-gray-900">
              🎾 Scrappers Cup
            </Link>
            
            <div className="hidden md:flex space-x-4">
              <Link
                href="/"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Leaderboard
              </Link>
              <Link
                href="/history"
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Game History
              </Link>
              
              {isAdmin && (
                <>
                  <Link
                    href="/admin"
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Admin Panel
                  </Link>
                  <Link
                    href="/admin/players"
                    className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
                  >
                    Manage Players
                  </Link>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Desktop user info and sign out */}
            <div className="hidden md:flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {user.email}
                {isAdmin && <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Admin</span>}
              </span>
              <button
                onClick={handleSignOut}
                className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium"
              >
                Sign Out
              </button>
            </div>

            {/* Mobile hamburger menu button */}
            <button
              onClick={toggleMobileMenu}
              className="md:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-600 hover:text-gray-900 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-blue-500"
              aria-expanded="false"
            >
              <span className="sr-only">Open main menu</span>
              {/* Hamburger icon */}
              {!isMobileMenuOpen ? (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              ) : (
                <svg className="block h-6 w-6" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-1 bg-white border-t border-gray-200">
              <Link
                href="/"
                onClick={closeMobileMenu}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium"
              >
                Leaderboard
              </Link>
              <Link
                href="/history"
                onClick={closeMobileMenu}
                className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium"
              >
                Game History
              </Link>
              
              {isAdmin && (
                <>
                  <Link
                    href="/admin"
                    onClick={closeMobileMenu}
                    className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium"
                  >
                    Admin Panel
                  </Link>
                  <Link
                    href="/admin/players"
                    onClick={closeMobileMenu}
                    className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 block px-3 py-2 rounded-md text-base font-medium"
                  >
                    Manage Players
                  </Link>
                </>
              )}
              
              {/* Mobile user info and sign out */}
              <div className="border-t border-gray-200 pt-3 mt-3">
                <div className="px-3 py-2">
                  <div className="text-sm text-gray-600 mb-2">
                    {user.email}
                    {isAdmin && <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">Admin</span>}
                  </div>
                  <button
                    onClick={() => {
                      handleSignOut()
                      closeMobileMenu()
                    }}
                    className="text-gray-600 hover:text-gray-900 hover:bg-gray-50 block w-full text-left px-3 py-2 rounded-md text-base font-medium"
                  >
                    Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  )
}