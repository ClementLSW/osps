/**
 * Landing page — simplified for server-side OAuth.
 *
 * The "Continue with Google" button no longer calls supabase.auth.signInWithOAuth().
 * Instead, it navigates to /api/auth/login — our Netlify Function that starts
 * the PKCE flow server-side.
 *
 * Email/password auth is disabled for now since it would need its own
 * server-side endpoints. This could be added with /api/auth/signup and
 * /api/auth/signin functions that call Supabase's auth API server-side.
 */

import { useAuth } from '@/hooks/useAuth'

export default function Landing() {
  const { signInWithGoogle } = useAuth()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-display font-extrabold text-osps-red tracking-tight">
            O$P$
          </h1>
          <p className="text-osps-gray mt-2 font-body">
            Owe Money, Pay Money.
          </p>
        </div>

        {/* Google OAuth — triggers server-side PKCE flow */}
        <button
          onClick={signInWithGoogle}
          className="w-full flex items-center justify-center gap-3 bg-white border border-osps-gray-light
                     rounded-xl px-4 py-3 font-display font-medium hover:bg-gray-50 transition-colors"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          Continue with Google
        </button>

        <p className="text-center text-xs text-osps-gray mt-6 font-body leading-relaxed">
          By signing in, you agree to our terms of service.<br />
          Your auth session is secured server-side with encrypted cookies.
        </p>
      </div>
    </div>
  )
}
