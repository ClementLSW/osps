/**
 * Auth Invite — /api/auth/invite
 *
 * Smart invite flow:
 *
 *   1. Check if the email belongs to an existing user
 *      → YES: Add them to the group directly. Done.
 *      → NO:  Store a pending invite + send Supabase invite email.
 *             When they sign up and log in, the app auto-joins them.
 *
 * Uses the SERVICE_ROLE_KEY to:
 *   - Call get_user_id_by_email RPC (security definer, reads auth.users)
 *   - Insert into group_members for existing users
 *   - Call Supabase's /auth/v1/invite for new users
 */

import { parseCookies, decrypt } from './_utils/cookies.mjs'

export default async (request) => {
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const siteUrl = process.env.SITE_URL

  if (!serviceRoleKey) {
    return respond(500, { error: 'Invite not configured — missing service role key' })
  }

  if (request.method !== 'POST') {
    return respond(405, { error: 'Method not allowed' })
  }

  // Verify requester is logged in
  const cookies = parseCookies(request)
  const session = decrypt(cookies['osps-session'] || '')
  if (!session) {
    return respond(401, { error: 'Not authenticated' })
  }

  try {
    const { email, groupId, groupName, inviteCode } = await request.json()

    if (!email || !groupId) {
      return respond(400, { error: 'Email and groupId are required' })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // ── Step 1: Check if user already exists ──
    // Uses the get_user_id_by_email RPC (security definer function
    // that queries auth.users — see migration 004)
    let existingUserId = null

    const rpcResponse = await fetch(
      `${supabaseUrl}/rest/v1/rpc/get_user_id_by_email`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ lookup_email: normalizedEmail }),
      }
    )

    if (rpcResponse.ok) {
      const result = await rpcResponse.json()
      // RPC returns a UUID string if found, null if not
      if (result && typeof result === 'string' && result.length > 0) {
        existingUserId = result
      }
    } else {
      // RPC failed — log but don't block the invite flow
      const errText = await rpcResponse.text()
      console.error('User lookup RPC failed:', rpcResponse.status, errText)
    }

    if (existingUserId) {
      // ── User exists → add to group directly ──

      // Check if already a member
      const memberCheck = await fetch(
        `${supabaseUrl}/rest/v1/group_members?group_id=eq.${groupId}&user_id=eq.${existingUserId}`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            Accept: 'application/json',
          },
        }
      )

      const existingMembers = await memberCheck.json()
      if (existingMembers.length > 0) {
        return respond(200, { success: true, alreadyMember: true })
      }

      // Add to group
      const addMember = await fetch(
        `${supabaseUrl}/rest/v1/group_members`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            group_id: groupId,
            user_id: existingUserId,
            role: 'member',
          }),
        }
      )

      if (!addMember.ok) {
        const err = await addMember.text()
        console.error('Failed to add member:', err)
        return respond(500, { error: 'Failed to add member to group' })
      }

      return respond(200, { success: true, addedDirectly: true })

    } else {
      // ── User doesn't exist → store pending invite + send email ──

      // Store pending invite (using service role to bypass RLS)
      await fetch(
        `${supabaseUrl}/rest/v1/pending_invites`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            Prefer: 'return=minimal',
          },
          body: JSON.stringify({
            email: normalizedEmail,
            group_id: groupId,
            invited_by: session.user.id,
          }),
        }
      )

      // Send Supabase invite email
      const inviteResponse = await fetch(`${supabaseUrl}/auth/v1/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          email: normalizedEmail,
          data: {
            invited_by: session.user?.display_name || 'Someone',
            group_name: groupName || 'a group',
          },
        }),
      })

      if (!inviteResponse.ok) {
        const errData = await inviteResponse.json()
        console.error('Invite API error:', errData)
        // Don't fail — pending invite is stored, they can use the link
      }

      return respond(200, { success: true, inviteSent: true })
    }
  } catch (err) {
    console.error('Invite error:', err)
    return respond(500, { error: 'Server error' })
  }
}

function respond(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
