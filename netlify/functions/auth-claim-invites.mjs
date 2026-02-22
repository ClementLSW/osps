/**
 * Claim Invites — /api/auth/claim-invites
 *
 * Called once after a user logs in. Checks pending_invites for
 * their email and auto-adds them to any groups they were invited to.
 *
 * Flow:
 *   1. Read session cookie to get user email + id
 *   2. Query pending_invites where email matches
 *   3. For each invite: add user to group_members
 *   4. Delete claimed pending_invites
 *   5. Return list of groups joined
 */

import { parseCookies, decrypt } from './_utils/cookies.mjs'

export default async (request) => {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!serviceRoleKey) {
    return respond(200, { claimed: [] })
  }

  // Read session
  const cookies = parseCookies(request)
  const session = decrypt(cookies['osps-session'] || '')
  if (!session?.user?.email) {
    return respond(200, { claimed: [] })
  }

  const email = session.user.email.toLowerCase()
  const userId = session.user.id

  try {
    // Step 1: Find pending invites for this email
    const lookupRes = await fetch(
      `${supabaseUrl}/rest/v1/pending_invites?email=eq.${encodeURIComponent(email)}&select=id,group_id,groups:group_id(name)`,
      {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Accept: 'application/json',
        },
      }
    )

    if (!lookupRes.ok) {
      console.error('Failed to lookup pending invites:', await lookupRes.text())
      return respond(200, { claimed: [] })
    }

    const invites = await lookupRes.json()
    if (invites.length === 0) {
      return respond(200, { claimed: [] })
    }

    const claimed = []

    // Step 2: Add user to each group
    for (const invite of invites) {
      // Check if already a member (shouldn't happen, but be safe)
      const memberCheck = await fetch(
        `${supabaseUrl}/rest/v1/group_members?group_id=eq.${invite.group_id}&user_id=eq.${userId}`,
        {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
            Accept: 'application/json',
          },
        }
      )

      const existing = await memberCheck.json()
      if (existing.length > 0) {
        // Already a member — just clean up the invite
        claimed.push({ groupId: invite.group_id, groupName: invite.groups?.name })
        continue
      }

      // Add to group
      const addRes = await fetch(
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
            group_id: invite.group_id,
            user_id: userId,
            role: 'member',
          }),
        }
      )

      if (addRes.ok) {
        claimed.push({ groupId: invite.group_id, groupName: invite.groups?.name })
      } else {
        console.error('Failed to add to group:', invite.group_id, await addRes.text())
      }
    }

    // Step 3: Delete all claimed invites
    if (claimed.length > 0) {
      const inviteIds = invites.map(i => i.id)
      await fetch(
        `${supabaseUrl}/rest/v1/pending_invites?id=in.(${inviteIds.join(',')})`,
        {
          method: 'DELETE',
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        }
      )
    }

    return respond(200, { claimed })
  } catch (err) {
    console.error('Claim invites error:', err)
    return respond(200, { claimed: [] })
  }
}

function respond(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
