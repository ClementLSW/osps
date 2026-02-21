import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { splitEqual, splitExact, splitPercentage, splitShares, splitLineItems } from '@/lib/splitCalculators'
import { formatCurrency } from '@/lib/formatCurrency'
import toast from 'react-hot-toast'

const SPLIT_MODES = [
  { id: 'equal', label: 'Equal', icon: '÷' },
  { id: 'exact', label: 'Exact', icon: '#' },
  { id: 'percentage', label: '%', icon: '%' },
  { id: 'shares', label: 'Shares', icon: '⚖' },
  { id: 'line_item', label: 'Items', icon: '🧾' },
]

export default function AddExpense() {
  const { groupId } = useParams()
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [members, setMembers] = useState([])
  const [group, setGroup] = useState(null)

  // Form state
  const [title, setTitle] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [paidBy, setPaidBy] = useState(profile?.id)
  const [splitMode, setSplitMode] = useState('equal')
  const [selectedMembers, setSelectedMembers] = useState([])
  const [saving, setSaving] = useState(false)

  // Split-mode specific state
  const [exactAmounts, setExactAmounts] = useState({})
  const [percentages, setPercentages] = useState({})
  const [shares, setShares] = useState({})
  const [lineItems, setLineItems] = useState([{ name: '', amount: '', assignments: {} }])

  useEffect(() => {
    loadGroupData()
  }, [groupId])

  async function loadGroupData() {
    const { data: groupData } = await supabase
      .from('groups').select('*').eq('id', groupId).single()

    const { data: memberData } = await supabase
      .from('group_members')
      .select('user_id, profiles:user_id (id, display_name)')
      .eq('group_id', groupId)

    const memberList = memberData?.map(m => m.profiles) || []
    setGroup(groupData)
    setMembers(memberList)
    setSelectedMembers(memberList.map(m => m.id))
    setPaidBy(profile?.id)

    // Initialize split-mode state
    const defaultShares = {}
    const defaultPercentages = {}
    const defaultExact = {}
    memberList.forEach(m => {
      defaultShares[m.id] = 1
      defaultPercentages[m.id] = Math.round(100 / memberList.length)
      defaultExact[m.id] = ''
    })
    setShares(defaultShares)
    setPercentages(defaultPercentages)
    setExactAmounts(defaultExact)
  }

  function toggleMember(id) {
    setSelectedMembers(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    )
  }

  function computeSplits() {
    const total = parseFloat(totalAmount)
    if (!total || total <= 0) return { splits: [], error: 'Enter a valid amount' }

    switch (splitMode) {
      case 'equal':
        return { splits: splitEqual(total, selectedMembers) }

      case 'exact':
        return splitExact(total, selectedMembers.map(id => ({
          user_id: id,
          amount: parseFloat(exactAmounts[id]) || 0,
        })))

      case 'percentage':
        return splitPercentage(total, selectedMembers.map(id => ({
          user_id: id,
          percentage: parseFloat(percentages[id]) || 0,
        })))

      case 'shares':
        return splitShares(total, selectedMembers.map(id => ({
          user_id: id,
          shares: parseInt(shares[id]) || 0,
        })))

      case 'line_item': {
        const items = lineItems
          .filter(item => item.name && parseFloat(item.amount) > 0)
          .map(item => ({
            id: item.name,
            name: item.name,
            amount: parseFloat(item.amount),
            assignments: Object.entries(item.assignments)
              .filter(([_, v]) => v)
              .map(([userId]) => ({ user_id: userId, share_count: 1 })),
          }))
        return splitLineItems(total, items)
      }

      default:
        return { splits: [], error: 'Unknown split mode' }
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const total = parseFloat(totalAmount)
    if (!title.trim() || !total || total <= 0) {
      toast.error('Fill in title and amount')
      return
    }

    const { splits, error } = computeSplits()
    if (error) {
      toast.error(error)
      return
    }

    setSaving(true)

    // Insert expense
    const { data: expense, error: expError } = await supabase
      .from('expenses')
      .insert({
        group_id: groupId,
        paid_by: paidBy,
        title: title.trim(),
        total_amount: total,
        currency: group?.currency || 'SGD',
        split_mode: splitMode,
        created_by: profile.id,
      })
      .select()
      .single()

    if (expError) {
      toast.error('Failed to create expense')
      console.error(expError)
      setSaving(false)
      return
    }

    // Insert splits
    const { error: splitError } = await supabase
      .from('expense_splits')
      .insert(splits.map(s => ({
        expense_id: expense.id,
        user_id: s.user_id,
        owed_amount: s.owed_amount,
      })))

    if (splitError) {
      toast.error('Failed to save splits')
      console.error(splitError)
      setSaving(false)
      return
    }

    // If line items, save those too
    if (splitMode === 'line_item') {
      for (const item of lineItems.filter(i => i.name && parseFloat(i.amount) > 0)) {
        const { data: li } = await supabase
          .from('line_items')
          .insert({ expense_id: expense.id, name: item.name, amount: parseFloat(item.amount) })
          .select()
          .single()

        if (li) {
          const assignments = Object.entries(item.assignments)
            .filter(([_, v]) => v)
            .map(([userId]) => ({ line_item_id: li.id, user_id: userId, share_count: 1 }))
          if (assignments.length) {
            await supabase.from('line_item_assignments').insert(assignments)
          }
        }
      }
    }

    toast.success('Expense added!')
    navigate(`/group/${groupId}`)
  }

  const preview = computeSplits()

  return (
    <div className="max-w-lg mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="text-sm text-osps-gray hover:text-osps-black mb-4">
        ← Back
      </button>
      <h1 className="text-2xl font-display font-bold mb-6">Add Expense</h1>

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Title & Amount */}
        <input
          type="text"
          placeholder="What's this for?"
          value={title}
          onChange={e => setTitle(e.target.value)}
          className="input text-lg"
          required
        />

        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-osps-gray font-mono">$</span>
          <input
            type="number"
            placeholder="0.00"
            value={totalAmount}
            onChange={e => setTotalAmount(e.target.value)}
            className="input pl-8 text-2xl font-mono"
            step="0.01"
            min="0.01"
            required
          />
        </div>

        {/* Paid by */}
        <div>
          <label className="text-sm text-osps-gray font-medium block mb-2">Paid by</label>
          <select
            value={paidBy}
            onChange={e => setPaidBy(e.target.value)}
            className="input"
          >
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.display_name}</option>
            ))}
          </select>
        </div>

        {/* Split mode tabs */}
        <div>
          <label className="text-sm text-osps-gray font-medium block mb-2">Split method</label>
          <div className="flex gap-1 bg-osps-gray-light/50 rounded-xl p-1">
            {SPLIT_MODES.map(mode => (
              <button
                key={mode.id}
                type="button"
                onClick={() => setSplitMode(mode.id)}
                className={`flex-1 py-2 px-2 rounded-lg text-xs font-display font-medium transition-all ${
                  splitMode === mode.id
                    ? 'bg-white shadow-sm text-osps-black'
                    : 'text-osps-gray hover:text-osps-black'
                }`}
              >
                <span className="block text-base">{mode.icon}</span>
                {mode.label}
              </button>
            ))}
          </div>
        </div>

        {/* Member selection (for equal/exact/percentage/shares) */}
        {splitMode !== 'line_item' && (
          <div>
            <label className="text-sm text-osps-gray font-medium block mb-2">Split between</label>
            <div className="flex flex-wrap gap-2">
              {members.map(m => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => toggleMember(m.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    selectedMembers.includes(m.id)
                      ? 'bg-osps-black text-white'
                      : 'bg-osps-gray-light text-osps-gray'
                  }`}
                >
                  {m.display_name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Split-mode-specific inputs */}
        {splitMode === 'exact' && (
          <div className="space-y-2">
            {selectedMembers.map(id => {
              const member = members.find(m => m.id === id)
              return (
                <div key={id} className="flex items-center gap-3">
                  <span className="text-sm flex-1">{member?.display_name}</span>
                  <div className="relative w-32">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-osps-gray text-sm font-mono">$</span>
                    <input
                      type="number"
                      value={exactAmounts[id] || ''}
                      onChange={e => setExactAmounts({ ...exactAmounts, [id]: e.target.value })}
                      className="input pl-7 text-sm font-mono"
                      step="0.01"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {splitMode === 'percentage' && (
          <div className="space-y-2">
            {selectedMembers.map(id => {
              const member = members.find(m => m.id === id)
              return (
                <div key={id} className="flex items-center gap-3">
                  <span className="text-sm flex-1">{member?.display_name}</span>
                  <div className="relative w-24">
                    <input
                      type="number"
                      value={percentages[id] || ''}
                      onChange={e => setPercentages({ ...percentages, [id]: e.target.value })}
                      className="input pr-7 text-sm font-mono text-right"
                      step="1"
                      placeholder="0"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-osps-gray text-sm">%</span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {splitMode === 'shares' && (
          <div className="space-y-2">
            {selectedMembers.map(id => {
              const member = members.find(m => m.id === id)
              return (
                <div key={id} className="flex items-center gap-3">
                  <span className="text-sm flex-1">{member?.display_name}</span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShares({ ...shares, [id]: Math.max(0, (shares[id] || 1) - 1) })}
                      className="w-8 h-8 rounded-lg bg-osps-gray-light text-osps-black font-bold"
                    >-</button>
                    <span className="w-8 text-center font-mono">{shares[id] || 1}</span>
                    <button
                      type="button"
                      onClick={() => setShares({ ...shares, [id]: (shares[id] || 1) + 1 })}
                      className="w-8 h-8 rounded-lg bg-osps-gray-light text-osps-black font-bold"
                    >+</button>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {splitMode === 'line_item' && (
          <div className="space-y-3">
            {lineItems.map((item, idx) => (
              <div key={idx} className="card space-y-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Item name"
                    value={item.name}
                    onChange={e => {
                      const updated = [...lineItems]
                      updated[idx].name = e.target.value
                      setLineItems(updated)
                    }}
                    className="input text-sm flex-1"
                  />
                  <div className="relative w-28">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-osps-gray text-sm font-mono">$</span>
                    <input
                      type="number"
                      placeholder="0.00"
                      value={item.amount}
                      onChange={e => {
                        const updated = [...lineItems]
                        updated[idx].amount = e.target.value
                        setLineItems(updated)
                      }}
                      className="input pl-7 text-sm font-mono"
                      step="0.01"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {members.map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        const updated = [...lineItems]
                        updated[idx].assignments = {
                          ...updated[idx].assignments,
                          [m.id]: !updated[idx].assignments[m.id],
                        }
                        setLineItems(updated)
                      }}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium transition-all ${
                        item.assignments[m.id]
                          ? 'bg-osps-black text-white'
                          : 'bg-osps-gray-light/50 text-osps-gray'
                      }`}
                    >
                      {m.display_name}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLineItems([...lineItems, { name: '', amount: '', assignments: {} }])}
              className="btn-ghost w-full text-sm"
            >
              + Add item
            </button>
          </div>
        )}

        {/* Preview */}
        {totalAmount && preview.splits?.length > 0 && (
          <div className="bg-osps-black/5 rounded-xl p-4">
            <p className="text-xs font-display font-semibold text-osps-gray uppercase tracking-wider mb-2">Preview</p>
            {preview.splits.map(s => {
              const member = members.find(m => m.id === s.user_id)
              return (
                <div key={s.user_id} className="flex justify-between text-sm py-1">
                  <span>{member?.display_name}</span>
                  <span className="currency">{formatCurrency(s.owed_amount, group?.currency)}</span>
                </div>
              )
            })}
            {preview.error && (
              <p className="text-osps-red text-xs mt-2">{preview.error}</p>
            )}
          </div>
        )}

        <button type="submit" className="btn-primary w-full" disabled={saving}>
          {saving ? 'Saving...' : 'Add Expense'}
        </button>
      </form>
    </div>
  )
}
