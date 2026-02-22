/**
 * Auth Reset Request — /api/auth/reset-request
 *
 * Sends a password reset email via Supabase's /auth/v1/recover endpoint.
 * The email contains a link that, after Supabase verifies the token,
 * redirects to /auth/confirm#access_token=XXX&type=recovery.
 *
 * Always returns 200 regardless of whether the email exists in the
 * database — this prevents email enumeration attacks.
 *
 * Request body:
 *   { email: "user@example.com" }
 */

export default async (request) => {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
  const siteUrl = process.env.SITE_URL || new URL(request.url).origin

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { email } = await request.json()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Call Supabase's password recovery endpoint
    // redirect_to as query param tells Supabase where to send the user
    // after verifying the reset token (same pattern as the JS SDK).
    // Our AuthConfirm page will catch the hash fragment tokens.
    const redirectTo = encodeURIComponent(`${siteUrl}/auth/confirm`)
    const recoverResponse = await fetch(
      `${supabaseUrl}/auth/v1/recover?redirect_to=${redirectTo}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: supabaseAnonKey,
        },
        body: JSON.stringify({ email }),
      }
    )

    if (!recoverResponse.ok) {
      // Log server-side but never leak to client
      const errorBody = await recoverResponse.text()
      console.error('Password recovery error:', recoverResponse.status, errorBody)
    }

    // Always return success — never reveal whether the email exists
    return new Response(
      JSON.stringify({
        message: 'If an account exists with that email, a reset link has been sent.',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }
    )
  } catch (err) {
    console.error('Reset request error:', err)
    return new Response(
      JSON.stringify({ error: 'Server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
