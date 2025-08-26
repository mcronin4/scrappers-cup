import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Check if email is an admin
    const { data: allowedEmail, error } = await supabase
      .from('allowed_emails')
      .select('*')
      .eq('email', email)
      .eq('is_admin', true)
      .single()

    if (error || !allowedEmail) {
      return NextResponse.json(
        { error: 'Invalid email or not an admin' },
        { status: 401 }
      )
    }

    // Verify password against environment variable
    const adminPassword = process.env.ADMIN_PASSWORD

    if (!adminPassword) {
      console.error('ADMIN_PASSWORD environment variable not set')
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      )
    }

    if (password !== adminPassword) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      )
    }

    // Password is correct - return success
    return NextResponse.json({
      success: true,
      email: allowedEmail.email,
      isAdmin: true
    })

  } catch (error) {
    console.error('Password verification error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}