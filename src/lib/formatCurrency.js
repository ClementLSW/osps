const formatters = new Map()

/**
 * Format a number as currency.
 *
 * @param {number} amount
 * @param {string} currency - ISO 4217 code (default: SGD)
 * @returns {string} e.g. "$12.50" or "¥1,200"
 */
export function formatCurrency(amount, currency = 'SGD') {
  if (!formatters.has(currency)) {
    formatters.set(
      currency,
      new Intl.NumberFormat('en-SG', {
        style: 'currency',
        currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    )
  }
  return formatters.get(currency).format(amount)
}

/**
 * Format a signed balance (positive = owed to you, negative = you owe).
 *
 * @param {number} amount
 * @param {string} currency
 * @returns {{ text: string, isPositive: boolean, isZero: boolean }}
 */
export function formatBalance(amount, currency = 'SGD') {
  const isZero = Math.abs(amount) < 0.005
  const isPositive = amount > 0

  return {
    text: isZero ? formatCurrency(0, currency) : formatCurrency(Math.abs(amount), currency),
    isPositive,
    isZero,
  }
}
