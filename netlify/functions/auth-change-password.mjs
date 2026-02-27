/**
 * Auth Change Password — /api/auth/change-password
 *
 * Two modes:
 *
 *   1. CHANGE password (user already has one):
 *      Body: { currentPassword: "old", newPassword: "new" }
 *      → Verify current password by attempting sign-in
 *      → If valid, update to new password
 *
 *   2. ADD password (Google-only user):
 *      Body: { newPassword: "new" }
 *      → No verification needed — they authenticated via Google
 *      → Set the password directly
 *
 * The client determines which mode to use based on the /api/auth/account
 * response (hasPassword field). The server validates regardless.
 */

import { parseCookies, decrypt } from './_utils/cookies.mjs'

export default async (request) => {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

  if (request.method !== 'POST') {
    return respond(405, { error: 'Method not allowed' })
  }

  // Read session
  const cookies = parseCookies(request)
  const session = decrypt(cookies['osps-session'] || '')
  if (!session?.access_token) {
    return respond(401, { error: 'Not authenticated' })
  }

  try {
    const { currentPassword, newPassword } = await request.json()

    if (!newPassword || newPassword.length < 6) {
      return respond(400, { error: 'New password must be at least 6 characters.' })
    }

    // If currentPassword was provided, verify it first
    // by attempting a sign-in with the user's email + current password
    if (currentPassword) {
      const verifyResponse = await fetch(
        `${supabaseUrl}/auth/v1/token?grant_type=password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: supabaseAnonKey,
          },
          body: JSON.stringify({
            email: session.user.email,
            password: currentPassword,
          }),
        }
      )

      if (!verifyResponse.ok) {
        return respond(401, { error: 'Current password is incorrect.' })
      }
    }

    // Update the password via Supabase's user endpoint
    const updateResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ password: newPassword }),
    })

    if (!updateResponse.ok) {
      const errorBody = await updateResponse.json().catch(() => ({}))
      console.error('Password update failed:', updateResponse.status, errorBody)
      return respond(400, {
        error: errorBody.error_description || errorBody.msg || 'Failed to update password.',
      })
    }

    return respond(200, { success: true })
  } catch (err) {
    console.error('Change password error:', err)
    return respond(500, { error: 'Server error' })
  }
}

function respond(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
