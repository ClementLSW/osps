import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true

    // Get initial session
    supabase.auth.getSession()
      .then(({ data: { session }, error }) => {
        if (!mounted) return
        if (error) {
          console.error('getSession error:', error)
          setLoading(false)
          return
        }
        setUser(session?.user ?? null)
        if (session?.user) {
          fetchProfile(session.user.id)
        } else {
          setLoading(false)
        }
      })
      .catch((err) => {
        console.error('getSession failed:', err)
        if (mounted) setLoading(false)
      })

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!mounted) return
        setUser(session?.user ?? null)
        if (session?.user) {
          await fetchProfile(session.user.id)
        } else {
          setProfile(null)
          setLoading(false)
        }
      }
    )

    // Safety timeout — never stay stuck on loading
    const timeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('Auth loading timed out after 5s')
        setLoading(false)
      }
    }, 5000)

    return () => {
      mounted = false
      subscription.unsubscribe()
      clearTimeout(timeout)
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