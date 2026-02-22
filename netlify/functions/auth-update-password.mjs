/**
 * Auth Update Password — /api/auth/update-password
 *
 * Updates the user's password using their active session.
 * Called from the /reset-password page after the user has been
 * authenticated via the password reset email flow.
 *
 * The flow:
 *   1. User clicks reset link in email
 *   2. Supabase verifies → redirects to /auth/confirm with tokens
 *   3. AuthConfirm.jsx → /api/auth/set-session → cookie set
 *   4. User lands on /reset-password with a valid session
 *   5. User enters new password → POST here
 *   6. We read the session cookie, call Supabase's update user endpoint
 *
 * Request body:
 *   { password: "newPassword123" }
 */

import { parseCookies, decrypt } from './_utils/cookies.mjs'

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
    // Read and decrypt session from cookie
    const cookies = parseCookies(request)
    const sessionCookie = cookies['osps-session']

    if (!sessionCookie) {
      return new Response(
        JSON.stringify({ error: 'No active session. Please use the reset link from your email.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const session = decrypt(sessionCookie)

    if (!session?.access_token) {
      return new Response(
        JSON.stringify({ error: 'Invalid session. Please request a new reset link.' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Validate the new password
    const { password } = await request.json()

    if (!password || password.length < 6) {
      return new Response(
        JSON.stringify({ error: 'Password must be at least 6 characters.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Update the password via Supabase's user endpoint
    // This requires a valid access_token — proves the user owns this session
    const updateResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ password }),
    })

    if (!updateResponse.ok) {
      const errorBody = await updateResponse.json().catch(() => ({}))
      console.error('Password update failed:', updateResponse.status, errorBody)

      if (updateResponse.status === 401) {
        return new Response(
          JSON.stringify({ error: 'Session expired. Please request a new reset link.' }),
          { status: 401, headers: { 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({
          error: errorBody.error_description || errorBody.msg || 'Failed to update password',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Password updated successfully.' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Update password error:', err)
    return new Response(
      JSON.stringify({ error: 'Server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
