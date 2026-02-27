/**
 * Debt simplification algorithm.
 *
 * Given a list of expenses (with splits) and existing settlements,
 * computes the minimum set of transactions to settle all debts.
 *
 * Returns an array of { from, to, amount } objects.
 */

/**
 * Compute net balances for each user in a group.
 *
 * Positive = is owed money (creditor)
 * Negative = owes money (debtor)
 *
 * @param {Array} expenses - Array of { paid_by, splits: [{ user_id, owed_amount }] }
 * @param {Array} settlements - Array of { paid_by, paid_to, amount }
 * @returns {Map<string, number>} userId -> net balance
 */
export function computeNetBalances(expenses, settlements = []) {
  const balances = new Map()

  const addBalance = (userId, amount) => {
    balances.set(userId, (balances.get(userId) || 0) + amount)
  }

  // Process expenses
  // Skip null user IDs — these are from deleted accounts.
  // Effect: deleted user's debts are forgiven, their credits are zeroed.
  for (const expense of expenses) {
    if (!expense.paid_by) continue // payer was deleted
    for (const split of expense.splits) {
      if (!split.user_id) continue // participant was deleted
      if (split.user_id !== expense.paid_by) {
        addBalance(expense.paid_by, split.owed_amount)   // creditor
        addBalance(split.user_id, -split.owed_amount)    // debtor
      }
    }
  }

  // Process existing settlements (reduce outstanding debts)
  for (const settlement of settlements) {
    if (!settlement.paid_by || !settlement.paid_to) continue // party was deleted
    addBalance(settlement.paid_by, settlement.amount)   // paid off debt
    addBalance(settlement.paid_to, -settlement.amount)  // received payment
  }

  return balances
}

/**
 * Simplify debts using a greedy algorithm.
 *
 * Matches the largest debtor with the largest creditor iteratively.
 * Produces at most (n-1) transactions.
 *
 * @param {Map<string, number>} balances - userId -> net balance
 * @returns {Array<{ from: string, to: string, amount: number }>}
 */
export function simplifyDebts(balances) {
  const EPSILON = 0.005 // half a cent — avoids floating point dust

  // Separate into creditors and debtors
  const creditors = [] // { userId, amount } where amount > 0
  const debtors = []   // { userId, amount } where amount > 0 (absolute value)

  for (const [userId, balance] of balances) {
    if (balance > EPSILON) {
      creditors.push({ userId, amount: balance })
    } else if (balance < -EPSILON) {
      debtors.push({ userId, amount: Math.abs(balance) })
    }
  }

  // Sort descending by amount
  creditors.sort((a, b) => b.amount - a.amount)
  debtors.sort((a, b) => b.amount - a.amount)

  const transactions = []

  let ci = 0
  let di = 0

  while (ci < creditors.length && di < debtors.length) {
    const transfer = Math.min(creditors[ci].amount, debtors[di].amount)

    if (transfer > EPSILON) {
      transactions.push({
        from: debtors[di].userId,
        to: creditors[ci].userId,
        amount: roundCents(transfer),
      })
    }

    creditors[ci].amount -= transfer
    debtors[di].amount -= transfer

    if (creditors[ci].amount < EPSILON) ci++
    if (debtors[di].amount < EPSILON) di++
  }

  return transactions
}

/**
 * Full reconciliation: expenses + settlements -> simplified transactions.
 */
export function reconcile(expenses, settlements = []) {
  const balances = computeNetBalances(expenses, settlements)
  return simplifyDebts(balances)
}

/**
 * Round to 2 decimal places (banker's rounding).
 */
function roundCents(value) {
  return Math.round(value * 100) / 100
}
