import { type NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { email, token } = await req.json()

    if (!email || !token) {
      return NextResponse.json(
        { error: 'Email and token are required' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    // Update user verification status in database
    const { error: updateError } = await supabase
      .from('users')
      .update({ 
        email_confirmed_at: new Date().toISOString(),
        is_verified: true 
      })
      .eq('email', email)

    if (updateError) {
      console.error('Error updating user verification status:', updateError)
    }

    return NextResponse.json({ success: true, data })
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid request' },
      { status: 500 }
    )
  }
}
