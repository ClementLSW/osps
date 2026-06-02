/**
 * Exchange rate utilities — fetched via the /api/exchange-rate Netlify proxy
 * (server-side, so no browser CORS). Always fetched by explicit date so the
 * rate reflects when the money was spent.
 */

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

  const params = new URLSearchParams({ from, to })
  if (date) params.set('date', date)

  const res = await fetch(`/api/exchange-rate?${params}`)

  if (!res.ok) {
    let message = `Exchange rate fetch failed: ${res.status}`
    try {
      const body = await res.json()
      if (body?.error) message = body.error
    } catch {
      /* non-JSON error body — keep default message */
    }
    const err = new Error(message)
    err.status = res.status
    throw err
  }

  const data = await res.json()
  if (data.rate == null) throw new Error(`No rate found for ${from} → ${to}`)

  return { from, to, rate: data.rate, date: data.date, fetchedAt: new Date().toISOString() }
}
