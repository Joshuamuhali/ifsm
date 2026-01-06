import { createServerClient } from "@supabase/ssr"

// Cache the client to avoid recreating it on every call
let cachedClient: ReturnType<typeof createServerClient> | null = null

// This function should only be called from Server Components or API routes
export async function createSupabaseServerClient() {
  if (cachedClient) {
    return cachedClient
  }

  // Dynamic import to avoid client-side bundling issues
  const { cookies } = await import("next/headers")
  const cookieStore = await cookies()
  
  cachedClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.SUPABASE_SERVICE_ROLE_KEY || "",
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => 
              cookieStore.set(name, value, options)
            )
          } catch {
            // Handle cookie setting errors
          }
        },
      },
    },
  )
  
  return cachedClient
}
