/**
 * Auth Delete Account — /api/auth/delete-account
 *
 * Permanently deletes the user's account using Supabase's Admin API.
 *
 * The deletion cascades through the database:
 *   auth.users → profiles (ON DELETE CASCADE)
 *   profiles → group_members (ON DELETE CASCADE — leaves all groups)
 *   profiles → line_item_assignments (ON DELETE CASCADE — cleans up)
 *   profiles → pending_invites (ON DELETE CASCADE — cleans up)
 *   profiles → expenses, expense_splits, groups, settlements (ON DELETE SET NULL
 *              — preserves history, shows "Deleted user" in UI)
 *
 * Requires the SERVICE_ROLE_KEY because Supabase's Admin delete user
 * endpoint is a privileged operation.
 *
 * Request body:
 *   { confirm: "DELETE" }
 */

import { parseCookies, decrypt, clearCookieHeader } from './_utils/cookies.mjs'

export default async (request) => {
  const supabaseUrl = process.env.SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (request.method !== 'POST') {
    return respond(405, { error: 'Method not allowed' })
  }

  if (!serviceRoleKey) {
    return respond(500, { error: 'Account deletion not configured' })
  }

  // Read session
  const cookies = parseCookies(request)
  const session = decrypt(cookies['osps-session'] || '')
  if (!session?.user?.id) {
    return respond(401, { error: 'Not authenticated' })
  }

  try {
    const { confirm } = await request.json()

    // Safety check — client must explicitly confirm
    if (confirm !== 'DELETE') {
      return respond(400, { error: 'Confirmation required. Send { confirm: "DELETE" }.' })
    }

    const userId = session.user.id

    // Delete the user via Supabase Admin API
    // This triggers: auth.users delete → profiles cascade → all FK cascades/set-nulls
    const deleteResponse = await fetch(
      `${supabaseUrl}/auth/v1/admin/users/${userId}`,
      {
        method: 'DELETE',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      }
    )

    if (!deleteResponse.ok) {
      const errorBody = await deleteResponse.text()
      console.error('Account deletion failed:', deleteResponse.status, errorBody)
      return respond(500, { error: 'Failed to delete account. Please try again.' })
    }

    // Clear the session cookie
    return new Response(
      JSON.stringify({ success: true }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': clearCookieHeader('osps-session'),
        },
      }
    )
  } catch (err) {
    console.error('Delete account error:', err)
    return respond(500, { error: 'Server error' })
  }
}

function respond(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
