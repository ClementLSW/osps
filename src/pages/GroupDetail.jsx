import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { getSupabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useBalances } from '@/hooks/useBalances'
import { formatCurrency, formatBalance, formatCompact } from '@/lib/formatCurrency'
import { formatRelativeDate } from '@/lib/formatDate'
import InviteModal from '@/components/groups/InviteModal'
import GroupSettingsPanel from '@/components/groups/GroupSettingsPanel'
import ConfirmDialog from '@/components/ConfirmDialog'
import toast from 'react-hot-toast'

export default function GroupDetail() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])     // [{ id, display_name, avatar_url, role }]
  const [expenses, setExpenses] = useState([])
  const [settlements, setSettlements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [settlingIndex, setSettlingIndex] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [receiptUrls, setReceiptUrls] = useState({}) // expenseId → signed URL

  const { transactions, myBalance } = useBalances(expenses, settlements, profile?.id)

  // Derive admin status from member data
  const myRole = members.find(m => m.id === profile?.id)?.role
  const isAdmin = myRole === 'admin'

  useEffect(() => {
    loadGroup()
  }, [groupId])

  async function loadGroup() {
    setLoading(true)

    // Fetch group info
    const { data: groupData } = await getSupabase()
      .from('groups')
      .select('*')
      .eq('id', groupId)
      .single()

    // Fetch members with profiles — preserve role
    const { data: memberData } = await getSupabase()
      .from('group_members')
      .select('user_id, role, profiles:user_id (id, display_name, avatar_url)')
      .eq('group_id', groupId)

    // Fetch expenses with splits
    const { data: expenseData } = await getSupabase()
      .from('expenses')
      .select(`
        *,
        splits:expense_splits (user_id, owed_amount),
        payer:paid_by (display_name),
        line_items (id, name, amount, quantity)
      `)
      .eq('group_id', groupId)
      .order('expense_date', { ascending: false })

    // Fetch settlements
    const { data: settlementData } = await getSupabase()
      .from('settlements')
      .select('*')
      .eq('group_id', groupId)

    setGroup(groupData)
    // Merge role into profile object so we have { id, display_name, avatar_url, role }
    setMembers(memberData?.map(m => ({ ...m.profiles, role: m.role })) || [])
    setExpenses(expenseData || [])
    setSettlements(settlementData || [])
    setLoading(false)
  }

  async function recordSettlement(transaction) {
    const { error } = await getSupabase()
      .from('settlements')
      .insert({
        group_id: groupId,
        paid_by: transaction.from,
        paid_to: transaction.to,
        amount: transaction.amount,
      })

    if (error) {
      toast.error('Failed to record payment')
      console.error(error)
    } else {
      toast.success('Payment recorded!')
      setSettlingIndex(null)
      loadGroup()
    }
  }

  async function deleteExpense(expenseId) {
    // Delete receipt image from storage if it exists
    const expense = expenses.find(e => e.id === expenseId)
    if (expense?.receipt_url) {
      await getSupabase().storage.from('receipts').remove([expense.receipt_url])
    }

    const { error } = await getSupabase()
      .from('expenses')
      .delete()
      .eq('id', expenseId)

    if (error) {
      toast.error('Failed to delete expense')
      console.error(error)
    } else {
      toast.success('Expense deleted')
      setDeleteTarget(null)
      setExpandedId(null)
      loadGroup()
    }
  }

  async function updateGroup(fields) {
    const { error } = await getSupabase()
      .from('groups')
      .update(fields)
      .eq('id', groupId)

    if (error) {
      toast.error('Failed to update group')
      console.error(error)
    } else {
      toast.success('Group updated')
      loadGroup()
    }
  }

  async function deleteGroup() {
    const { error } = await getSupabase()
      .from('groups')
      .delete()
      .eq('id', groupId)

    if (error) {
      toast.error('Failed to delete group')
      console.error(error)
    } else {
      toast.success('Group deleted')
      setShowSettings(false)
      navigate('/dashboard')
    }
  }

  async function leaveGroup() {
    const { error } = await getSupabase()
      .from('group_members')
      .delete()
      .eq('group_id', groupId)
      .eq('user_id', profile.id)

    if (error) {
      toast.error('Failed to leave group')
      console.error(error)
    } else {
      toast.success('Left the group')
      setShowSettings(false)
      navigate('/dashboard')
    }
  }

  function getMemberName(userId) {
    if (!userId) return 'Deleted user'
    return members.find(m => m.id === userId)?.display_name || 'Unknown'
  }

  async function handleExpand(expense) {
    const newId = expandedId === expense.id ? null : expense.id

    // Load signed URL for receipt if needed
    if (newId && expense.receipt_url && !receiptUrls[expense.id]) {
      const { data } = await getSupabase()
        .storage
        .from('receipts')
        .createSignedUrl(expense.receipt_url, 3600) // 1 hour

      if (data?.signedUrl) {
        setReceiptUrls(prev => ({ ...prev, [expense.id]: data.signedUrl }))
      }
    }

    setExpandedId(newId)
  }

  if (loading) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-osps-gray-light rounded w-1/3" />
          <div className="h-24 bg-osps-gray-light rounded-2xl" />
          <div className="h-16 bg-osps-gray-light rounded-2xl" />
          <div className="h-16 bg-osps-gray-light rounded-2xl" />
        </div>
      </div>
    )
  }

  if (!group) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center">
        <p className="text-osps-gray">Group not found.</p>
        <Link to="/dashboard" className="text-osps-red font-medium mt-2 inline-block">
          Back to dashboard
        </Link>
      </div>
    )
  }

  const bal = formatBalance(myBalance, group.currency)

  return (
    <div className="max-w-lg mx-auto px-4 py-8 pb-safe">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/dashboard" className="text-sm text-osps-gray hover:text-osps-black">
            ← Back
          </Link>
          <h1 className="text-2xl font-display font-bold mt-1">{group.name}</h1>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowInvite(true)} className="btn-ghost text-sm">
            👥 Invite
          </button>
          <button
            onClick={() => setShowSettings(true)}
            className="btn-ghost text-sm px-3"
            title="Group settings"
          >
            ⚙️
          </button>
        </div>
      </div>

      {/* Settled banner */}
      {group.is_settled && (
        <div className="bg-osps-green/10 border border-osps-green/20 rounded-2xl px-4 py-3 mb-6 text-center">
          <p className="text-sm font-display font-semibold text-osps-green">
            ✓ This group is settled
          </p>
        </div>
      )}

      {/* My balance */}
      <div className="card mb-6 text-center">
        <p className="text-sm text-osps-gray mb-1">Your balance</p>
        <p className={`text-3xl font-display font-bold currency ${
          bal.isZero ? 'text-osps-gray' : bal.isPositive ? 'text-osps-green' : 'text-osps-red'
        }`}>
          {bal.isPositive ? '+' : bal.isZero ? '' : '-'}{bal.text}
        </p>
        <p className="text-xs text-osps-gray mt-1">
          {bal.isZero ? 'All settled!' : bal.isPositive ? 'You are owed' : 'You owe'}
        </p>
      </div>

      {/* Simplified debts */}
      {transactions.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-display font-semibold text-osps-gray uppercase tracking-wider mb-3">
            Settle up
          </h2>
          <div className="space-y-2">
            {transactions.map((t, i) => {
              const fromName = members.find(m => m.id === t.from)?.display_name || 'Deleted user'
              const toName = members.find(m => m.id === t.to)?.display_name || 'Deleted user'
              const isConfirming = settlingIndex === i
              return (
                <div key={i} className="card flex items-center justify-between py-3">
                  <span className="text-sm">
                    <span className="font-medium">{fromName}</span>
                    <span className="text-osps-gray"> pays </span>
                    <span className="font-medium">{toName}</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="currency text-osps-red font-semibold">
                      {formatCurrency(t.amount, group.currency)}
                    </span>
                    {t.from === profile?.id && (isConfirming ? (
                      <button
                        onClick={() => recordSettlement(t)}
                        className="text-xs font-display font-semibold bg-osps-green text-white px-3 py-1.5 rounded-lg
                                   hover:bg-osps-green/90 active:scale-[0.97] transition-all"
                      >
                        Confirm
                      </button>
                    ) : (
                      <button
                        onClick={() => setSettlingIndex(i)}
                        className="text-xs font-display font-semibold text-osps-green border border-osps-green/30 px-3 py-1.5 rounded-lg
                                   hover:bg-osps-green/5 active:scale-[0.97] transition-all"
                      >
                        Paid
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Add expense button */}
      {!group.is_settled && (
        <Link to={`/group/${groupId}/add`} className="btn-primary w-full text-center block mb-6">
          + Add Expense
        </Link>
      )}

      {/* Expense list */}
      <h2 className="text-sm font-display font-semibold text-osps-gray uppercase tracking-wider mb-3">
        Expenses
      </h2>
      {expenses.length === 0 ? (
        <div className="text-center py-12 text-osps-gray">
          <p className="text-3xl mb-2">🧾</p>
          <p className="text-sm">No expenses yet. Add one!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map(expense => {
            const isExpanded = expandedId === expense.id
            const canManage = expense.created_by === profile?.id || isAdmin

            return (
              <div
                key={expense.id}
                className="card overflow-hidden transition-all duration-200"
              >
                {/* Summary row — always visible, tappable */}
                <button
                  onClick={() => handleExpand(expense)}
                  className="w-full flex items-center justify-between py-3 text-left"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm truncate">{expense.title}</p>
                    <p className="text-xs text-osps-gray mt-0.5">
                      Paid by {expense.payer?.display_name || 'Deleted user'} · {formatRelativeDate(expense.expense_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3 shrink-0">
                    <span className="currency font-semibold">
                      {formatCurrency(expense.total_amount, expense.currency)}
                    </span>
                    {expense.original_currency && expense.original_currency !== expense.currency && (
                      <span className="text-xs text-osps-gray font-normal">
                        · {formatCompact(expense.original_amount, expense.original_currency)}
                      </span>
                    )}
                    <span className={`text-sm font-display transition-all duration-200 ${isExpanded ? 'text-osps-black font-bold' : 'text-osps-gray/40 font-medium'}`}>
                      {isExpanded ? '✕' : '+'}
                    </span>
                  </div>
                </button>

                {/* Expanded detail */}
                {isExpanded && (
                  <div className="border-t border-osps-gray-light pt-3 pb-1 animate-fadeIn">
                    {/* Exchange rate breakdown (foreign currency only) */}
                    {expense.original_currency && expense.original_currency !== expense.currency && (
                      <div className="mb-3 bg-osps-cream/50 rounded-lg px-3 py-2 space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-osps-gray">Original</span>
                          <span className="font-mono">{formatCurrency(expense.original_amount, expense.original_currency)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-osps-gray">Rate</span>
                          <span className="font-mono text-xs">1 {expense.original_currency} = {expense.exchange_rate} {expense.currency}</span>
                        </div>
                      </div>
                    )}

                    {/* Split breakdown */}
                    <p className="text-xs font-display font-semibold text-osps-gray uppercase tracking-wider mb-2">
                      Split ({expense.split_mode})
                    </p>
                    <div className="space-y-1 mb-3">
                      {expense.splits?.map(split => (
                        <div key={split.user_id} className="flex justify-between text-sm">
                          <span className="text-osps-gray">{getMemberName(split.user_id)}</span>
                          <span className="currency">{formatCurrency(split.owed_amount, expense.currency)}</span>
                        </div>
                      ))}
                    </div>

                    {/* Receipt items — shown when line items exist, any split mode */}
                    {expense.line_items?.length > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-display font-semibold text-osps-gray uppercase tracking-wider mb-2">
                          Receipt items
                        </p>
                        <div className="space-y-1">
                          {expense.line_items.map(item => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className="text-osps-gray">
                                {item.quantity > 1 && <span className="text-osps-gray/60">{item.quantity}× </span>}
                                {item.name}
                              </span>
                              <span className="currency text-osps-gray">{formatCurrency(item.amount, expense.currency)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Notes */}
                    {expense.notes && (
                      <p className="text-sm text-osps-gray italic mb-3">
                        "{expense.notes}"
                      </p>
                    )}

                    {/* Receipt image */}
                    {receiptUrls[expense.id] && (
                      <div className="mb-3">
                        <p className="text-xs font-display font-semibold text-osps-gray uppercase tracking-wider mb-2">
                          Receipt
                        </p>
                        <a
                          href={receiptUrls[expense.id]}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <img
                            src={receiptUrls[expense.id]}
                            alt="Receipt"
                            className="w-full max-w-[200px] rounded-xl border border-osps-gray-light
                                       hover:opacity-80 transition-opacity cursor-pointer"
                          />
                        </a>
                      </div>
                    )}

                    {/* Edit / Delete — creator or admin */}
                    {canManage && !group.is_settled && (
                      <div className="flex gap-2 pt-2 border-t border-osps-gray-light">
                        <button
                          onClick={() => navigate(`/group/${groupId}/add?edit=${expense.id}`)}
                          className="flex-1 text-xs font-display font-semibold text-osps-black py-2 rounded-lg
                                     hover:bg-osps-black/5 active:scale-[0.98] transition-all"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(expense)}
                          className="flex-1 text-xs font-display font-semibold text-osps-red py-2 rounded-lg
                                     hover:bg-osps-red/5 active:scale-[0.98] transition-all"
                        >
                          🗑 Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Members */}
      <h2 className="text-sm font-display font-semibold text-osps-gray uppercase tracking-wider mb-3 mt-8">
        Members ({members.length})
      </h2>
      <div className="flex flex-wrap gap-2">
        {members.map(m => (
          <span key={m.id} className="bg-white border border-osps-gray-light rounded-full px-3 py-1 text-sm flex items-center gap-1.5">
            {m.display_name}
            {m.role === 'admin' && (
              <span className="text-[10px] font-display font-semibold text-osps-yellow uppercase">admin</span>
            )}
          </span>
        ))}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <InviteModal group={group} onClose={() => setShowInvite(false)} onMemberAdded={loadGroup} />
      )}

      {/* Settings panel */}
      {showSettings && (
        <GroupSettingsPanel
          group={group}
          isAdmin={isAdmin}
          onUpdate={updateGroup}
          onDelete={deleteGroup}
          onLeave={leaveGroup}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* Delete expense confirmation */}
      {deleteTarget && (
        <ConfirmDialog
          title="Delete expense?"
          message={`"${deleteTarget.title}" (${formatCurrency(deleteTarget.total_amount, deleteTarget.currency)}) will be permanently deleted and all splits removed.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => deleteExpense(deleteTarget.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}

    </div>
  )
}