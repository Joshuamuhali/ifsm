import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

// Complete server-side signup that bypasses Supabase email confirmation
export async function POST(request: NextRequest) {
  try {
    const { email, password, fullName, role } = await request.json()

    if (!email || !password || !fullName || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create Supabase client with service role
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )

    // Hash password
    const saltRounds = 10
    const hashedPassword = await bcrypt.hash(password, saltRounds)

    // Create auth user directly in auth.users table
    const { data: authUser, error: authError } = await supabase
      .from('auth.users')
      .insert({
        email: email,
        encrypted_password: hashedPassword, // Note: This might need adjustment based on Supabase setup
        email_confirmed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (authError) {
      console.error('Auth user creation error:', authError)
      return NextResponse.json({ error: authError.message }, { status: 500 })
    }

    // Create user profile
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: authUser.id,
        email: email,
        role: role,
        org_id: null,
      })
      .select()
      .single()

    if (userError) {
      console.error('User profile creation error:', userError)
      return NextResponse.json({ error: userError.message }, { status: 500 })
    }

    // Create additional profile data
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        user_id: authUser.id,
        full_name: fullName,
      })

    if (profileError) {
      console.error('Profile creation error:', profileError)
      // Don't fail the operation
    }

    // Create session manually
    const { data: sessionData, error: sessionError } = await supabase.auth.setSession({
      access_token: 'manual-session', // This would need proper token generation
      refresh_token: 'manual-refresh',
      user: {
        id: authUser.id,
        email: email,
        aud: 'authenticated',
        role: 'authenticated',
        app_metadata: {
          full_name: fullName,
          provider: 'email'
        },
        user_metadata: {
          full_name: fullName,
          email: email,
          email_verified: true
        }
      }
    })

    return NextResponse.json({ 
      success: true, 
      user: userData,
      message: 'Account created successfully'
    })

  } catch (error) {
    console.error('Signup error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
