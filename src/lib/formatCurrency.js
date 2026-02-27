const formatters = new Map()
const compactFormatters = new Map()

/**
 * Format a number as currency.
 * Decimal places are handled automatically by Intl — e.g. JPY/IDR/KRW
 * get 0 decimals, SGD/USD get 2, without needing a manual list.
 *
 * @param {number} amount
 * @param {string} currency - ISO 4217 code (default: SGD)
 * @returns {string} e.g. "$12.50" or "Rp 150,000"
 */
export function formatCurrency(amount, currency = 'SGD') {
  if (!formatters.has(currency)) {
    formatters.set(
      currency,
      new Intl.NumberFormat('en-SG', {
        style: 'currency',
        currency,
      })
    )
  }
  return formatters.get(currency).format(amount)
}

/**
 * Format a number as compact currency for tight spaces.
 * e.g. 1,500,000 IDR → "Rp 1.5M", 53,000 IDR → "Rp 53K"
 * For small amounts or decimal currencies, behaves like formatCurrency.
 *
 * @param {number} amount
 * @param {string} currency - ISO 4217 code
 * @returns {string}
 */
export function formatCompact(amount, currency = 'SGD') {
  if (!compactFormatters.has(currency)) {
    compactFormatters.set(
      currency,
      new Intl.NumberFormat('en-SG', {
        style: 'currency',
        currency,
        notation: 'compact',
        maximumFractionDigits: 1,
      })
    )
  }
  return compactFormatters.get(currency).format(amount)
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
