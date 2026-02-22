/**
 * Auth Logout — /api/auth/logout
 *
 * Cleans up the session from both sides:
 *   1. Server-side: Tells Supabase to revoke the refresh token
 *      so it can't be used even if someone somehow extracted it
 *   2. Client-side: Clears the httpOnly cookie from the browser
 *
 * Why both? Defense in depth:
 *   - Clearing the cookie means the browser stops sending it
 *   - Revoking server-side means even if the cookie value was
 *     somehow captured, it's useless
 *
 * This is a POST request (not GET) because logout is a state-changing
 * action. GET requests should be idempotent (safe to repeat/cache).
 * Browsers and proxies can prefetch GET URLs, which could accidentally
 * log you out. POST prevents that.
 */

import { parseCookies, decrypt, clearCookieHeader } from './_utils/cookies.mjs'

export default async (request) => {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  // Step 1: Read the session cookie to get the access token
  const cookies = parseCookies(request)
  const sessionCookie = cookies['osps-session']

  if (sessionCookie) {
    const session = decrypt(sessionCookie)

    if (session?.access_token) {
      // Step 2: Tell Supabase to revoke this session
      // The access_token is sent as a Bearer token in the Authorization header
      // This is how Supabase identifies which session to kill
      try {
        await fetch(`${supabaseUrl}/auth/v1/logout`, {
          method: 'POST',
          headers: {
            apikey: supabaseAnonKey,
            Authorization: `Bearer ${session.access_token}`,
          },
        })
      } catch (err) {
        // Revocation failed — not critical, cookie will be cleared anyway
        // The token will expire naturally (1 hour)
        console.warn('Session revocation failed:', err.message)
      }
    }
  }

  // Step 3: Clear the session cookie
  return new Response(
    JSON.stringify({ success: true }),
    {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': clearCookieHeader('osps-session'),
        'Cache-Control': 'no-store',
      },
    }
  )
}
