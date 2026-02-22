/**
 * Cookie utilities for server-side auth.
 *
 * We encrypt cookie contents with AES-256-GCM so that even if someone
 * intercepts the cookie value (unlikely with Secure + httpOnly), they
 * can't read or tamper with the tokens inside.
 *
 * Cookie anatomy:
 *   Name: osps-session
 *   Value: base64url( IV + AuthTag + Ciphertext )
 *   Flags: HttpOnly, Secure, SameSite=Lax, Path=/
 *
 * Why each flag matters:
 *   HttpOnly  → JavaScript cannot read this cookie (XSS protection)
 *   Secure    → Only sent over HTTPS (network sniffing protection)
 *   SameSite=Lax → Sent on top-level navigations but NOT on cross-site
 *                   POST requests (CSRF protection). We use Lax instead
 *                   of Strict because the OAuth redirect is a top-level
 *                   navigation from Google back to our site.
 *   Path=/    → Available on all routes (needed for /api/* endpoints)
 */

import crypto from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12     // GCM standard
const TAG_LENGTH = 16    // GCM standard auth tag

/**
 * Derive an encryption key from the COOKIE_SECRET env var.
 *
 * Why scrypt? We want a 32-byte key for AES-256, but COOKIE_SECRET
 * could be any length. scrypt is a key derivation function that
 * stretches the secret into a fixed-length key safely.
 */
function getKey() {
  const secret = process.env.COOKIE_SECRET
  if (!secret || secret.length < 32) {
    throw new Error('COOKIE_SECRET must be at least 32 characters')
  }
  return crypto.scryptSync(secret, 'osps-cookie-salt', 32)
}

/**
 * Encrypt a JavaScript object into a cookie-safe string.
 *
 * Layout of the output (base64url-encoded):
 *   [12 bytes IV][16 bytes AuthTag][N bytes Ciphertext]
 *
 * GCM mode gives us both confidentiality (encryption) and integrity
 * (the auth tag). If anyone modifies even one bit, decryption fails.
 */
export function encrypt(data) {
  const key = getKey()
  const iv = crypto.randomBytes(IV_LENGTH)
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv)

  const plaintext = JSON.stringify(data)
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()

  // Pack IV + tag + ciphertext into one buffer
  const packed = Buffer.concat([iv, tag, encrypted])
  return packed.toString('base64url')
}

/**
 * Decrypt a cookie string back into a JavaScript object.
 * Returns null if decryption fails (tampered or wrong key).
 */
export function decrypt(cookieValue) {
  try {
    const key = getKey()
    const buf = Buffer.from(cookieValue, 'base64url')

    // Unpack the components
    const iv = buf.subarray(0, IV_LENGTH)
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
    const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH)

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(tag)

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ])

    return JSON.parse(decrypted.toString('utf8'))
  } catch (err) {
    // Decryption failed — cookie was tampered with or key changed
    console.error('Cookie decryption failed:', err.message)
    return null
  }
}

/**
 * Parse cookies from a Request's Cookie header.
 *
 * HTTP cookies come as a single header string:
 *   "name1=value1; name2=value2; name3=value3"
 *
 * This parses them into a plain object: { name1: "value1", ... }
 */
export function parseCookies(request) {
  const header = request.headers.get('cookie') || ''
  const cookies = {}

  header.split(';').forEach(pair => {
    const [name, ...rest] = pair.trim().split('=')
    if (name) {
      cookies[name.trim()] = rest.join('=').trim()
    }
  })

  return cookies
}

/**
 * Build a Set-Cookie header string.
 *
 * @param {string} name - Cookie name
 * @param {string} value - Cookie value (already encrypted)
 * @param {object} options - Cookie options
 */
export function buildCookieHeader(name, value, options = {}) {
  const {
    maxAge = 60 * 60 * 24 * 7, // 7 days default
    path = '/',
    httpOnly = true,
    secure = true,
    sameSite = 'Lax',
  } = options

  const parts = [`${name}=${value}`]
  parts.push(`Path=${path}`)
  parts.push(`Max-Age=${maxAge}`)
  if (httpOnly) parts.push('HttpOnly')
  if (secure) parts.push('Secure')
  parts.push(`SameSite=${sameSite}`)

  return parts.join('; ')
}

/**
 * Build a Set-Cookie header that clears (deletes) a cookie.
 * Setting Max-Age=0 tells the browser to remove it immediately.
 */
export function clearCookieHeader(name) {
  return `${name}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`
}
