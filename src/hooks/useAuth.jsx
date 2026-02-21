import { createContext, useContext, useEffect, useState } from 'react'
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
        // First check if there's an auth code in the URL (OAuth redirect)
        const hashParams = new URLSearchParams(window.location.hash.substring(1))
        const queryParams = new URLSearchParams(window.location.search)
        const hasAuthParams = hashParams.has('access_token') || queryParams.has('code')

        if (hasAuthParams) {
          // Let Supabase handle the OAuth exchange
          const { data: { session }, error } = await supabase.auth.getSession()
          if (!mounted) return
          if (error) {
            console.error('OAuth exchange error:', error)
            // Clean URL params
            window.history.replaceState({}, '', window.location.pathname)
            setLoading(false)
            return
          }
          if (session?.user) {
            setUser(session.user)
            await fetchProfile(session.user.id)
            window.history.replaceState({}, '', window.location.pathname)
            return
          }
        }

        // Normal session check
        const { data: { session }, error } = await supabase.auth.getSession()
        if (!mounted) return
        if (error) {
          console.error('getSession error:', error)
          setLoading(false)
          return
        }
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setLoading(false)
        }
      } catch (err) {
        console.error('Auth init failed:', err)
        if (mounted) setLoading(false)
      }
    }

    init()

    // Listen for auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return

        if (event === 'SIGNED_OUT') {
          setUser(null)
          setProfile(null)
          setLoading(false)
          return
        }

        if (session?.user) {
          setUser(session.user)
          await fetchProfile(session.user.id)
        } else {
          setUser(null)
          setProfile(null)
          setLoading(false)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/dashboard`,
      },
    })
    if (error) throw error
  }

  async function signInWithEmail(email, password) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (error) throw error
  }

  async function signUpWithEmail(email, password, displayName) {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName },
      },
    })
    if (error) throw error
  }

  async function signOut() {
    // Clear local storage before signing out to prevent stale tokens
    localStorage.removeItem('osps-auth')
    const { error } = await supabase.auth.signOut()
    if (error) throw error
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