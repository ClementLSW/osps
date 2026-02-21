import { useMemo } from 'react'
import { computeNetBalances, simplifyDebts } from '@/lib/reconcile'

/**
 * Compute balances and simplified debts for a group.
 *
 * @param {Array} expenses - expenses with their splits loaded
 * @param {Array} settlements - existing settlements
 * @param {string} currentUserId - the logged-in user
 * @returns {{ balances: Map, transactions: Array, myBalance: number }}
 */
export function useBalances(expenses = [], settlements = [], currentUserId) {
  return useMemo(() => {
    const balances = computeNetBalances(expenses, settlements)
    const transactions = simplifyDebts(balances)
    const myBalance = balances.get(currentUserId) || 0

    return { balances, transactions, myBalance }
  }, [expenses, settlements, currentUserId])
}
