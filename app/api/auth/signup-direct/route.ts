import { type NextRequest, NextResponse } from "next/server"
import { signUpWithoutConfirmation } from "@/lib/auth-helpers"
import { handleError } from "@/lib/api-helpers"

/**
 * POST /api/auth/signup-direct - Sign up without email confirmation
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()

    // Validate required fields
    if (!body.email || !body.password) {
      return NextResponse.json({
        success: false,
        error: "Email and password are required"
      }, { status: 400 })
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(body.email)) {
      return NextResponse.json({
        success: false,
        error: "Invalid email format"
      }, { status: 400 })
    }

    // Validate password length
    if (body.password.length < 6) {
      return NextResponse.json({
        success: false,
        error: "Password must be at least 6 characters"
      }, { status: 400 })
    }

    // Sign up without email confirmation
    const { data, error } = await signUpWithoutConfirmation(
      body.email,
      body.password,
      {
        full_name: body.full_name,
        role: body.role || 'driver',
        phone: body.phone,
      }
    )

    if (error) {
      return NextResponse.json({
        success: false,
        error: error.message || "Failed to sign up"
      }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      data: {
        user: data.user,
        session: data.session
      },
      message: "Account created successfully"
    })
  } catch (error) {
    return NextResponse.json(handleError(error, "Failed to sign up"), { status: 500 })
  }
}
