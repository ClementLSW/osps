/**
 * Auth Account — /api/auth/account
 *
 * Returns account information for the current user, including
 * which auth providers are linked and whether they have a password.
 *
 * Used by the Settings page to determine whether to show
 * "Change password" or "Add password".
 *
 * Response:
 *   { email, providers: ["google"], hasPassword: false }
 */

import { parseCookies, decrypt } from './_utils/cookies.mjs'

export default async (request) => {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  // Read session
  const cookies = parseCookies(request)
  const session = decrypt(cookies['osps-session'] || '')
  if (!session?.access_token) {
    return respond(401, { error: 'Not authenticated' })
  }

  try {
    // Fetch full user profile from Supabase Auth
    // This includes the identities array with provider info
    const userResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
    })

    if (!userResponse.ok) {
      return respond(401, { error: 'Session expired' })
    }

    const user = await userResponse.json()

    // Extract provider list from identities
    // e.g. ["google"], ["email"], or ["google", "email"]
    const providers = (user.identities || []).map(i => i.provider)
    const hasPassword = providers.includes('email')

    return respond(200, {
      email: user.email,
      providers,
      hasPassword,
    })
  } catch (err) {
    console.error('Account info error:', err)
    return respond(500, { error: 'Server error' })
  }
}

function respond(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
