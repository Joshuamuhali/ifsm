import { redirect } from "next/navigation"
import { isSupabaseConfigured } from "@/lib/supabase-client"
import { getCurrentUser, checkEmailConfirmation } from "@/lib/auth-helpers"

export default async function Home() {
  // Check if Supabase is configured
  if (!isSupabaseConfigured()) {
    redirect("/setup")
  }

  // Check if user is authenticated
  const user = await getCurrentUser()
  
  if (!user) {
    redirect("/auth")
  }

  // Check if user needs email confirmation
  const { needsConfirmation } = await checkEmailConfirmation(user.id)
  
  if (needsConfirmation) {
    redirect("/auth?message=email_confirmation_required")
  }

  // User is authenticated and confirmed - redirect to dashboard
  redirect("/dashboard")
}
