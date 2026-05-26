/**
 * Exchange rate utilities — fetches from frankfurter.dev.
 * Always fetches by explicit date so rate reflects when money was spent.
 */

const BASE_URL = 'https://api.frankfurter.dev/v1'

/**
 * @param {string} from - Source currency (e.g. 'MYR')
 * @param {string} to   - Target currency (e.g. 'SGD')
 * @param {string} date - ISO date YYYY-MM-DD (the expense date)
 * @returns {Promise<{ from, to, rate, date, fetchedAt }>}
 */
export async function fetchExchangeRate(from, to, date) {
  if (from === to) {
    return { from, to, rate: 1, date, fetchedAt: new Date().toISOString() }
  }

  const res = await fetch(`${BASE_URL}/${date}?from=${from}&to=${to}`)

  if (!res.ok) {
    const err = new Error(`Exchange rate fetch failed: ${res.status}`)
    err.status = res.status
    throw err
  }

  const data = await res.json()
  const rate = data.rates?.[to]

  if (rate == null) throw new Error(`No rate found for ${from} → ${to}`)

  return { from, to, rate, date: data.date, fetchedAt: new Date().toISOString() }
}
