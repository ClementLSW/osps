import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/reset-request', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong.')
        return
      }

      // Always show success — server doesn't reveal if email exists
      setSubmitted(true)
    } catch (err) {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-10">
          <Link to="/">
            <h1 className="text-5xl font-display font-extrabold text-osps-red tracking-tight">
              O$P$
            </h1>
          </Link>
          <p className="text-osps-gray mt-2 font-body">Reset your password</p>
        </div>

        {submitted ? (
          /* ── Success state ──────────────────────────────────── */
          <div className="card text-center">
            <div className="text-4xl mb-4">📧</div>
            <h2 className="text-lg font-display font-semibold text-osps-black mb-2">
              Check your email
            </h2>
            <p className="text-osps-gray text-sm mb-6 font-body">
              If an account exists for <strong>{email}</strong>, we've sent a
              password reset link. It may take a minute to arrive.
            </p>
            <p className="text-osps-gray/60 text-xs mb-4 font-body">
              Don't see it? Check your spam folder.
            </p>
            <Link
              to="/"
              className="text-sm text-osps-red font-medium hover:underline"
            >
              ← Back to sign in
            </Link>
          </div>
        ) : (
          /* ── Email form ─────────────────────────────────────── */
          <div>
            <p className="text-osps-gray text-sm mb-6 font-body">
              Enter your email address and we'll send you a link to reset your
              password.
            </p>

            {error && (
              <div className="bg-red-50 text-osps-red-dark text-sm rounded-xl px-4 py-3 mb-4 font-body">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email"
                className="input"
              />
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
            </form>

            <p className="text-center text-sm text-osps-gray mt-4">
              <Link
                to="/"
                className="text-osps-red font-medium hover:underline"
              >
                ← Back to sign in
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
