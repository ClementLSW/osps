/**
 * Split calculators for each split mode.
 *
 * Each function returns an array of { user_id, owed_amount }.
 * The "owed_amount" is what each person owes toward the expense total.
 * (The payer's share is included — they "owe" themselves.)
 *
 * All functions handle rounding so splits always sum exactly to the total.
 */

/**
 * Equal split among participants.
 *
 * @param {number} total
 * @param {string[]} participantIds
 * @returns {Array<{ user_id: string, owed_amount: number }>}
 */
export function splitEqual(total, participantIds) {
  const n = participantIds.length
  if (n === 0) return []

  const baseAmount = Math.floor((total * 100) / n) / 100
  const remainder = Math.round((total - baseAmount * n) * 100) // cents remaining

  return participantIds.map((id, i) => ({
    user_id: id,
    owed_amount: i < remainder ? baseAmount + 0.01 : baseAmount,
  }))
}

/**
 * Exact amounts specified per person.
 *
 * @param {number} total
 * @param {Array<{ user_id: string, amount: number }>} assignments
 * @returns {{ splits: Array<{ user_id: string, owed_amount: number }>, error?: string }}
 */
export function splitExact(total, assignments) {
  const sum = assignments.reduce((acc, a) => acc + a.amount, 0)
  const diff = Math.abs(total - sum)

  if (diff > 0.01) {
    return {
      splits: [],
      error: `Amounts sum to $${sum.toFixed(2)} but total is $${total.toFixed(2)}. Difference: $${diff.toFixed(2)}`,
    }
  }

  return {
    splits: assignments.map(a => ({
      user_id: a.user_id,
      owed_amount: a.amount,
    })),
  }
}

/**
 * Percentage-based split.
 *
 * @param {number} total
 * @param {Array<{ user_id: string, percentage: number }>} assignments - percentages should sum to 100
 * @returns {{ splits: Array<{ user_id: string, owed_amount: number }>, error?: string }}
 */
export function splitPercentage(total, assignments) {
  const totalPercent = assignments.reduce((acc, a) => acc + a.percentage, 0)

  if (Math.abs(totalPercent - 100) > 0.01) {
    return {
      splits: [],
      error: `Percentages sum to ${totalPercent.toFixed(1)}%, must equal 100%.`,
    }
  }

  // Compute raw amounts
  const raw = assignments.map(a => ({
    user_id: a.user_id,
    rawAmount: (a.percentage / 100) * total,
  }))

  // Round and fix remainder
  return { splits: roundSplits(raw, total) }
}

/**
 * Shares-based split (e.g., 2 shares vs 1 share).
 *
 * @param {number} total
 * @param {Array<{ user_id: string, shares: number }>} assignments
 * @returns {{ splits: Array<{ user_id: string, owed_amount: number }>, error?: string }}
 */
export function splitShares(total, assignments) {
  const totalShares = assignments.reduce((acc, a) => acc + a.shares, 0)

  if (totalShares <= 0) {
    return { splits: [], error: 'Total shares must be greater than 0.' }
  }

  const raw = assignments.map(a => ({
    user_id: a.user_id,
    rawAmount: (a.shares / totalShares) * total,
  }))

  return { splits: roundSplits(raw, total) }
}

/**
 * Line-item split.
 *
 * Each item is assigned to one or more users (with optional share counts).
 * Tax/tip/service charge is distributed proportionally to each person's item subtotal.
 *
 * @param {number} total - Full expense total including tax/tip
 * @param {Array<{ id: string, amount: number, assignments: Array<{ user_id: string, share_count: number }> }>} items
 * @returns {{ splits: Array<{ user_id: string, owed_amount: number }>, error?: string }}
 */
export function splitLineItems(total, items) {
  const itemSubtotal = items.reduce((sum, item) => sum + item.amount, 0)
  const extras = total - itemSubtotal // tax, tip, service charge, etc.

  if (itemSubtotal <= 0) {
    return { splits: [], error: 'Items must have a positive total.' }
  }

  // Phase 1: Compute each person's item subtotal
  const userSubtotals = new Map()

  for (const item of items) {
    const totalShares = item.assignments.reduce((s, a) => s + a.share_count, 0)
    if (totalShares === 0) {
      return { splits: [], error: `Item "${item.name || item.id}" has no assignments.` }
    }

    for (const assignment of item.assignments) {
      const share = (assignment.share_count / totalShares) * item.amount
      userSubtotals.set(
        assignment.user_id,
        (userSubtotals.get(assignment.user_id) || 0) + share
      )
    }
  }

  // Phase 2: Distribute extras proportionally
  const raw = []
  for (const [userId, subtotal] of userSubtotals) {
    const proportion = subtotal / itemSubtotal
    const extraShare = extras * proportion
    raw.push({
      user_id: userId,
      rawAmount: subtotal + extraShare,
    })
  }

  return { splits: roundSplits(raw, total) }
}

// ── Helpers ──────────────────────────────────────────────

/**
 * Round split amounts to cents and adjust so they sum exactly to total.
 * Assigns rounding remainder to the largest share (least noticeable).
 */
function roundSplits(rawSplits, total) {
  const rounded = rawSplits.map(s => ({
    user_id: s.user_id,
    owed_amount: Math.round(s.rawAmount * 100) / 100,
  }))

  const sum = rounded.reduce((acc, s) => acc + Math.round(s.owed_amount * 100), 0)
  const targetCents = Math.round(total * 100)
  const diffCents = targetCents - sum

  if (diffCents !== 0) {
    // Find the largest split to absorb the rounding difference
    const maxIdx = rounded.reduce(
      (best, s, i) => (s.owed_amount > rounded[best].owed_amount ? i : best),
      0
    )
    rounded[maxIdx].owed_amount = Math.round((rounded[maxIdx].owed_amount * 100 + diffCents)) / 100
  }

  return rounded
}
