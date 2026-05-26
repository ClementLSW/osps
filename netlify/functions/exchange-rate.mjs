/**
 * Exchange Rate Proxy — /api/exchange-rate
 *
 * Proxies requests to api.frankfurter.dev server-side, avoiding
 * browser CORS restrictions on the third-party API.
 *
 * Query params:
 *   from  - Source currency ISO code (e.g. MYR)
 *   to    - Target currency ISO code (e.g. SGD)
 *   date  - Optional ISO date (YYYY-MM-DD) for historical rate
 *
 * Returns:
 *   { from, to, rate, date } on success
 *   { error } with appropriate HTTP status on failure
 */

const FRANKFURTER_BASE = 'https://api.frankfurter.dev/v1'
const TIMEOUT_MS = 10_000

export default async (request) => {
  if (request.method !== 'GET') {
    return respond(405, { error: 'Method not allowed' })
  }

  const url = new URL(request.url)
  const from = url.searchParams.get('from')?.toUpperCase()
  const to = url.searchParams.get('to')?.toUpperCase()
  const date = url.searchParams.get('date') || null

  if (!from || !to) {
    return respond(400, { error: 'Missing required params: from, to' })
  }

  // Same-currency shortcut — no need to hit Frankfurter
  if (from === to) {
    const today = new Date().toISOString().slice(0, 10)
    return respond(200, { from, to, rate: 1, date: date || today })
  }

  // Validate date format if provided
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return respond(400, { error: 'Invalid date format — use YYYY-MM-DD' })
  }

  const endpoint = date ? `/${date}` : '/latest'
  const frankfurterUrl = `${FRANKFURTER_BASE}${endpoint}?from=${from}&to=${to}`

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const res = await fetch(frankfurterUrl, { signal: controller.signal })

      if (!res.ok) {
        const body = await res.text()
        console.error(`Frankfurter error ${res.status}:`, body)
        return respond(res.status === 404 ? 404 : 502, {
          error: `Exchange rate unavailable (upstream ${res.status})`,
        })
      }

      const data = await res.json()
      const rate = data.rates?.[to]

      if (rate == null) {
        console.error(`No rate in Frankfurter response for ${from}→${to}:`, data)
        return respond(502, { error: `No rate found for ${from} → ${to}` })
      }

      return respond(200, { from, to, rate, date: data.date })
    } finally {
      clearTimeout(timeout)
    }
  } catch (err) {
    if (err.name === 'AbortError') {
      console.error(`Frankfurter timeout after ${TIMEOUT_MS}ms`)
      return respond(504, { error: 'Exchange rate request timed out' })
    }
    console.error('Exchange rate proxy error:', err)
    return respond(502, { error: 'Could not reach exchange rate service' })
  }
}

function respond(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
