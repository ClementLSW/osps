/**
 * Auth Set Session — /api/auth/set-session
 *
 * Receives raw Supabase tokens from the client-side confirm page,
 * validates them by calling Supabase's /auth/v1/user endpoint,
 * and encrypts them into an httpOnly session cookie.
 *
 * WHY THIS EXISTS:
 *
 * When a user clicks an email confirmation or password reset link,
 * Supabase verifies the token and redirects back to our site with
 * tokens in the URL hash fragment (#access_token=XXX&...).
 *
 * Hash fragments never reach the server — they stay in the browser.
 * So we need a thin client-side page (AuthConfirm.jsx) to read the
 * hash and POST the tokens here. This function validates them and
 * converts them into our encrypted cookie format.
 *
 * SECURITY:
 *   - Tokens are validated server-to-server before trusting
 *   - Tokens exist in JS memory briefly (the confirm page is ephemeral)
 *   - Tokens never enter localStorage
 *   - The resulting cookie is httpOnly + encrypted (same as OAuth flow)
 *
 * Request body:
 *   { access_token, refresh_token, expires_in }
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
    const { access_token, refresh_token, expires_in } = await request.json()

    if (!access_token || !refresh_token) {
      return new Response(
        JSON.stringify({ error: 'Missing tokens' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Validate the access token by fetching the user profile
    // This is a server-to-server call — proves the token is real
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${access_token}`,
      },
    })

    if (!userResponse.ok) {
      console.error('Token validation failed:', userResponse.status)
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const userData = await userResponse.json()

    // Build session — same structure as auth-callback and auth-signin
    const sessionData = {
      access_token,
      refresh_token,
      expires_at: Date.now() + (expires_in || 3600) * 1000,
      user: {
        id: userData.id,
        email: userData.email,
        display_name:
          userData.user_metadata?.display_name ||
          userData.user_metadata?.full_name ||
          userData.email?.split('@')[0],
        avatar_url: userData.user_metadata?.avatar_url,
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
    console.error('Set session error:', err)
    return new Response(
      JSON.stringify({ error: 'Server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
