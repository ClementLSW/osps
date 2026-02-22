import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getSupabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { useBalances } from '@/hooks/useBalances'
import { formatCurrency, formatBalance } from '@/lib/formatCurrency'
import InviteModal from '@/components/groups/InviteModal'
import toast from 'react-hot-toast'

export default function GroupDetail() {
  const { groupId } = useParams()
  const { profile } = useAuth()
  const [group, setGroup] = useState(null)
  const [members, setMembers] = useState([])
  const [expenses, setExpenses] = useState([])
  const [settlements, setSettlements] = useState([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [settlingIndex, setSettlingIndex] = useState(null)

  const { transactions, myBalance } = useBalances(expenses, settlements, profile?.id)

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

    // Fetch members with profiles
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
        payer:paid_by (display_name)
      `)
      .eq('group_id', groupId)
      .order('expense_date', { ascending: false })

    // Fetch settlements
    const { data: settlementData } = await getSupabase()
      .from('settlements')
      .select('*')
      .eq('group_id', groupId)

    setGroup(groupData)
    setMembers(memberData?.map(m => m.profiles) || [])
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
    <div className="max-w-lg mx-auto px-4 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link to="/dashboard" className="text-sm text-osps-gray hover:text-osps-black">
            ← Back
          </Link>
          <h1 className="text-2xl font-display font-bold mt-1">{group.name}</h1>
        </div>
        <button onClick={() => setShowInvite(true)} className="btn-ghost text-sm">
          👥 Invite
        </button>
      </div>

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
              const fromName = members.find(m => m.id === t.from)?.display_name || 'Unknown'
              const toName = members.find(m => m.id === t.to)?.display_name || 'Unknown'
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
                    {isConfirming ? (
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
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Add expense button */}
      <Link to={`/group/${groupId}/add`} className="btn-primary w-full text-center block mb-6">
        + Add Expense
      </Link>

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
          {expenses.map(expense => (
            <div key={expense.id} className="card flex items-center justify-between py-3">
              <div>
                <p className="font-medium text-sm">{expense.title}</p>
                <p className="text-xs text-osps-gray mt-0.5">
                  Paid by {expense.payer?.display_name} · {expense.split_mode}
                </p>
              </div>
              <span className="currency font-semibold">
                {formatCurrency(expense.total_amount, expense.currency)}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Members */}
      <h2 className="text-sm font-display font-semibold text-osps-gray uppercase tracking-wider mb-3 mt-8">
        Members ({members.length})
      </h2>
      <div className="flex flex-wrap gap-2">
        {members.map(m => (
          <span key={m.id} className="bg-white border border-osps-gray-light rounded-full px-3 py-1 text-sm">
            {m.display_name}
          </span>
        ))}
      </div>

      {/* Invite modal */}
      {showInvite && (
        <InviteModal group={group} onClose={() => setShowInvite(false)} onMemberAdded={loadGroup} />
      )}
    </div>
  )
}
