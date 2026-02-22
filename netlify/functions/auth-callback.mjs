/**
 * Auth Callback — /api/auth/callback
 *
 * This is step 2 of the PKCE flow. The user has just:
 *   1. Been redirected to Google by our login function
 *   2. Consented to share their info
 *   3. Google redirected back to Supabase
 *   4. Supabase redirected here with ?code=xxx
 *
 * Now we need to:
 *   1. Read the code_verifier from the httpOnly cookie
 *   2. Send both the code AND the verifier to Supabase's token endpoint
 *   3. Supabase verifies SHA256(verifier) matches the challenge from step 1
 *   4. If it matches, Supabase returns access_token + refresh_token
 *   5. We encrypt the tokens and store them in an httpOnly session cookie
 *   6. Redirect to /dashboard
 *
 * THE TOKEN EXCHANGE (most important part):
 *
 *   POST {supabase}/auth/v1/token?grant_type=pkce
 *   Body: { auth_code: "xxx", code_verifier: "yyy" }
 *
 * This is a SERVER-TO-SERVER call. The browser never sees the tokens.
 * They go straight from Supabase into our encrypted cookie.
 *
 * Compare this to the implicit flow where tokens appear in the URL
 * hash and are read by JavaScript — here, JavaScript never touches them.
 */

import {
  parseCookies,
  encrypt,
  buildCookieHeader,
  clearCookieHeader,
} from './_utils/cookies.mjs'

export default async (request) => {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
  const siteUrl = process.env.SITE_URL || new URL(request.url).origin

  // Step 1: Extract the auth code from the URL
  const url = new URL(request.url)
  const authCode = url.searchParams.get('code')

  if (!authCode) {
    // No code means something went wrong with the OAuth flow
    // (user cancelled, or Supabase returned an error)
    const error = url.searchParams.get('error_description') || 'No auth code received'
    console.error('OAuth callback error:', error)
    return Response.redirect(`${siteUrl}/?error=${encodeURIComponent(error)}`, 302)
  }

  // Step 2: Read the code_verifier from the httpOnly cookie
  // This was set by our /api/auth/login function
  const cookies = parseCookies(request)
  const codeVerifier = cookies.pkce_verifier

  if (!codeVerifier) {
    // The cookie expired or was cleared — user took too long
    // or opened the callback URL directly
    console.error('Missing PKCE verifier cookie')
    return Response.redirect(`${siteUrl}/?error=session_expired`, 302)
  }

  // Step 3: Exchange the code + verifier for tokens
  // This is the critical server-to-server call
  try {
    const tokenResponse = await fetch(
      `${supabaseUrl}/auth/v1/token?grant_type=pkce`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({
          auth_code: authCode,
          code_verifier: codeVerifier,
        }),
      }
    )

    if (!tokenResponse.ok) {
      const errorBody = await tokenResponse.text()
      console.error('Token exchange failed:', tokenResponse.status, errorBody)
      return Response.redirect(`${siteUrl}/?error=token_exchange_failed`, 302)
    }

    const tokenData = await tokenResponse.json()

    // tokenData contains:
    // {
    //   access_token: "eyJ...",     — short-lived JWT (1 hour)
    //   refresh_token: "xxx",        — long-lived (used to get new access tokens)
    //   expires_in: 3600,            — seconds until access_token expires
    //   token_type: "bearer",
    //   user: { id, email, ... }     — user profile from Supabase
    // }

    // Step 4: Encrypt the tokens and store in a session cookie
    // We store both tokens so we can refresh server-side when needed
    const sessionData = {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: Date.now() + tokenData.expires_in * 1000,
      user: {
        id: tokenData.user.id,
        email: tokenData.user.email,
        display_name:
          tokenData.user.user_metadata?.full_name ||
          tokenData.user.user_metadata?.display_name ||
          tokenData.user.email?.split('@')[0],
        avatar_url: tokenData.user.user_metadata?.avatar_url,
      },
    }

    const encryptedSession = encrypt(sessionData)

    // Step 5: Set the session cookie and clear the PKCE verifier cookie
    // Two Set-Cookie headers: one to set session, one to clear verifier
    const sessionCookie = buildCookieHeader('osps-session', encryptedSession, {
      maxAge: 60 * 60 * 24 * 7, // 7 days — refresh_token handles reauth
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
    })

    const clearVerifier = clearCookieHeader('pkce_verifier')

    // Step 6: Redirect to dashboard
    return new Response(null, {
      status: 302,
      headers: [
        ['Location', `${siteUrl}/dashboard`],
        ['Set-Cookie', sessionCookie],
        ['Set-Cookie', clearVerifier],
        ['Cache-Control', 'no-store'],
      ],
    })
  } catch (err) {
    console.error('Token exchange error:', err)
    return Response.redirect(`${siteUrl}/?error=server_error`, 302)
  }
}
