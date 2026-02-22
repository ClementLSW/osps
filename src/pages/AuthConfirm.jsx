/**
 * Auth Confirm — /auth/confirm
 *
 * Catches Supabase's redirect after email verification or password reset.
 *
 * WHY CLIENT-SIDE?
 *
 * Supabase puts tokens in the URL hash fragment (#access_token=XXX&...).
 * Hash fragments never reach the server — they stay in the browser.
 * This page reads the hash, POSTs the tokens to /api/auth/set-session
 * (which validates and encrypts them into a cookie), then redirects.
 *
 * The tokens exist in JS memory for a brief moment (milliseconds)
 * and never touch localStorage. The page is ephemeral — it shows a
 * loading spinner, does the handoff, and navigates away.
 *
 * ROUTING BY TYPE:
 *   type=signup      → /dashboard (email confirmed, user is now logged in)
 *   type=recovery    → /reset-password (user needs to set new password)
 *   type=magiclink   → /dashboard
 *   type=email_change → /dashboard
 *   error/missing    → / (landing page with error toast)
 */

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'

export default function AuthConfirm() {
  const navigate = useNavigate()
  const [error, setError] = useState(null)

  useEffect(() => {
    handleConfirm()
  }, [])

  async function handleConfirm() {
    try {
      // Parse the hash fragment — Supabase puts tokens here
      // Format: #access_token=XXX&token_type=bearer&expires_in=3600&refresh_token=YYY&type=signup
      const hash = window.location.hash.substring(1) // remove leading #
      const params = new URLSearchParams(hash)

      const accessToken = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const expiresIn = params.get('expires_in')
      const type = params.get('type') // signup | recovery | magiclink | email_change

      // Also check query params — in case Supabase uses PKCE for email
      // (newer versions may send ?code= instead of hash fragments)
      const queryParams = new URLSearchParams(window.location.search)
      const errorParam = queryParams.get('error')
      const errorDescription = queryParams.get('error_description')

      if (errorParam) {
        toast.error(errorDescription || 'Something went wrong')
        navigate('/', { replace: true })
        return
      }

      if (!accessToken || !refreshToken) {
        setError('Missing authentication tokens. The link may have expired.')
        return
      }

      // Hand tokens to the server — it validates and sets the cookie
      const res = await fetch('/api/auth/set-session', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          expires_in: parseInt(expiresIn, 10) || 3600,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Failed to establish session')
        return
      }

      // Clear the hash from the URL (tokens shouldn't linger in history)
      window.history.replaceState(null, '', '/auth/confirm')

      // Route based on the type of email action
      // Full reload ensures useAuth picks up the new session cookie
      if (type === 'recovery') {
        window.location.href = '/reset-password'
      } else {
        // For signup confirmation, briefly show success via toast
        // (toast state persists across navigation via react-hot-toast)
        toast.success(
          type === 'signup'
            ? 'Email confirmed! Welcome to O$P$'
            : 'You\'re signed in'
        )
        window.location.href = '/dashboard'
      }
    } catch (err) {
      console.error('Auth confirm error:', err)
      setError('Something went wrong. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-osps-cream px-4">
      <div className="text-center">
        <h1 className="text-3xl font-display font-bold text-osps-red mb-4">O$P$</h1>

        {error ? (
          <div className="max-w-sm">
            <p className="text-osps-gray mb-4">{error}</p>
            <a
              href="/"
              className="text-osps-red font-medium hover:underline"
            >
              ← Back to sign in
            </a>
          </div>
        ) : (
          <div>
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-osps-red mx-auto mb-4" />
            <p className="text-osps-gray">Verifying your email...</p>
          </div>
        )}
      </div>
    </div>
  )
}
