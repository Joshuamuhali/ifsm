import { createClient } from '@supabase/supabase-js'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { userId, email, role, fullName, isVerified = false } = await request.json()

    if (!userId || !email || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Create Supabase client with service role key to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key
    )

    // Check if user already exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id, email, role, is_verified')
      .eq('id', userId)
      .single()

    if (existingUser) {
      // User already exists, return success
      return NextResponse.json({ 
        success: true, 
        user: existingUser,
        message: 'User profile already exists'
      })
    }

    // Create user profile with verification status
    const { data: userData, error: userError } = await supabase
      .from('users')
      .insert({
        id: userId,
        email: email,
        role: role,
        org_id: null,
        is_verified: isVerified,
      })
      .select()
      .single()

    if (userError) {
      console.error('User creation error:', userError)
      
      // Return appropriate status code based on error type
      let status = 500
      if (userError.message?.includes('duplicate key') || userError.code === '23505') {
        status = 409 // Conflict for duplicate entries
      }
      
      return NextResponse.json({ error: userError.message }, { status })
    }

    // Check if profile already exists
    const { data: existingProfile } = await supabase
      .from('profiles')
      .select('user_id, full_name')
      .eq('user_id', userId)
      .single()

    if (!existingProfile) {
      // Create additional profile data only if it doesn't exist
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          full_name: fullName,
        })

      if (profileError) {
        console.error('Profile creation error:', profileError)
        // Don't fail the whole operation if profile creation fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      user: userData 
    })

  } catch (error) {
    console.error('API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
