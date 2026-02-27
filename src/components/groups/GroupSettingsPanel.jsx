import { useState } from 'react'
import { useScrollLock } from '@/hooks/useScrollLock'
import { CURRENCIES } from '@/lib/currencies'
import ConfirmDialog from '@/components/ConfirmDialog'

/**
 * GroupSettingsPanel — slide-up panel for group management.
 *
 * Props:
 *   group              — the group object
 *   members            — array of { id, display_name, role }
 *   currentUserId      — current user's profile ID
 *   isAdmin            — whether current user is admin
 *   isOwner            — whether current user is the group creator
 *   onUpdate           — async (fields) => update group + refresh
 *   onTransferOwnership — async (newOwnerId) => transfer + refresh
 *   onDelete           — async () => delete group + navigate away
 *   onLeave            — async () => leave group + navigate away
 *   onClose            — close the panel
 */
export default function GroupSettingsPanel({ group, members, currentUserId, isAdmin, isOwner, onUpdate, onTransferOwnership, onDelete, onLeave, onClose }) {
  useScrollLock()
  const [name, setName] = useState(group.name)
  const [currency, setCurrency] = useState(group.currency)
  const [showCurrency, setShowCurrency] = useState(false)
  const [saving, setSaving] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null) // 'delete' | 'leave' | 'transfer' | null
  const [transferTarget, setTransferTarget] = useState(null)

  const hasChanges = name.trim() !== group.name || currency !== group.currency

  async function handleSave() {
    if (!name.trim()) return
    setSaving(true)
    await onUpdate({
      name: name.trim(),
      currency,
    })
    setSaving(false)
  }

  async function handleToggleSettled() {
    setSaving(true)
    await onUpdate({ is_settled: !group.is_settled })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div
        className="absolute inset-0 bg-osps-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl w-full max-w-md mx-0 sm:mx-4 p-6 shadow-xl animate-slideUp max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-display font-bold">Group Settings</h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-osps-gray-light/50 text-osps-gray"
          >
            ✕
          </button>
        </div>

        {/* Group name */}
        {isAdmin ? (
          <div className="mb-5">
            <label className="block text-xs font-display font-semibold text-osps-gray uppercase tracking-wider mb-2">
              Group name
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="input"
            />
          </div>
        ) : (
          <div className="mb-5">
            <label className="block text-xs font-display font-semibold text-osps-gray uppercase tracking-wider mb-2">
              Group name
            </label>
            <p className="text-sm text-osps-black font-body">{group.name}</p>
          </div>
        )}

        {/* Currency */}
        {isAdmin ? (
          <div className="mb-5">
            <label className="block text-xs font-display font-semibold text-osps-gray uppercase tracking-wider mb-2">
              Currency
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowCurrency(!showCurrency)}
                className="input flex items-center justify-between text-[15px] w-full"
              >
                <span>
                  {CURRENCIES.find(c => c.code === currency)?.flag} {currency}
                </span>
                <span className={`text-osps-gray text-xs transition-transform duration-200 ${showCurrency ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </button>

              {showCurrency && (
                <div className="absolute top-full mt-1 left-0 right-0 bg-white rounded-xl border border-osps-gray-light p-1.5 z-10 shadow-lg max-h-[200px] overflow-y-auto">
                  {CURRENCIES.map(c => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => { setCurrency(c.code); setShowCurrency(false) }}
                      className={`w-full px-3 py-2.5 rounded-lg flex items-center gap-2.5 text-sm font-body text-left transition-colors
                        ${currency === c.code ? 'bg-osps-cream font-semibold' : 'hover:bg-osps-cream/50'}`}
                    >
                      <span className="text-lg">{c.flag}</span>
                      <span>{c.code}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="mb-5">
            <label className="block text-xs font-display font-semibold text-osps-gray uppercase tracking-wider mb-2">
              Currency
            </label>
            <p className="text-sm text-osps-black font-body">
              {CURRENCIES.find(c => c.code === group.currency)?.flag} {group.currency}
            </p>
          </div>
        )}

        {/* Save changes (admin only, when changed) */}
        {isAdmin && hasChanges && (
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="btn-primary w-full text-sm mb-5 disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        )}

        <div className="h-px bg-osps-gray-light mb-5" />

        {/* Mark as settled / reopen (admin only) */}
        {isAdmin && (
          <button
            onClick={handleToggleSettled}
            disabled={saving}
            className="w-full flex items-center justify-between py-3 px-1 text-left group"
          >
            <div>
              <p className="text-sm font-display font-semibold text-osps-black">
                {group.is_settled ? 'Reopen group' : 'Mark as settled'}
              </p>
              <p className="text-xs text-osps-gray font-body mt-0.5">
                {group.is_settled
                  ? 'Reopen to add more expenses'
                  : 'Move to settled section on dashboard'}
              </p>
            </div>
            <div className={`w-11 h-[26px] rounded-full p-[3px] transition-colors duration-200 ${group.is_settled ? 'bg-osps-green' : 'bg-osps-gray-light'}`}>
              <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${group.is_settled ? 'translate-x-[18px]' : 'translate-x-0'}`} />
            </div>
          </button>
        )}

        <div className="h-px bg-osps-gray-light my-3" />

        {/* Transfer ownership (owner only) */}
        {isOwner && members.filter(m => m.id !== currentUserId).length > 0 && (
          <>
            <div className="py-3 px-1">
              <p className="text-sm font-display font-semibold text-osps-black mb-1">
                Transfer ownership
              </p>
              <p className="text-xs text-osps-gray font-body mb-3">
                Make another member the group owner. You'll remain an admin.
              </p>
              <div className="flex gap-2">
                <select
                  value={transferTarget || ''}
                  onChange={e => setTransferTarget(e.target.value || null)}
                  className="input flex-1 text-sm"
                >
                  <option value="">Select a member</option>
                  {members
                    .filter(m => m.id !== currentUserId)
                    .map(m => (
                      <option key={m.id} value={m.id}>{m.display_name}</option>
                    ))
                  }
                </select>
                <button
                  onClick={() => transferTarget && setConfirmAction('transfer')}
                  disabled={!transferTarget}
                  className="text-sm font-display font-semibold text-osps-yellow border border-osps-yellow/30
                             px-4 py-2 rounded-xl hover:bg-osps-yellow/5 active:scale-[0.98] transition-all
                             disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Transfer
                </button>
              </div>
            </div>
            <div className="h-px bg-osps-gray-light my-3" />
          </>
        )}

        {/* Leave group */}
        <button
          onClick={() => setConfirmAction('leave')}
          className="w-full text-left py-3 px-1"
        >
          <p className="text-sm font-display font-semibold text-osps-yellow">Leave group</p>
          <p className="text-xs text-osps-gray font-body mt-0.5">
            You'll lose access to this group's expenses
          </p>
        </button>

        {/* Delete group (owner only) */}
        {isOwner && (
          <>
            <div className="h-px bg-osps-gray-light my-3" />
            <button
              onClick={() => setConfirmAction('delete')}
              className="w-full text-left py-3 px-1"
            >
              <p className="text-sm font-display font-semibold text-osps-red">Delete group</p>
              <p className="text-xs text-osps-gray font-body mt-0.5">
                Permanently delete this group and all its expenses
              </p>
            </button>
          </>
        )}

        {/* Confirm dialogs */}
        {confirmAction === 'delete' && (
          <ConfirmDialog
            title="Delete group?"
            message={`"${group.name}" and all its expenses, splits, and settlements will be permanently deleted. This cannot be undone.`}
            confirmLabel="Delete group"
            danger
            onConfirm={() => { setConfirmAction(null); onDelete() }}
            onCancel={() => setConfirmAction(null)}
          />
        )}

        {confirmAction === 'leave' && (
          <ConfirmDialog
            title="Leave group?"
            message={`You'll lose access to "${group.name}" and its expenses. You can rejoin with an invite link.`}
            confirmLabel="Leave"
            danger={false}
            onConfirm={() => { setConfirmAction(null); onLeave() }}
            onCancel={() => setConfirmAction(null)}
          />
        )}

        {confirmAction === 'transfer' && transferTarget && (
          <ConfirmDialog
            title="Transfer ownership?"
            message={`${members.find(m => m.id === transferTarget)?.display_name} will become the group owner. You'll remain as an admin. Only the new owner can transfer ownership again or delete the group.`}
            confirmLabel="Transfer"
            danger={false}
            onConfirm={() => { setConfirmAction(null); onTransferOwnership(transferTarget); setTransferTarget(null) }}
            onCancel={() => setConfirmAction(null)}
          />
        )}
      </div>
    </div>
  )
}
