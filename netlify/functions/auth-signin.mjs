/**
 * Auth Signin — /api/auth/signin
 *
 * Authenticates with email + password via Supabase's token endpoint
 * using the "password" grant type. On success, encrypts the tokens
 * into an httpOnly session cookie — identical to the OAuth flow.
 *
 * Request body:
 *   { email: "user@example.com", password: "..." }
 *
 * This is the email equivalent of the PKCE callback:
 *   - PKCE callback exchanges an auth code for tokens
 *   - This exchanges email+password for tokens
 *   - Both end with the same encrypted cookie
 */

import { encrypt, buildCookieHeader } from './_utils/cookies.mjs'

export default async (request) => {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Exchange email + password for tokens via Supabase's password grant
    // This is a server-to-server call — the password never touches
    // localStorage or any client-side storage
    const tokenResponse = await fetch(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ email, password }),
      }
    )

    const tokenData = await tokenResponse.json()

    if (!tokenResponse.ok) {
      return new Response(
        JSON.stringify({
          error: tokenData.error_description || tokenData.msg || 'Invalid credentials',
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Build session — same structure as OAuth callback
    const sessionData = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
      user: {
        id: tokenData.user.id,
        email: tokenData.user.email,
        display_name:
          tokenData.user.user_metadata?.display_name ||
          tokenData.user.user_metadata?.full_name ||
          tokenData.user.email?.split('@')[0],
        avatar_url: tokenData.user.user_metadata?.avatar_url,
      },
    }

    const sessionCookie = buildCookieHeader(
      'osps-session',
      encrypt(sessionData),
      {
        maxAge: 60 * 60 * 24 * 7,
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      }
    )

    return new Response(
      JSON.stringify({ success: true, user: sessionData.user }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': sessionCookie,
        },
      }
    )
  } catch (err) {
    console.error('Signin error:', err)
    return new Response(
      JSON.stringify({ error: 'Server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
