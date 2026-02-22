import { createContext, useContext, useEffect, useState } from 'react'
import { getSession, loginWithGoogle, logout } from '@/lib/api'
import { setAccessToken } from '@/lib/supabase'
import { supabase } from '@/lib/supabase'

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
        const { user: sessionUser, accessToken } = await getSession()

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
      const { data, error } = await supabase
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
    loginWithGoogle()
  }

  async function signOut() {
    await logout()
  }

  // Email auth is not covered by server-side OAuth — would need
  // additional Netlify Functions. Left as a TODO for now.
  async function signInWithEmail(email, password) {
    throw new Error('Email auth not yet implemented with server-side flow')
  }

  async function signUpWithEmail(email, password, displayName) {
    throw new Error('Email auth not yet implemented with server-side flow')
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