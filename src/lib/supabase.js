/**
 * Supabase client — WITHOUT client-side auth.
 *
 * Auth is handled by our Netlify Functions. The Supabase client
 * is only used for DATABASE QUERIES — using an access token provided
 * by our server via the /api/auth/session endpoint.
 *
 * KEY INSIGHT:
 * supabase.auth.setSession() doesn't work reliably when auth is disabled.
 * Instead, we create a NEW client with the token baked into the global
 * Authorization header. This guarantees every request carries the JWT.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env and fill in your project credentials.'
  )
}

// Default client — unauthenticated (anon key only)
let supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

/**
 * Replace the Supabase client with one that carries the user's JWT.
 *
 * How Supabase auth works at the HTTP level:
 *   - apikey header: always the anon key (identifies your project)
 *   - Authorization header: the user's JWT (identifies the user for RLS)
 *
 * When both headers are present, Postgres uses the JWT to resolve
 * auth.uid() in RLS policies. Without the Authorization header,
 * auth.uid() returns null and all RLS policies fail.
 *
 * We set the JWT via global.headers so it's included in every request
 * automatically — no per-query configuration needed.
 */
export function setAccessToken(accessToken) {
  if (!accessToken) return

  supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}

/**
 * Get the current Supabase client.
 * Use this instead of importing supabase directly, since the
 * client reference changes when setAccessToken() is called.
 */
export function getSupabase() {
  return supabase
}

// Also export as default for backward compatibility
export { supabase }
