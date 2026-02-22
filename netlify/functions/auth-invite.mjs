/**
 * Auth Invite — /api/auth/invite
 *
 * Sends an invite email to a new user via Supabase's built-in invite API.
 * This is an admin-only endpoint — it requires the SERVICE_ROLE_KEY
 * because only admins should be able to invite users.
 *
 * We also verify the requester is authenticated by checking their
 * session cookie before allowing the invite.
 *
 * Request body:
 *   { email: "friend@example.com", groupName: "Bali Trip", inviterName: "Clement" }
 */

import { parseCookies, decrypt } from './_utils/cookies.mjs'

export default async (request) => {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    return new Response(
      JSON.stringify({ error: 'Invite not configured — missing service role key' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405, headers: { 'Content-Type': 'application/json' },
    })
  }

  // Verify the requester is logged in
  const cookies = parseCookies(request)
  const sessionCookie = cookies['osps-session']
  if (!sessionCookie) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  const session = decrypt(sessionCookie)
  if (!session) {
    return new Response(JSON.stringify({ error: 'Invalid session' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  try {
    const { email, groupName, inviterName } = await request.json()

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Call Supabase's invite endpoint with the service role key
    // The .Data field is passed to the email template as {{ .Data.xxx }}
    const inviteResponse = await fetch(`${supabaseUrl}/auth/v1/invite`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        email,
        data: {
          invited_by: inviterName || session.user?.display_name || 'Someone',
          group_name: groupName || 'a group',
        },
      }),
    })

    const inviteData = await inviteResponse.json()

    if (!inviteResponse.ok) {
      // If user already exists, that's fine — they just need the invite link
      if (inviteData.msg?.includes('already registered') || inviteData.error_description?.includes('already registered')) {
        return new Response(
          JSON.stringify({ success: true, alreadyRegistered: true }),
          { status: 200, headers: { 'Content-Type': 'application/json' } }
        )
      }

      return new Response(
        JSON.stringify({ error: inviteData.msg || inviteData.error_description || 'Invite failed' }),
        { status: inviteResponse.status, headers: { 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Invite error:', err)
    return new Response(
      JSON.stringify({ error: 'Server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
}
