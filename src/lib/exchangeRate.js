/**
 * Exchange rate utilities — fetches from frankfurter.app (ECB data).
 * No API key required. Supports current and historical daily rates.
 *
 * Rate convention: 1 unit of `from` = X units of `to`
 * For storage, we use: 1 original_currency = X group_currency
 */

const BASE_URL = 'https://api.frankfurter.app'

/**
 * Fetch exchange rate.
 * @param {string} from - Source currency (ISO 4217, e.g. 'IDR')
 * @param {string} to   - Target currency (ISO 4217, e.g. 'SGD')
 * @param {string} [date] - ISO date string (YYYY-MM-DD) for historical rate. Omit for latest.
 * @returns {Promise<{ from, to, rate, date, fetchedAt }>}
 */
export async function fetchExchangeRate(from, to, date) {
  if (from === to) {
    return { from, to, rate: 1, date: date || new Date().toISOString().slice(0, 10), fetchedAt: new Date().toISOString() }
  }

  const endpoint = date ? `/${date}` : '/latest'
  const res = await fetch(`${BASE_URL}${endpoint}?from=${from}&to=${to}`)

  if (!res.ok) {
    throw new Error(`Exchange rate fetch failed: ${res.status}`)
  }

  const data = await res.json()
  // Response shape: { amount: 1, base: "IDR", date: "2026-03-15", rates: { "SGD": 0.0000833 } }
  const rate = data.rates?.[to]

  if (rate == null) {
    throw new Error(`No rate found for ${from} → ${to}`)
  }

  return {
    from,
    to,
    rate,
    date: data.date,
    fetchedAt: new Date().toISOString(),
  }
}
