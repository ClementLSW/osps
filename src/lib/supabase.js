/**
 * Supabase client — now WITHOUT client-side auth.
 *
 * Previously, Supabase handled the entire auth flow client-side
 * (OAuth redirects, token storage in localStorage, auto-refresh).
 *
 * Now, auth is handled by our Netlify Functions. The Supabase client
 * is only used for DATABASE QUERIES — using an access token provided
 * by our server via the /api/auth/session endpoint.
 *
 * ARCHITECTURE CHANGE:
 *
 *   Before (implicit flow):
 *     Browser ←→ Supabase Auth (tokens in localStorage)
 *     Browser ←→ Supabase DB (using localStorage token)
 *
 *   After (server-side PKCE):
 *     Browser ←→ Our Server ←→ Supabase Auth (tokens in httpOnly cookie)
 *     Browser ←→ Supabase DB (using in-memory access token from server)
 *
 * The key difference: createClient() below has auth DISABLED.
 * We manually set the access token via supabase.auth.setSession()
 * or by using createAuthenticatedClient() with a token.
 */

import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Copy .env.example to .env and fill in your project credentials.'
  )
}

/**
 * Default Supabase client — NO auto auth.
 *
 * persistSession: false → Don't save tokens to localStorage
 * autoRefreshToken: false → Our server handles refresh
 * detectSessionInUrl: false → We handle OAuth redirects server-side
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

/**
 * Set the access token on the default client.
 *
 * Called by useAuth after fetching the session from our server.
 * This makes all subsequent Supabase queries (selects, inserts, etc.)
 * use this token — which means RLS policies see the correct user.
 *
 * @param {string} accessToken - JWT from /api/auth/session
 */
export async function setAccessToken(accessToken) {
  if (!accessToken) return

  // setSession requires both tokens but we only have the access token
  // (refresh token is safe in the httpOnly cookie on the server)
  // We pass an empty refresh token — it won't be used since
  // autoRefreshToken is disabled
  await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: '',
  })
}
