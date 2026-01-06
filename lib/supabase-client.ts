import { createBrowserClient } from "@supabase/ssr"

let supabaseClient: ReturnType<typeof createBrowserClient> | null = null

function validateSupabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    return {
      isValid: false,
      error: "Supabase configuration is missing. Please add environment variables.",
    }
  }

  return { isValid: true, error: null }
}

export function getSupabaseClient() {
  if (!supabaseClient) {
    const config = validateSupabaseConfig()
    if (!config.isValid) {
      throw new Error(config.error)
    }

    supabaseClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    )
  }
  return supabaseClient
}

export function isSupabaseConfigured(): boolean {
  const config = validateSupabaseConfig()
  return config.isValid
}

export type SupabaseClient = ReturnType<typeof createBrowserClient>
