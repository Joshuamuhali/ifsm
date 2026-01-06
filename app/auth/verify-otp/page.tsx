'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ROLE_DASHBOARD_ROUTES } from '@/lib/constants/roles'
import { getSupabaseClient } from '@/lib/supabase-client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/use-toast'
import { Mail, Shield, ArrowLeft } from 'lucide-react'

export default function VerifyOTPPage() {
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const supabase = getSupabaseClient()

  // Get email from URL params or localStorage
  useEffect(() => {
    const emailFromParams = searchParams.get('email')
    const emailFromStorage = localStorage.getItem('signup_email')
    
    if (emailFromParams) {
      setEmail(emailFromParams)
      localStorage.setItem('signup_email', emailFromParams)
    } else if (emailFromStorage) {
      setEmail(emailFromStorage)
    }
  }, [searchParams])

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setErrors({})

    if (!otp.trim()) {
      setErrors({ otp: 'Please enter OTP code' })
      setLoading(false)
      return
    }

    if (!email) {
      setErrors({ email: 'Email is required for verification' })
      setLoading(false)
      return
    }

    try {
      // Verify OTP with Supabase - try different verification methods
      let verifyData
      let verifyError
      
      // First try with email type (for signup verification)
      const emailResult = await supabase.auth.verifyOtp({
        email: email,
        token: otp,
        type: 'email'
      })
      
      if (emailResult.data && emailResult.data.user) {
        verifyData = emailResult.data
        verifyError = emailResult.error
      } else {
        // Try with signup type as fallback
        const signupResult = await supabase.auth.verifyOtp({
          email: email,
          token: otp,
          type: 'signup'
        })
        
        verifyData = signupResult.data
        verifyError = signupResult.error
      }

      if (verifyError) {
        console.error('OTP verification error:', verifyError)
        
        // Handle specific error types
        if (verifyError.message?.includes('expired')) {
          setErrors({ otp: 'OTP code has expired. Please request a new one below.' })
        } else if (verifyError.message?.includes('invalid')) {
          setErrors({ otp: 'Invalid OTP code. Please check your email and try again.' })
        } else {
          setErrors({ otp: `OTP verification failed: ${verifyError.message}. Please try again or request a new code.` })
        }
        return
      }

      if (verifyData.user && verifyData.session) {
        // OTP verified successfully and user is logged in
        toast({
          title: 'Email Verified!',
          description: 'Your account has been successfully verified and you are now logged in.',
        })

        const userId = verifyData.user.id
        if (!userId) {
          setErrors({ otp: 'User verification failed. Please try again.' })
          return
        }

        // Mark user as verified in database
        try {
          const { error: updateError } = await supabase
            .from('users')
            .update({ is_verified: true, updated_at: new Date().toISOString() })
            .eq('id', userId)

          if (updateError) {
            console.error('Error updating verification status:', updateError)
            toast({
              title: 'Verification Warning',
              description: 'Account verified but unable to update status. You can continue using your account.',
              variant: 'default',
            })
          } else {
            console.log('User verification status updated successfully')
          }
        } catch (dbError) {
          console.error('Database error during verification update:', dbError)
          toast({
            title: 'Database Warning',
            description: 'Account verified successfully. You can continue to your dashboard.',
            variant: 'default',
          })
        }

        // Fetch user role from database (final authority)
        try {
          const { data: profile, error: roleError } = await supabase
            .from('users')
            .select('role')
            .eq('id', userId)
            .single()

          if (roleError) {
            console.error('Error fetching user role:', roleError)
            // Default to driver role if database fails
            const defaultDashboard = ROLE_DASHBOARD_ROUTES.driver || '/dashboard'
            toast({
              title: 'Login Successful!',
              description: 'Account verified successfully. Redirecting to dashboard.',
            })
            
            localStorage.removeItem('signup_email')
            localStorage.removeItem('signup_role')

            router.replace(defaultDashboard)
            return
          }

          const role = profile?.role || 'driver'
          const dashboardRoute = ROLE_DASHBOARD_ROUTES[role as keyof typeof ROLE_DASHBOARD_ROUTES] || '/dashboard'
          
          if (!dashboardRoute) {
            setErrors({ otp: 'Invalid user role. Please contact support.' })
            return
          }
          
          toast({
            title: 'Login Successful!',
            description: 'OTP verified successfully.',
          })

          localStorage.removeItem('signup_email')
          localStorage.removeItem('signup_role')

          router.replace(dashboardRoute)
        } catch (roleFetchError) {
          console.error('Error fetching user role:', roleFetchError)
          const defaultDashboard = ROLE_DASHBOARD_ROUTES.driver || '/dashboard'
          toast({
            title: 'Login Successful!',
            description: 'Account verified successfully. Redirecting to dashboard.',
          })
          
          router.replace(defaultDashboard)
        }
      } else {
        setErrors({ otp: 'OTP verification failed. Please try again.' })
      }
    } catch (error) {
      console.error('OTP verification error:', error)
      setErrors({ otp: 'An error occurred during verification. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const handleResendOTP = async () => {
    if (!email) {
      setErrors({ email: 'Please enter your email address first' })
      return
    }

    setLoading(true)
    setErrors({})
    
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
      })

      if (error) {
        console.error('Resend OTP error:', error)
        
        if (error.message?.includes('rate_limit')) {
          setErrors({ otp: 'Too many requests. Please wait a few minutes before trying again.' })
        } else if (error.message?.includes('expired')) {
          setErrors({ otp: 'Previous OTP expired. A new one has been sent to your email.' })
        } else {
          setErrors({ otp: 'Failed to resend OTP. Please try again later.' })
        }
        return
      }

      toast({
        title: 'OTP Resent!',
        description: 'Please check your email for the new 8-digit OTP code.',
      })
    } catch (error) {
      console.error('Resend OTP error:', error)
      setErrors({ otp: 'Failed to resend OTP. Please try again.' })
    } finally {
      setLoading(false)
    }
  }

  const handleBackToLogin = () => {
    localStorage.removeItem('signup_email')
    localStorage.removeItem('signup_role')
    router.push('/auth')
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        <Card className="shadow-2xl border-0 bg-white/95 backdrop-blur-sm">
          <CardHeader className="space-y-1 pb-6">
            <div className="flex items-center justify-center gap-3 mb-4">
              <div className="bg-green-600 p-3 rounded-2xl">
                <Shield className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 font-sans">Verify OTP</h1>
                <p className="text-sm text-gray-600 font-sans">Email Verification Required</p>
              </div>
            </div>
            <CardTitle className="text-center font-sans text-gray-900">Check Your Email</CardTitle>
            <CardDescription className="text-center font-sans text-gray-600">
              Enter the 8-digit OTP code sent to your email address
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form onSubmit={handleVerifyOTP} className="space-y-5">
              <div className="space-y-3">
                <Label htmlFor="email" className="font-sans text-sm font-medium text-gray-700">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="Enter your email address"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 font-sans h-11 border-gray-200 focus:border-green-500 focus:ring-green-500/20"
                    required
                  />
                </div>
                {errors.email && (
                  <p className="text-sm text-red-600 font-sans flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                    </div>
                    {errors.email}
                  </p>
                )}
              </div>

              <div className="space-y-3">
                <Label htmlFor="otp" className="font-sans text-sm font-medium text-gray-700">OTP Code</Label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <Input
                    id="otp"
                    type="text"
                    placeholder="Enter 8-digit OTP code"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                    maxLength={8}
                    className="pl-10 font-sans h-11 border-gray-200 focus:border-green-500 focus:ring-green-500/20 text-center text-lg font-mono tracking-widest"
                    required
                  />
                </div>
                {errors.otp && (
                  <p className="text-sm text-red-600 font-sans flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                    </div>
                    {errors.otp}
                  </p>
                )}
                <p className="text-xs text-gray-500 font-sans flex items-center gap-2">
                  <Mail className="h-3 w-3" />
                  Check your inbox for the 8-digit verification code
                </p>
              </div>

              <Button type="submit" className="w-full font-sans h-11 bg-green-600 hover:bg-green-700 text-white shadow-lg hover:shadow-xl transition-all duration-200" disabled={loading}>
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Verifying OTP...
                  </div>
                ) : (
                  'Verify OTP'
                )}
              </Button>

              {errors.otp && (
                <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm font-sans">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-red-100 rounded-full flex items-center justify-center">
                      <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                    </div>
                    {errors.otp}
                  </div>
                </div>
              )}

              <div className="space-y-3 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResendOTP}
                  disabled={loading}
                  className="w-full font-sans h-11 border-gray-200 hover:border-green-500 hover:text-green-600 transition-all duration-200"
                >
                  {loading ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-green-600 border-t-transparent rounded-full animate-spin"></div>
                      Sending new code...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 4.26a12 12 0 01.18.15l1.82-3.43-1.92 1.92-1.92 0-1.82-.63-3.43-1.82L3 8m8 8v8l-4.35-4.35M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Resend OTP Code
                    </div>
                  )}
                </Button>
                
                <Button
                  type="button"
                  variant="ghost"
                  onClick={handleBackToLogin}
                  disabled={loading}
                  className="w-full font-sans h-11 text-gray-600 hover:text-gray-700 hover:bg-gray-50 transition-all duration-200"
                >
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Login
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
