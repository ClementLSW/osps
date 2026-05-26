/**
 * Exchange rate utilities — calls /api/exchange-rate (Netlify Function proxy).
 *
 * The proxy calls api.frankfurter.dev server-side, avoiding browser CORS
 * restrictions. Rate convention: 1 unit of `from` = X units of `to`.
 *
 * ECB publish window:
 *   Rates update daily around 16:00 CET (22:00 SGT). During this window
 *   /latest can be unstable. If the call fails without an explicit date,
 *   we retry once with yesterday's date as a fallback.
 */

/**
 * Fetch exchange rate.
 * @param {string} from   - Source currency (ISO 4217, e.g. 'MYR')
 * @param {string} to     - Target currency (ISO 4217, e.g. 'SGD')
 * @param {string} [date] - ISO date string (YYYY-MM-DD) for historical rate
 * @returns {Promise<{ from, to, rate, date, fetchedAt, usedFallbackDate? }>}
 */
export async function fetchExchangeRate(from, to, date) {
  if (from === to) {
    return {
      from,
      to,
      rate: 1,
      date: date || new Date().toISOString().slice(0, 10),
      fetchedAt: new Date().toISOString(),
    }
  }

  // First attempt
  try {
    return await _fetchOnce(from, to, date)
  } catch (err) {
    // Only retry /latest — historical dates don't have publish window issues
    if (date) throw err

    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const fallbackDate = yesterday.toISOString().slice(0, 10)

    const result = await _fetchOnce(from, to, fallbackDate)
    return { ...result, usedFallbackDate: true }
  }
}

async function _fetchOnce(from, to, date) {
  const params = new URLSearchParams({ from, to })
  if (date) params.set('date', date)

  const res = await fetch(`/api/exchange-rate?${params}`)

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    const err = new Error(body.error || `Exchange rate fetch failed: ${res.status}`)
    err.status = res.status
    throw err
  }

  const data = await res.json()

  return {
    from: data.from,
    to: data.to,
    rate: data.rate,
    date: data.date,
    fetchedAt: new Date().toISOString(),
  }
}
