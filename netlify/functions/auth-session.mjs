/**
 * Auth Session — /api/auth/session
 *
 * Called by the React app on every page load to check if the user
 * is logged in and get a valid access token for Supabase queries.
 *
 * This is the "token relay" pattern:
 *   - The REFRESH token stays in the httpOnly cookie (XSS-proof)
 *   - The ACCESS token is returned in the JSON response body
 *   - The React app stores the access token in memory (React state)
 *   - If the page refreshes, it calls this endpoint again
 *
 * Why not keep both tokens in the cookie?
 *   We could, but then every Supabase query would need to go through
 *   our server (because the browser can't read httpOnly cookies).
 *   By returning the short-lived access token to the client, we let
 *   the React app talk to Supabase directly — keeping RLS, Realtime,
 *   and all the nice client-side features working.
 *
 * Security tradeoff:
 *   - Access token in JS memory IS accessible to XSS
 *   - BUT it expires in 1 hour
 *   - The refresh token (which can mint new access tokens) is safe
 *   - Compare to implicit flow where BOTH tokens are in localStorage
 *
 * TOKEN REFRESH FLOW:
 *
 *   Client calls /api/auth/session
 *   → Server reads encrypted cookie
 *   → Is access_token expired?
 *     → NO:  Return user + access_token
 *     → YES: POST {supabase}/auth/v1/token?grant_type=refresh_token
 *            Get new access_token + refresh_token
 *            Update the cookie with new tokens
 *            Return user + new access_token
 */

import { parseCookies, decrypt, encrypt, buildCookieHeader } from './_utils/cookies.mjs'

export default async (request) => {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  // Step 1: Read and decrypt the session cookie
  const cookies = parseCookies(request)
  const sessionCookie = cookies['osps-session']

  if (!sessionCookie) {
    // No cookie = not logged in
    return new Response(
      JSON.stringify({ user: null, accessToken: null }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  const session = decrypt(sessionCookie)

  if (!session) {
    // Decryption failed — cookie was tampered with or key changed
    return new Response(
      JSON.stringify({ user: null, accessToken: null, error: 'invalid_session' }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // Step 2: Check if access token is expired (with 60s buffer)
  const isExpired = Date.now() > (session.expires_at - 60_000)

  if (!isExpired) {
    // Token is still valid — return it directly
    return new Response(
      JSON.stringify({
        user: session.user,
        accessToken: session.access_token,
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }

  // Step 3: Token is expired — refresh it
  // This is a server-to-server call using the refresh_token
  try {
    const refreshResponse = await fetch(
      `${supabaseUrl}/auth/v1/token?grant_type=refresh_token`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          refresh_token: session.refresh_token,
        }),
      }
    )

    if (!refreshResponse.ok) {
      // Refresh token is invalid or expired — user needs to re-login
      console.error('Token refresh failed:', refreshResponse.status)
      return new Response(
        JSON.stringify({ user: null, accessToken: null, error: 'refresh_failed' }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }
      )
    }

    const newTokens = await refreshResponse.json()

    // Step 4: Update the session cookie with new tokens
    const updatedSession = {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      expires_at: Date.now() + newTokens.expires_in * 1000,
      user: session.user, // User info doesn't change on refresh
    }

    const newCookie = buildCookieHeader(
      'osps-session',
      encrypt(updatedSession),
      {
        maxAge: 60 * 60 * 24 * 7,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      }
    )

    return new Response(
      JSON.stringify({
        user: updatedSession.user,
        accessToken: updatedSession.access_token,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': newCookie,
        },
      }
    )
  } catch (err) {
    console.error('Session refresh error:', err)
    return new Response(
      JSON.stringify({ user: null, accessToken: null, error: 'server_error' }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  }
}
