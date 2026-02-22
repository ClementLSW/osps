/**
 * Auth Login — /api/auth/login
 *
 * This is step 1 of the PKCE OAuth flow. Here's what happens:
 *
 * 1. We generate a PKCE pair:
 *    - code_verifier: A random string (kept secret, stored in a cookie)
 *    - code_challenge: SHA256 hash of the verifier (sent to the auth server)
 *
 * 2. We redirect the user to Supabase's /authorize endpoint, which:
 *    - Stores our code_challenge
 *    - Redirects to Google's consent screen
 *    - After consent, Google redirects back to Supabase
 *    - Supabase redirects to OUR /api/auth/callback with a one-time code
 *
 * WHY PKCE?
 *
 * Without PKCE (plain OAuth):
 *   - Auth server returns a code
 *   - Anyone who intercepts the code can exchange it for tokens
 *
 * With PKCE:
 *   - Auth server returns a code
 *   - To exchange it, you ALSO need the code_verifier
 *   - The verifier is in an httpOnly cookie that only our server can read
 *   - Even if someone intercepts the code, they can't complete the exchange
 *
 * The code_challenge proves to the auth server that whoever exchanges
 * the code is the same party that initiated the flow, without ever
 * sending the verifier over the wire.
 */

import crypto from 'crypto'
import { buildCookieHeader } from './_utils/cookies.mjs'

/**
 * Generate a code_verifier: 32 random bytes, base64url encoded.
 * Spec requires 43-128 characters; 32 bytes → 43 chars in base64url.
 */
function generateCodeVerifier() {
  return crypto.randomBytes(32).toString('base64url')
}

/**
 * Generate a code_challenge from a verifier.
 * challenge = base64url(SHA256(verifier))
 *
 * The auth server stores this. Later, when we exchange the code,
 * we send the original verifier. The auth server hashes it and
 * checks if it matches — proving we're the same party.
 */
function generateCodeChallenge(verifier) {
  return crypto.createHash('sha256').update(verifier).digest('base64url')
}

export default async (request) => {
  const supabaseUrl = process.env.SUPABASE_URL
  const siteUrl = process.env.SITE_URL || new URL(request.url).origin

  // Step 1: Generate PKCE pair
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)

  // Step 2: Build the Supabase authorize URL
  // This is Supabase's OAuth entry point — it will redirect to Google
  const authUrl = new URL(`${supabaseUrl}/auth/v1/authorize`)
  authUrl.searchParams.set('provider', 'google')
  authUrl.searchParams.set('redirect_to', `${siteUrl}/api/auth/callback`)
  authUrl.searchParams.set('code_challenge', codeChallenge)
  authUrl.searchParams.set('code_challenge_method', 'S256')

  // Step 3: Store the verifier in an httpOnly cookie
  // This cookie travels with the browser when Supabase redirects
  // back to /api/auth/callback. Max-Age=600 (10 minutes) is plenty
  // for the user to complete the Google consent flow.
  const verifierCookie = buildCookieHeader('pkce_verifier', codeVerifier, {
    maxAge: 600, // 10 minutes
    httpOnly: true,
    secure: true,
    sameSite: 'Lax', // Must be Lax for the OAuth redirect to include it
  })

  // Step 4: Redirect to Supabase → Google
  return new Response(null, {
    status: 302,
    headers: {
      Location: authUrl.toString(),
      'Set-Cookie': verifierCookie,
      'Cache-Control': 'no-store', // Never cache auth redirects
    },
  })
}
