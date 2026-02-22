/**
 * Auth Signup — /api/auth/signup
 *
 * Creates a new account with email + password via Supabase's
 * server-side auth API. On success, sets an encrypted session
 * cookie — same as the OAuth flow.
 *
 * Request body:
 *   { email: "user@example.com", password: "...", displayName: "..." }
 *
 * Supabase may require email confirmation depending on your project
 * settings (Authentication → Settings → Enable email confirmations).
 * If enabled, the user gets a confirmation email and can't sign in
 * until they click the link. We handle both cases.
 */

import { encrypt, buildCookieHeader } from './_utils/cookies.mjs'

export default async (request) => {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
  const siteUrl = process.env.SITE_URL || new URL(request.url).origin

  // Only accept POST
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { email, password, displayName } = await request.json()

    if (!email || !password) {
      return new Response(
        JSON.stringify({ error: 'Email and password are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Call Supabase's signup endpoint server-to-server
    const signupResponse = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({
        email,
        password,
        data: {
          display_name: displayName || email.split('@')[0],
        },
      }),
    })

    const signupData = await signupResponse.json()

    if (!signupResponse.ok) {
      return new Response(
        JSON.stringify({
          error: signupData.error_description || signupData.msg || 'Signup failed',
        }),
        { status: signupResponse.status, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Check if email confirmation is required
    // When confirmation is required, Supabase returns a user but no session
    if (!signupData.access_token) {
      return new Response(
        JSON.stringify({
          success: true,
          confirmationRequired: true,
          message: 'Check your email to confirm your account.',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // No confirmation required — user is immediately authenticated
    const sessionData = {
      access_token: signupData.access_token,
      refresh_token: signupData.refresh_token,
      expires_at: Date.now() + signupData.expires_in * 1000,
      user: {
        id: signupData.user.id,
        email: signupData.user.email,
        display_name:
          signupData.user.user_metadata?.display_name ||
          displayName ||
          email.split('@')[0],
        avatar_url: signupData.user.user_metadata?.avatar_url,
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
    console.error('Signup error:', err)
    return new Response(
      JSON.stringify({ error: 'Server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
