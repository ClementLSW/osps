// ============================================================
// Client-side API helper
//
// Auth operations go through Netlify Functions (/api/auth/*).
// Database queries go through getSupabase() from supabase.js.
// ============================================================

const API_BASE = '/api'

// ── Auth API ────────────────────────────────────────────────

export const auth = {
  /**
   * Redirect to Google OAuth login.
   * This navigates away from the SPA — the server handles everything.
   */
  signInWithGoogle() {
    window.location.href = `${API_BASE}/auth/login`
  },

  /**
   * Sign in with email + password.
   * Server exchanges credentials for tokens and sets cookie.
   */
  async signInWithEmail(email, password) {
    const res = await fetch(`${API_BASE}/auth/signin`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Sign in failed')
    return data
  },

  /**
   * Create a new account with email + password.
   * Server creates the user and sets cookie (or requires confirmation).
   */
  async signUpWithEmail(email, password, displayName) {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, displayName }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Sign up failed')
    return data
  },

  /**
   * Check current session. Returns { user } or { user: null }.
   * The server reads the httpOnly cookie — JS never sees the token.
   */
  async getSession() {
    const res = await fetch(`${API_BASE}/auth/session`, {
      credentials: 'same-origin',
    })
    if (!res.ok) return { user: null }
    return res.json()
  },

  /**
   * Sign out. Server clears the cookie and revokes the token.
   */
  async signOut() {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'same-origin',
    })
    window.location.href = '/'
  },

  /**
   * Request a password reset email.
   * Always returns success — server never reveals if email exists.
   */
  async resetPassword(email) {
    const res = await fetch(`${API_BASE}/auth/reset-request`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Request failed')
    return data
  },

  /**
   * Update password using an active session.
   * Called from the /reset-password page after the recovery email flow.
   */
  async updatePassword(password) {
    const res = await fetch(`${API_BASE}/auth/update-password`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error || 'Update failed')
    return data
  },
}
