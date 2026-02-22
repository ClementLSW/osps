/**
 * API client for server-side auth endpoints.
 *
 * These functions call OUR Netlify Functions, not Supabase directly.
 * The auth flow is:
 *
 *   Login:   Browser navigates to /api/auth/login (full redirect)
 *   Session: fetch('/api/auth/session') → { user, accessToken }
 *   Logout:  fetch('/api/auth/logout', { method: 'POST' })
 *
 * The browser automatically includes the httpOnly cookie with each
 * fetch() call (because credentials: 'same-origin' is the default
 * for same-origin requests). We never manually handle tokens here.
 */

/**
 * Redirect to the server-side login endpoint.
 * This triggers the full PKCE OAuth flow:
 *   /api/auth/login → Supabase → Google → Supabase → /api/auth/callback → /dashboard
 */
export function loginWithGoogle() {
  window.location.href = '/api/auth/login'
}

/**
 * Fetch the current session from the server.
 * The server reads the httpOnly cookie, validates/refreshes tokens,
 * and returns the user info + a short-lived access token.
 *
 * @returns {{ user: object|null, accessToken: string|null }}
 */
export async function getSession() {
  try {
    const response = await fetch('/api/auth/session', {
      method: 'GET',
      credentials: 'same-origin', // Include cookies (default, but explicit)
    })

    if (!response.ok) {
      console.error('Session check failed:', response.status)
      return { user: null, accessToken: null }
    }

    return await response.json()
  } catch (err) {
    console.error('Session fetch error:', err)
    return { user: null, accessToken: null }
  }
}

/**
 * Log out by calling the server-side logout endpoint.
 * The server revokes the session with Supabase and clears the cookie.
 */
export async function logout() {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'same-origin',
    })
  } catch (err) {
    console.error('Logout error:', err)
  }

  // Always redirect to home, even if the server call failed
  // (the cookie might have been cleared anyway)
  window.location.href = '/'
}
