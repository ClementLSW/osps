/**
 * Exchange rate utilities — fetches from frankfurter.dev (multi-source data).
 * No API key required. Supports current and historical daily rates.
 *
 * Rate convention: 1 unit of `from` = X units of `to`
 * For storage, we use: 1 original_currency = X group_currency
 *
 * Base URL notes:
 *   - api.frankfurter.app (old) 301-redirects to api.frankfurter.dev
 *   - We use /v1 explicitly — frozen but stable, response shape unchanged
 *   - v2 has a different shape and is a separate migration
 *
 * ECB publish window:
 *   The ECB publishes new rates around 16:00 CET (22:00 SGT). During this
 *   window /latest can be unstable. If it fails, we retry once with
 *   yesterday's explicit date as a fallback.
 */

const BASE_URL = 'https://api.frankfurter.dev/v1'

/**
 * Fetch exchange rate.
 * @param {string} from   - Source currency (ISO 4217, e.g. 'MYR')
 * @param {string} to     - Target currency (ISO 4217, e.g. 'SGD')
 * @param {string} [date] - ISO date string (YYYY-MM-DD) for historical rate. Omit for latest.
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
    // Only retry if this was a /latest call (no explicit date) and the
    // failure is likely transient (server error, rate limiting, or network)
    if (date || !_shouldRetryLatestFallback(err)) throw err

    // Retry with yesterday's date as fallback for ECB publish window instability
    const yesterday = new Date()
    yesterday.setUTCDate(yesterday.getUTCDate() - 1)
    const fallbackDate = yesterday.toISOString().slice(0, 10)

    try {
      const result = await _fetchOnce(from, to, fallbackDate)
      return { ...result, usedFallbackDate: true }
    } catch (fallbackErr) {
      if (fallbackErr && typeof fallbackErr === 'object') {
        if (!('cause' in fallbackErr)) fallbackErr.cause = err
        fallbackErr.originalError = err
      }
      throw fallbackErr
    }
  }
}

function _shouldRetryLatestFallback(err) {
  const status = err?.status

  if (status === 429) return true
  if (typeof status === 'number' && status >= 500) return true

  // fetch() network failures typically do not have an HTTP status
  if (status == null) return true

  return false
}

async function _fetchOnce(from, to, date) {
  const endpoint = date ? `/${date}` : '/latest'
  const res = await fetch(`${BASE_URL}${endpoint}?from=${from}&to=${to}`)

  if (!res.ok) {
    const err = new Error(`Exchange rate fetch failed: ${res.status}`)
    err.status = res.status
    throw err
  }

  const data = await res.json()
  // Response shape: { amount: 1, base: "MYR", date: "2026-05-26", rates: { "SGD": 0.xxx } }
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
