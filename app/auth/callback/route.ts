import { getSupabaseServer } from "@/lib/supabase-server"
import { NextRequest, NextResponse } from "next/server"
import { ROLE_DASHBOARD_ROUTES } from "@/lib/constants/roles"

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const code = requestUrl.searchParams.get("code")
  const error = requestUrl.searchParams.get("error")
  const errorDescription = requestUrl.searchParams.get("error_description")

  // Handle errors from Supabase
  if (error) {
    console.error("Auth callback error:", error, errorDescription)
    return NextResponse.redirect(`${requestUrl.origin}/auth?error=auth_failed&message=${encodeURIComponent(errorDescription || 'Authentication failed')}`)
  }

  if (code) {
    const supabase = await getSupabaseServer()

    try {
      const { data, error } = await supabase.auth.exchangeCodeForSession(code)
      
      if (error) {
        console.error("Error exchanging code for session:", error)
        return NextResponse.redirect(`${requestUrl.origin}/auth?error=auth_failed&message=${encodeURIComponent(error.message)}`)
      }

      if (data.user) {
        console.log("User authenticated:", data.user.email, "ID:", data.user.id)
        
        // Check if user has a profile in the users table
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('role, org_id')
          .eq('id', data.user.id)
          .single()

        console.log("Profile query result:", { profile, profileError })

        if (profileError) {
          console.error('Error fetching user profile:', profileError)
          
          // Only redirect to setup if profile truly doesn't exist, not if there's an access error
          if (profileError.message?.includes('No rows found') || profileError.code === 'PGRST116') {
            console.log("Profile doesn't exist, redirecting to setup")
            
            // For Google OAuth users, create a basic profile automatically
            if (data.user.app_metadata?.provider === 'google') {
              const { error: insertError } = await supabase
                .from('users')
                .insert({
                  id: data.user.id,
                  email: data.user.email,
                  full_name: data.user.user_metadata?.full_name || data.user.user_metadata?.name || 'Google User',
                  role: 'driver', // Default role for Google users
                  is_verified: true, // Google users are pre-verified
                  created_at: new Date().toISOString(),
                })

              if (insertError) {
                console.error('Error creating Google user profile:', insertError)
                return NextResponse.redirect(`${requestUrl.origin}/auth?error=profile_creation_failed&message=${encodeURIComponent('Failed to create user profile')}`)
              }

              console.log("Google user profile created successfully")
              return NextResponse.redirect(`${requestUrl.origin}/dashboard/driver`)
            } else {
              return NextResponse.redirect(`${requestUrl.origin}/auth/setup?user_id=${data.user.id}`)
            }
          } else {
            // This is likely a database access issue, redirect to auth with error
            console.log("Database access error, redirecting to auth")
            return NextResponse.redirect(`${requestUrl.origin}/auth?error=profile_access_failed&message=${encodeURIComponent('Unable to access user profile')}`)
          }
        }

        console.log("User profile found:", profile)
        
        // Redirect to role-specific dashboard
        const dashboardRoute = ROLE_DASHBOARD_ROUTES[profile?.role as keyof typeof ROLE_DASHBOARD_ROUTES]
        const redirectUrl = dashboardRoute || '/auth'
        console.log("Redirecting to:", redirectUrl)
        return NextResponse.redirect(`${requestUrl.origin}${redirectUrl}`)
      }
    } catch (error) {
      console.error("Auth callback error:", error)
      return NextResponse.redirect(`${requestUrl.origin}/auth?error=auth_failed`)
    }
  }

  // If no code, redirect to auth page
  return NextResponse.redirect(`${requestUrl.origin}/auth`)
}
