import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  function validate() {
    if (password.length < 6) {
      setError('Password must be at least 6 characters.')
      return false
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return false
    }
    return true
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (!validate()) return

    setLoading(true)

    try {
      const res = await fetch('/api/auth/update-password', {
        method: 'POST',
        credentials: 'same-origin', // send the session cookie
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Failed to update password.')
        return
      }

      setSuccess(true)

      // Redirect to dashboard after a brief moment
      setTimeout(() => {
        window.location.href = '/dashboard'
      }, 2000)
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
          <p className="text-osps-gray mt-2 font-body">Set a new password</p>
        </div>

        {success ? (
          /* ── Success state ──────────────────────────────────── */
          <div className="card text-center">
            <div className="text-4xl mb-4">✅</div>
            <h2 className="text-lg font-display font-semibold text-osps-black mb-2">
              Password updated
            </h2>
            <p className="text-osps-gray text-sm font-body">
              Redirecting you to the dashboard...
            </p>
          </div>
        ) : (
          /* ── Password form ──────────────────────────────────── */
          <div>
            {error && (
              <div className="bg-red-50 text-osps-red-dark text-sm rounded-xl px-4 py-3 mb-4 font-body">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="New password"
                className="input"
              />
              <input
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="input"
              />

              {/* Password strength hint */}
              {password.length > 0 && password.length < 6 && (
                <p className="text-xs text-osps-yellow font-body">
                  {6 - password.length} more character{6 - password.length !== 1 ? 's' : ''} needed
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Updating...' : 'Update password'}
              </button>
            </form>

            <p className="text-center text-sm text-osps-gray mt-4">
              <Link
                to="/forgot-password"
                className="text-osps-red font-medium hover:underline"
              >
                Request a new reset link
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
