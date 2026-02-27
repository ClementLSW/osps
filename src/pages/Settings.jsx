import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { getSupabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import ConfirmDialog from '@/components/ConfirmDialog'
import toast from 'react-hot-toast'

export default function Settings() {
  const navigate = useNavigate()
  const { user, profile, signOut, refreshProfile } = useAuth()

  // Profile
  const [displayName, setDisplayName] = useState('')
  const [savingName, setSavingName] = useState(false)

  // Account info
  const [providers, setProviders] = useState([])
  const [hasPassword, setHasPassword] = useState(false)
  const [loadingAccount, setLoadingAccount] = useState(true)

  // Password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)

  // Delete
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleteText, setDeleteText] = useState('')
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (profile) setDisplayName(profile.display_name || '')
    fetchAccountInfo()
  }, [profile])

  async function fetchAccountInfo() {
    try {
      const res = await fetch('/api/auth/account', { credentials: 'same-origin' })
      if (res.ok) {
        const data = await res.json()
        setProviders(data.providers || [])
        setHasPassword(data.hasPassword)
      }
    } catch (err) {
      console.error('Failed to fetch account info:', err)
    } finally {
      setLoadingAccount(false)
    }
  }

  // ── Profile ───────────────────────────────────────────────

  const nameChanged = displayName.trim() !== (profile?.display_name || '')

  async function handleSaveName(e) {
    e.preventDefault()
    if (!displayName.trim()) return
    setSavingName(true)

    const { error } = await getSupabase()
      .from('profiles')
      .update({ display_name: displayName.trim() })
      .eq('id', profile.id)

    if (error) {
      toast.error('Failed to update name')
      console.error(error)
    } else {
      toast.success('Name updated')
      refreshProfile()
    }
    setSavingName(false)
  }

  // ── Password ──────────────────────────────────────────────

  async function handlePasswordSubmit(e) {
    e.preventDefault()

    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match')
      return
    }

    setSavingPassword(true)

    try {
      const body = { newPassword }
      if (hasPassword) body.currentPassword = currentPassword

      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to update password')
      } else {
        toast.success(hasPassword ? 'Password changed' : 'Password added')
        setCurrentPassword('')
        setNewPassword('')
        setConfirmPassword('')
        if (!hasPassword) setHasPassword(true)
      }
    } catch (err) {
      toast.error('Something went wrong')
    } finally {
      setSavingPassword(false)
    }
  }

  // ── Delete Account ────────────────────────────────────────

  async function handleDeleteAccount() {
    setDeleting(true)

    try {
      const res = await fetch('/api/auth/delete-account', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE' }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to delete account')
        setDeleting(false)
        return
      }

      toast.success('Account deleted')
      window.location.href = '/'
    } catch (err) {
      toast.error('Something went wrong')
      setDeleting(false)
    }
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-8 pb-safe">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <Link to="/dashboard" className="text-sm text-osps-gray hover:text-osps-black">
            ← Dashboard
          </Link>
          <h1 className="text-2xl font-display font-bold mt-1">Settings</h1>
        </div>
        <span className="text-xl font-display font-extrabold text-osps-red tracking-tight">
          O$P$
        </span>
      </div>

      {/* ── Profile ─────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-display font-semibold text-osps-gray uppercase tracking-wider mb-4">
          Profile
        </h2>
        <div className="card">
          {/* Avatar + email (read-only) */}
          <div className="flex items-center gap-3 mb-5">
            {profile?.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt=""
                className="w-12 h-12 rounded-full border border-osps-gray-light"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-osps-red/10 flex items-center justify-center">
                <span className="text-lg font-display font-bold text-osps-red">
                  {(profile?.display_name || '?')[0].toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <p className="font-display font-semibold text-sm">{profile?.display_name}</p>
              <p className="text-xs text-osps-gray font-body">{user?.email}</p>
            </div>
          </div>

          {/* Display name edit */}
          <form onSubmit={handleSaveName}>
            <label className="block text-xs font-display font-semibold text-osps-gray uppercase tracking-wider mb-2">
              Display name
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="input flex-1 text-sm"
                required
              />
              {nameChanged && (
                <button
                  type="submit"
                  disabled={savingName || !displayName.trim()}
                  className="btn-primary text-sm px-4 py-2 disabled:opacity-50"
                >
                  {savingName ? '...' : 'Save'}
                </button>
              )}
            </div>
          </form>

          {/* Auth providers */}
          {!loadingAccount && (
            <div className="mt-4 flex items-center gap-2">
              {providers.includes('google') && (
                <span className="inline-flex items-center gap-1.5 bg-osps-cream text-xs font-body
                                 text-osps-gray px-2.5 py-1 rounded-full">
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                  Google
                </span>
              )}
              {providers.includes('email') && (
                <span className="inline-flex items-center gap-1.5 bg-osps-cream text-xs font-body
                                 text-osps-gray px-2.5 py-1 rounded-full">
                  📧 Email
                </span>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Password ────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-sm font-display font-semibold text-osps-gray uppercase tracking-wider mb-4">
          {hasPassword ? 'Change password' : 'Add password'}
        </h2>
        <div className="card">
          {!hasPassword && (
            <p className="text-sm text-osps-gray font-body mb-4">
              You signed in with Google. Add a password to also sign in with email.
            </p>
          )}

          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            {hasPassword && (
              <div>
                <label className="block text-xs font-display font-semibold text-osps-gray uppercase tracking-wider mb-1.5">
                  Current password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  className="input text-sm"
                  required
                />
              </div>
            )}
            <div>
              <label className="block text-xs font-display font-semibold text-osps-gray uppercase tracking-wider mb-1.5">
                New password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="input text-sm"
                minLength={6}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-display font-semibold text-osps-gray uppercase tracking-wider mb-1.5">
                Confirm password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="input text-sm"
                minLength={6}
                required
              />
            </div>
            <button
              type="submit"
              disabled={savingPassword}
              className="btn-primary w-full text-sm disabled:opacity-50"
            >
              {savingPassword ? 'Saving...' : hasPassword ? 'Change password' : 'Add password'}
            </button>
          </form>
        </div>
      </section>

      {/* ── Danger Zone ─────────────────────────────────────── */}
      <section>
        <h2 className="text-sm font-display font-semibold text-osps-red uppercase tracking-wider mb-4">
          Danger zone
        </h2>
        <div className="card border-osps-red/20">
          <p className="text-sm font-display font-semibold text-osps-black mb-1">
            Delete account
          </p>
          <p className="text-sm text-osps-gray font-body mb-4">
            Permanently delete your account. You'll be removed from all groups.
            Existing expenses and settlements will be preserved but shown as
            "Deleted user". This cannot be undone.
          </p>
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="text-sm font-display font-semibold text-osps-red border border-osps-red/30
                       px-4 py-2 rounded-xl hover:bg-osps-red/5 active:scale-[0.98] transition-all"
          >
            Delete my account
          </button>
        </div>
      </section>

      {/* Delete confirmation — requires typing DELETE */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div
            className="absolute inset-0 bg-osps-black/40 backdrop-blur-sm animate-fadeIn"
            onClick={() => { setShowDeleteConfirm(false); setDeleteText('') }}
          />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-sm mx-0 sm:mx-4 p-6 shadow-xl animate-slideUp">
            <h2 className="text-lg font-display font-bold text-osps-black mb-2">
              Delete your account?
            </h2>
            <p className="text-sm text-osps-gray font-body mb-4">
              This is permanent. You'll lose access to all groups and your profile
              will be removed. Expenses you created will show "Deleted user".
            </p>
            <p className="text-sm text-osps-black font-body mb-3">
              Type <span className="font-mono font-semibold text-osps-red">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteText}
              onChange={e => setDeleteText(e.target.value)}
              placeholder="DELETE"
              className="input text-sm font-mono mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteConfirm(false); setDeleteText('') }}
                className="btn-ghost flex-1 text-sm py-2.5"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteText !== 'DELETE' || deleting}
                className="flex-1 font-display font-semibold text-sm py-2.5 rounded-xl
                           bg-osps-red text-white hover:bg-osps-red-dark
                           active:scale-[0.98] transition-all duration-150
                           disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
