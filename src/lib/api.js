// ============================================================
// Client-side API helper
//
// This replaces the Supabase JS client for all operations.
// Instead of the browser talking directly to Supabase, every
// request goes through our Netlify Functions:
//
//   Before:  Browser → supabase.co (with anon key + JWT in localStorage)
//   After:   Browser → /api/db (with httpOnly cookie, zero tokens in JS)
//
// The API surface mirrors Supabase's query builder pattern
// so existing code is easy to migrate.
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
}

// ── Database API ────────────────────────────────────────────
//
// Fluent query builder that translates to PostgREST queries.
//
// Usage:
//   const { data, error } = await db.from('groups').select('*').eq('id', 'abc')
//   const { data, error } = await db.from('expenses').insert({ title: 'Dinner' })

export function from(table) {
  return new QueryBuilder(table)
}

class QueryBuilder {
  constructor(table) {
    this._table = table
    this._method = 'GET'
    this._select = '*'
    this._filters = []
    this._body = null
    this._order = null
    this._limit = null
    this._single = false
    this._headers = {}
  }

  select(columns = '*') {
    this._method = 'GET'
    this._select = columns
    return this
  }

  insert(body) {
    this._method = 'POST'
    this._body = body
    this._headers['Prefer'] = 'return=representation'
    return this
  }

  update(body) {
    this._method = 'PATCH'
    this._body = body
    this._headers['Prefer'] = 'return=representation'
    return this
  }

  delete() {
    this._method = 'DELETE'
    this._headers['Prefer'] = 'return=representation'
    return this
  }

  // PostgREST filters
  eq(column, value) { this._filters.push(`${column}=eq.${value}`); return this }
  neq(column, value) { this._filters.push(`${column}=neq.${value}`); return this }
  gt(column, value) { this._filters.push(`${column}=gt.${value}`); return this }
  gte(column, value) { this._filters.push(`${column}=gte.${value}`); return this }
  lt(column, value) { this._filters.push(`${column}=lt.${value}`); return this }
  lte(column, value) { this._filters.push(`${column}=lte.${value}`); return this }
  in(column, values) { this._filters.push(`${column}=in.(${values.join(',')})`); return this }

  order(column, { ascending = true } = {}) {
    this._order = `${column}.${ascending ? 'asc' : 'desc'}`
    return this
  }

  limit(count) { this._limit = count; return this }

  single() {
    this._single = true
    this._headers['Accept'] = 'application/vnd.pgrst.object+json'
    return this
  }

  async then(resolve, reject) {
    try {
      const result = await this._execute()
      resolve(result)
    } catch (err) {
      if (reject) reject(err)
      else resolve({ data: null, error: err })
    }
  }

  async _execute() {
    const queryParts = []

    if (this._method === 'GET') {
      queryParts.push(`select=${encodeURIComponent(this._select)}`)
    }

    for (const filter of this._filters) {
      queryParts.push(filter)
    }

    if (this._order) queryParts.push(`order=${this._order}`)
    if (this._limit !== null) queryParts.push(`limit=${this._limit}`)

    const query = queryParts.join('&')

    const res = await fetch(`${API_BASE}/db`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        table: this._table,
        method: this._method,
        query,
        body: this._body,
        headers: this._headers,
      }),
    })

    if (res.status === 401) {
      window.location.href = '/'
      return { data: null, error: { message: 'Not authenticated' } }
    }

    const text = await res.text()
    let data
    try { data = JSON.parse(text) } catch { data = text }

    if (!res.ok) {
      return {
        data: null,
        error: {
          message: data?.message || data?.error || 'Request failed',
          status: res.status,
          details: data,
        },
      }
    }

    return { data, error: null }
  }
}

export const db = { from }
