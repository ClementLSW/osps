/**
 * Parse Receipt — /api/parse-receipt
 *
 * Accepts a base64-encoded receipt image, sends it to OpenRouter's
 * vision model for structured extraction, and returns parsed data
 * that the client uses to auto-populate the AddExpense form.
 *
 * Flow:
 *   1. Client compresses image + converts to base64
 *   2. POST here with { image: "data:image/jpeg;base64,..." }
 *   3. We forward to OpenRouter (Qwen 2.5 VL) with a structured prompt
 *   4. Parse the model's JSON response
 *   5. Return { merchant, total, currency, items[] } to client
 *
 * Auth: Requires valid session cookie (same as all other endpoints).
 * Cost: Uses OpenRouter free tier models ($0).
 *
 * Request body:
 *   { image: "data:image/jpeg;base64,/9j/4AAQ..." }
 */

import { parseCookies, decrypt } from './_utils/cookies.mjs'

const PRIMARY_MODEL = 'qwen/qwen2.5-vl-32b-instruct:free'
const FALLBACK_MODEL = 'qwen/qwen2.5-vl-72b-instruct:free'

const SYSTEM_PROMPT = `You are a receipt parser. Given an image of a receipt, extract the data into JSON.

RULES:
- Return ONLY a JSON object, no markdown fences, no explanation, no preamble
- All monetary amounts as numbers (not strings), e.g. 15.90 not "15.90"
- If you cannot read a field, omit it from the JSON
- If you cannot parse the receipt at all, return: {"error": "Could not parse receipt"}
- For quantity, default to 1 if not visible
- Detect the currency from the receipt if possible (SGD, USD, MYR, etc.)

OUTPUT FORMAT:
{
  "merchant": "Restaurant Name",
  "currency": "SGD",
  "items": [
    {"name": "Item name", "amount": 15.90, "quantity": 1},
    {"name": "Another item", "amount": 12.50, "quantity": 2}
  ],
  "subtotal": 28.40,
  "tax": 2.56,
  "service_charge": 2.84,
  "total": 33.80
}

NOTES:
- "items" should be individual line items, NOT subtotal/tax/total
- If tax or service_charge is not listed, omit those fields
- If the receipt is from Singapore, look for 9% GST and 10% service charge
- Handle English, Chinese, and Malay text on receipts`

export default async (request) => {
  const openrouterKey = process.env.OPENROUTER_API_KEY

  if (!openrouterKey) {
    return respond(500, { error: 'Receipt parsing not configured' })
  }

  if (request.method !== 'POST') {
    return respond(405, { error: 'Method not allowed' })
  }

  // Verify caller is authenticated
  const cookies = parseCookies(request)
  const session = decrypt(cookies['osps-session'] || '')
  if (!session) {
    return respond(401, { error: 'Not authenticated' })
  }

  try {
    const { image } = await request.json()

    if (!image) {
      return respond(400, { error: 'No image provided' })
    }

    // Try primary model, fall back to larger model on failure
    let result = await callOpenRouter(openrouterKey, PRIMARY_MODEL, image)

    if (result.error && result.fallback) {
      console.log('Primary model failed, trying fallback...')
      result = await callOpenRouter(openrouterKey, FALLBACK_MODEL, image)
    }

    if (result.error) {
      return respond(result.status || 500, { error: result.error })
    }

    // Distribute tax + service charge proportionally into item amounts
    const normalized = normalizeItems(result.data)

    return respond(200, normalized)
  } catch (err) {
    console.error('Parse receipt error:', err)
    return respond(500, { error: 'Failed to parse receipt' })
  }
}

async function callOpenRouter(apiKey, model, imageBase64) {
  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://osps.clementlsw.com',
        'X-Title': 'O$P$ Receipt Parser',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: { url: imageBase64 },
              },
              {
                type: 'text',
                text: 'Parse this receipt and return the JSON.',
              },
            ],
          },
        ],
        max_tokens: 2000,
        temperature: 0.1, // Low temperature for structured extraction
      }),
    })

    if (response.status === 429) {
      return { error: 'Rate limited — try again in a moment', status: 429 }
    }

    if (!response.ok) {
      const errBody = await response.text()
      console.error(`OpenRouter error (${model}):`, response.status, errBody)
      return { error: 'Vision model unavailable', fallback: true, status: 502 }
    }

    const data = await response.json()
    const content = data.choices?.[0]?.message?.content

    if (!content) {
      return { error: 'No response from vision model', fallback: true }
    }

    // Parse JSON from model output — strip markdown fences if present
    const cleaned = content
      .replace(/```json\s*/g, '')
      .replace(/```\s*/g, '')
      .trim()

    const parsed = JSON.parse(cleaned)

    if (parsed.error) {
      return { error: parsed.error, status: 422 }
    }

    return { data: parsed }
  } catch (err) {
    if (err instanceof SyntaxError) {
      console.error(`JSON parse failed (${model}):`, err.message)
      return { error: 'Could not parse model response', fallback: true }
    }
    console.error(`OpenRouter call failed (${model}):`, err)
    return { error: 'Vision model request failed', fallback: true }
  }
}

/**
 * Distribute tax and service charge proportionally into item amounts.
 *
 * If the receipt has a subtotal of $100, tax of $9, and service charge of $10,
 * each item's amount gets multiplied by (100 + 9 + 10) / 100 = 1.19.
 * This way the line_item split mode distributes these costs fairly.
 */
function normalizeItems(data) {
  const items = data.items || []
  const subtotal = data.subtotal || items.reduce((sum, i) => sum + (i.amount * (i.quantity || 1)), 0)
  const tax = data.tax || 0
  const serviceCharge = data.service_charge || 0
  const extras = tax + serviceCharge

  let normalizedItems = items

  if (extras > 0 && subtotal > 0) {
    const multiplier = (subtotal + extras) / subtotal
    normalizedItems = items.map(item => ({
      ...item,
      amount: Math.round(item.amount * multiplier * 100) / 100,
    }))
  }

  // Compute total from normalized items (may differ slightly from receipt due to rounding)
  const computedTotal = normalizedItems.reduce(
    (sum, i) => sum + (i.amount * (i.quantity || 1)), 0
  )

  return {
    merchant: data.merchant || '',
    currency: data.currency || null,
    items: normalizedItems,
    total: data.total || Math.round(computedTotal * 100) / 100,
    // Include raw values for transparency
    raw: {
      subtotal: data.subtotal,
      tax: data.tax,
      service_charge: data.service_charge,
      total: data.total,
    },
  }
}

function respond(status, data) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
