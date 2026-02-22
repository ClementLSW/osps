import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { getSupabase } from '@/lib/supabase'
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
  const [searchParams] = useSearchParams()
  const { profile } = useAuth()

  const editId = searchParams.get('edit')
  const isEdit = Boolean(editId)

  const [members, setMembers] = useState([])
  const [group, setGroup] = useState(null)
  const [loadingEdit, setLoadingEdit] = useState(isEdit)

  // Form state
  const [title, setTitle] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [paidBy, setPaidBy] = useState(profile?.id)
  const [splitMode, setSplitMode] = useState('equal')
  const [selectedMembers, setSelectedMembers] = useState([])
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  // Split-mode specific state
  const [exactAmounts, setExactAmounts] = useState({})
  const [percentages, setPercentages] = useState({})
  const [shares, setShares] = useState({})
  const [lineItems, setLineItems] = useState([{ name: '', amount: '', assignments: {} }])

  // OCR state
  const fileInputRef = useRef(null)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    loadGroupData()
  }, [groupId])

  async function loadGroupData() {
    const { data: groupData } = await getSupabase()
      .from('groups').select('*').eq('id', groupId).single()

    const { data: memberData } = await getSupabase()
      .from('group_members')
      .select('user_id, profiles:user_id (id, display_name)')
      .eq('group_id', groupId)

    const memberList = memberData?.map(m => m.profiles) || []
    setGroup(groupData)
    setMembers(memberList)

    // Initialize defaults
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

    if (!isEdit) {
      setSelectedMembers(memberList.map(m => m.id))
      setPaidBy(profile?.id)
    } else {
      await loadExpenseForEdit(memberList, defaultShares, defaultPercentages, defaultExact)
    }
  }

  async function loadExpenseForEdit(memberList, defaultShares, defaultPercentages, defaultExact) {
    setLoadingEdit(true)

    // Fetch expense with splits
    const { data: expense, error } = await getSupabase()
      .from('expenses')
      .select(`
        *,
        splits:expense_splits (user_id, owed_amount)
      `)
      .eq('id', editId)
      .single()

    if (error || !expense) {
      toast.error('Could not load expense')
      navigate(`/group/${groupId}`)
      return
    }

    // Pre-populate common fields
    setTitle(expense.title)
    setTotalAmount(String(expense.total_amount))
    setPaidBy(expense.paid_by)
    setSplitMode(expense.split_mode)
    setNotes(expense.notes || '')

    // Pre-populate split-mode-specific fields
    const splitUserIds = expense.splits?.map(s => s.user_id) || []
    setSelectedMembers(splitUserIds)

    const total = parseFloat(expense.total_amount)

    switch (expense.split_mode) {
      case 'equal':
        // selectedMembers is sufficient
        break

      case 'exact': {
        const exact = { ...defaultExact }
        expense.splits?.forEach(s => {
          exact[s.user_id] = String(s.owed_amount)
        })
        setExactAmounts(exact)
        break
      }

      case 'percentage': {
        const pcts = { ...defaultPercentages }
        expense.splits?.forEach(s => {
          pcts[s.user_id] = String(Math.round((s.owed_amount / total) * 100))
        })
        setPercentages(pcts)
        break
      }

      case 'shares': {
        // Back-calculate shares from owed_amounts
        // Find the smallest split to use as the base unit
        const amounts = expense.splits?.map(s => s.owed_amount) || []
        const minAmount = Math.min(...amounts.filter(a => a > 0))
        const sh = { ...defaultShares }
        expense.splits?.forEach(s => {
          sh[s.user_id] = minAmount > 0 ? Math.round(s.owed_amount / minAmount) : 1
        })
        setShares(sh)
        break
      }

      case 'line_item': {
        // Line items are loaded below for all split modes
        break
      }
    }

    // Always load line items if they exist (OCR data persists across split mode changes)
    const { data: items } = await getSupabase()
      .from('line_items')
      .select(`
        *,
        assignments:line_item_assignments (user_id, share_count)
      `)
      .eq('expense_id', editId)
      .order('sort_order', { ascending: true })

    if (items?.length > 0) {
      const li = items.map(item => {
        const assignments = {}
        item.assignments?.forEach(a => {
          assignments[a.user_id] = true
        })
        return {
          name: item.name,
          amount: String(item.amount),
          assignments,
        }
      })
      setLineItems(li)
    }

    setLoadingEdit(false)
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

    if (isEdit) {
      await handleUpdate(total, splits)
    } else {
      await handleCreate(total, splits)
    }
  }

  async function handleCreate(total, splits) {
    // Insert expense
    const { data: expense, error: expError } = await getSupabase()
      .from('expenses')
      .insert({
        group_id: groupId,
        paid_by: paidBy,
        title: title.trim(),
        total_amount: total,
        currency: group?.currency || 'SGD',
        split_mode: splitMode,
        notes: notes.trim() || null,
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
    const { error: splitError } = await getSupabase()
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

    // Save line items if they exist (e.g. from OCR scan, even if split mode is equal)
    const hasLineItems = lineItems.some(i => i.name && parseFloat(i.amount) > 0)
    if (hasLineItems) {
      await saveLineItems(expense.id)
    }

    toast.success('Expense added!')
    navigate(`/group/${groupId}`)
  }

  async function handleUpdate(total, splits) {
    // Update the expense record
    const { error: expError } = await getSupabase()
      .from('expenses')
      .update({
        paid_by: paidBy,
        title: title.trim(),
        total_amount: total,
        split_mode: splitMode,
        notes: notes.trim() || null,
      })
      .eq('id', editId)

    if (expError) {
      toast.error('Failed to update expense')
      console.error(expError)
      setSaving(false)
      return
    }

    // Delete old splits (cascade handles line_item_assignments via line_items)
    await getSupabase()
      .from('expense_splits')
      .delete()
      .eq('expense_id', editId)

    // Delete old line items (if any — cascade handles assignments)
    await getSupabase()
      .from('line_items')
      .delete()
      .eq('expense_id', editId)

    // Insert new splits
    const { error: splitError } = await getSupabase()
      .from('expense_splits')
      .insert(splits.map(s => ({
        expense_id: editId,
        user_id: s.user_id,
        owed_amount: s.owed_amount,
      })))

    if (splitError) {
      toast.error('Failed to save splits')
      console.error(splitError)
      setSaving(false)
      return
    }

    // Save line items if they exist (persists OCR data across split mode changes)
    const hasLineItems = lineItems.some(i => i.name && parseFloat(i.amount) > 0)
    if (hasLineItems) {
      await saveLineItems(editId)
    }

    toast.success('Expense updated!')
    navigate(`/group/${groupId}`)
  }

  async function saveLineItems(expenseId) {
    for (const item of lineItems.filter(i => i.name && parseFloat(i.amount) > 0)) {
      const { data: li } = await getSupabase()
        .from('line_items')
        .insert({ expense_id: expenseId, name: item.name, amount: parseFloat(item.amount) })
        .select()
        .single()

      if (li) {
        const assignments = Object.entries(item.assignments)
          .filter(([_, v]) => v)
          .map(([userId]) => ({ line_item_id: li.id, user_id: userId, share_count: 1 }))
        if (assignments.length) {
          await getSupabase().from('line_item_assignments').insert(assignments)
        }
      }
    }
  }

  // ── Receipt scanning ──────────────────────────────────────

  /**
   * Compress an image file using canvas.
   * Resizes to max 1200px on long edge, JPEG at 0.7 quality.
   * Canvas redraw naturally strips EXIF metadata (GPS, etc).
   * Returns a base64 data URL string.
   */
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const MAX_SIZE = 1200
        let { width, height } = img

        if (width > MAX_SIZE || height > MAX_SIZE) {
          if (width > height) {
            height = Math.round(height * (MAX_SIZE / width))
            width = MAX_SIZE
          } else {
            width = Math.round(width * (MAX_SIZE / height))
            height = MAX_SIZE
          }
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        resolve(canvas.toDataURL('image/jpeg', 0.7))
      }
      img.onerror = () => reject(new Error('Failed to load image'))
      img.src = URL.createObjectURL(file)
    })
  }

  async function handleScanReceipt(e) {
    const file = e.target.files?.[0]
    if (!file) return

    // Reset file input so the same file can be re-selected
    e.target.value = ''

    if (file.size > 10 * 1024 * 1024) {
      toast.error('Image too large — max 10MB')
      return
    }

    setScanning(true)

    try {
      // Compress + strip EXIF
      const base64 = await compressImage(file)

      // Send to server for OCR
      const res = await fetch('/api/parse-receipt', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image: base64 }),
      })

      const data = await res.json()

      if (!res.ok) {
        toast.error(data.error || 'Failed to parse receipt')
        return
      }

      // Auto-populate form
      if (data.merchant) setTitle(data.merchant)
      if (data.total) setTotalAmount(String(data.total))

      if (data.items?.length > 0) {
        setSplitMode('line_item')
        setLineItems(
          data.items.map(item => ({
            name: item.name,
            amount: String(item.amount),
            assignments: {},
          }))
        )
        toast.success(`Parsed ${data.items.length} items — assign members to split`)
      } else {
        toast.success('Receipt parsed — review the details')
      }
    } catch (err) {
      console.error('Receipt scan error:', err)
      toast.error('Something went wrong — try again')
    } finally {
      setScanning(false)
    }
  }

  if (loadingEdit) {
    return (
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 bg-osps-gray-light rounded w-1/4" />
          <div className="h-10 bg-osps-gray-light rounded-xl" />
          <div className="h-10 bg-osps-gray-light rounded-xl" />
          <div className="h-10 bg-osps-gray-light rounded-xl" />
        </div>
      </div>
    )
  }

  const preview = computeSplits()

  return (
    <div className="max-w-lg mx-auto px-4 py-8 pb-safe">
      <button onClick={() => navigate(-1)} className="text-sm text-osps-gray hover:text-osps-black mb-4">
        ← Back
      </button>
      <h1 className="text-2xl font-display font-bold mb-6">
        {isEdit ? 'Edit Expense' : 'Add Expense'}
      </h1>

      {/* Receipt scanner — only show on new expenses */}
      {!isEdit && (
        <div className="mb-6">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic"
            onChange={handleScanReceipt}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={scanning}
            className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl
                       border-2 border-dashed border-osps-gray-light text-osps-gray
                       hover:border-osps-red/30 hover:text-osps-red
                       active:scale-[0.98] transition-all duration-150
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {scanning ? (
              <>
                <span className="animate-spin inline-block w-4 h-4 border-2 border-osps-red border-t-transparent rounded-full" />
                <span className="font-display font-medium text-sm text-osps-red">Parsing receipt...</span>
              </>
            ) : (
              <>
                <span className="text-lg">📷</span>
                <span className="font-display font-medium text-sm">Scan receipt</span>
              </>
            )}
          </button>
        </div>
      )}

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
            className="input pl-8 text-lg font-mono"
            step="0.01"
            min="0"
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

        {/* Notes */}
        <div>
          <label className="text-sm text-osps-gray font-medium block mb-2">Notes (optional)</label>
          <input
            type="text"
            placeholder="e.g. extra cheese"
            value={notes}
            onChange={e => setNotes(e.target.value)}
            className="input text-sm"
          />
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
                      className="w-10 h-10 rounded-lg bg-osps-gray-light text-osps-black font-bold"
                    >-</button>
                    <span className="w-8 text-center font-mono">{shares[id] || 1}</span>
                    <button
                      type="button"
                      onClick={() => setShares({ ...shares, [id]: (shares[id] || 1) + 1 })}
                      className="w-10 h-10 rounded-lg bg-osps-gray-light text-osps-black font-bold"
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
                <div className="flex flex-wrap gap-1.5">
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
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
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
          {saving ? 'Saving...' : isEdit ? 'Save Changes' : 'Add Expense'}
        </button>
      </form>
    </div>
  )
}