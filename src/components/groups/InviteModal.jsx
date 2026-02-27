import { useState } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { useScrollLock } from '@/hooks/useScrollLock'
import toast from 'react-hot-toast'

export default function InviteModal({ group, onClose, onMemberAdded }) {
  useScrollLock()
  const { profile } = useAuth()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState(false)
  const inviteLink = `${window.location.origin}/join/${group.invite_code}`

  function copyLink() {
    navigator.clipboard.writeText(inviteLink)
    toast.success('Link copied!')
  }

  async function sendInvite(e) {
    e.preventDefault()
    if (!email.trim()) return
    setSending(true)

    try {
      const res = await fetch('/api/auth/invite', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          groupId: group.id,
          groupName: group.name,
          inviteCode: group.invite_code,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to send invite')
      } else if (data.alreadyMember) {
        toast(`${email} is already in this group`, { icon: 'ℹ️' })
      } else if (data.addedDirectly) {
        toast.success(`${email} has been added to the group!`)
        onMemberAdded?.()
      } else if (data.inviteSent) {
        toast.success(`Invite sent to ${email}! They'll be auto-added when they sign up.`)
      }

      setEmail('')
    } catch (err) {
      toast.error('Failed to send invite')
      console.error(err)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-osps-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-0 sm:mx-4 p-6 shadow-xl animate-slideUp">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-display font-bold">Invite to {group.name}</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-osps-gray-light/50 text-osps-gray"
          >
            ✕
          </button>
        </div>

        {/* Email invite */}
        <form onSubmit={sendInvite} className="mb-5">
          <label className="block text-xs font-display font-semibold text-osps-gray uppercase tracking-wider mb-2">
            Invite by email
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              placeholder="friend@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input flex-1 text-sm"
              required
            />
            <button type="submit" className="btn-primary text-sm px-4" disabled={sending}>
              {sending ? '...' : 'Send'}
            </button>
          </div>
          <p className="text-xs text-osps-gray mt-2 font-body">
            Existing users are added instantly. New users get an invite email.
          </p>
        </form>

        <div className="flex items-center gap-3 mb-5">
          <div className="flex-1 h-px bg-osps-gray-light" />
          <span className="text-xs text-osps-gray uppercase tracking-wider">or</span>
          <div className="flex-1 h-px bg-osps-gray-light" />
        </div>

        {/* Copy link */}
        <div>
          <label className="block text-xs font-display font-semibold text-osps-gray uppercase tracking-wider mb-2">
            Share link
          </label>
          <div className="flex gap-2">
            <div className="flex-1 bg-osps-cream rounded-xl px-3 py-2.5 font-mono text-xs text-osps-gray truncate">
              {inviteLink}
            </div>
            <button onClick={copyLink} className="btn-secondary text-sm px-4">
              Copy
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
