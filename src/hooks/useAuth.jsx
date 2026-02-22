/**
 * Auth hook — now powered by server-side auth.
 *
 * WHAT CHANGED:
 *
 *   Before: useAuth called supabase.auth.getSession() which read
 *   tokens from localStorage, managed by Supabase's client SDK.
 *
 *   After: useAuth calls OUR /api/auth/session endpoint, which
 *   reads the httpOnly cookie, validates/refreshes tokens server-side,
 *   and returns the user info + a short-lived access token.
 *
 * THE FLOW:
 *
 *   1. Component mounts → useAuth runs
 *   2. Fetch /api/auth/session (browser auto-includes httpOnly cookie)
 *   3. Server validates cookie, returns { user, accessToken }
 *   4. We call setAccessToken() so Supabase client can make DB queries
 *   5. Component re-renders with user data
 *
 * SIGN IN:
 *   - loginWithGoogle() redirects to /api/auth/login
 *   - User goes through Google consent
 *   - Server handles token exchange, sets cookie
 *   - User arrives at /dashboard
 *   - useAuth fires, fetches session, user is logged in
 *
 * SIGN OUT:
 *   - logout() calls /api/auth/logout (clears cookie + revokes token)
 *   - Redirects to /
 *
 * No tokens in localStorage. No tokens in JavaScript (except the
 * short-lived access token in React state, which vanishes on page close).
 */

import { createContext, useContext, useEffect, useState } from 'react'
import { auth } from '@/lib/api'
import { setAccessToken, getSupabase } from '@/lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    async function init() {
      try {
        // Step 1: Ask our server for the current session
        const { user: sessionUser, accessToken } = await auth.getSession()

        if (!mounted) return

        if (sessionUser && accessToken) {
          // Step 2: Set the access token on the Supabase client
          // so DB queries work with RLS
          await setAccessToken(accessToken)

          setUser(sessionUser)

          // Step 3: Fetch the full profile from Supabase
          // (the session only has basic info from the OAuth provider)
          await fetchProfile(sessionUser.id)
        } else {
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
      } catch (err) {
        console.error('Auth init error:', err)
        if (mounted) {
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
      }
    }

    init()

    return () => { mounted = false }
  }, [])

  async function fetchProfile(userId) {
    try {
      const { data, error } = await getSupabase()
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        console.error('Error fetching profile:', error)
      }
      setProfile(data)
    } catch (err) {
      console.error('fetchProfile failed:', err)
    } finally {
      setLoading(false)
    }
  }

  async function signInWithGoogle() {
    auth.signInWithGoogle()
  }

  async function signOut() {
    await auth.signOut()
  }

  async function signInWithEmail(email, password) {
    const result = await auth.signInWithEmail(email, password)
    if (result.success) {
      // Reload to pick up the new session cookie
      window.location.href = '/dashboard'
    }
  }

  async function signUpWithEmail(email, password, displayName) {
    const result = await auth.signUpWithEmail(email, password, displayName)
    if (result.confirmationRequired) {
      return { confirmationRequired: true, message: result.message }
    }
    if (result.success) {
      window.location.href = '/dashboard'
    }
    return result
  }

  const value = {
    user,
    profile,
    loading,
    signInWithGoogle,
    signInWithEmail,
    signUpWithEmail,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
