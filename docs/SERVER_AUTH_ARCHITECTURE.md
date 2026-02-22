# Server-Side OAuth Architecture — O$P$

## What Changed and Why

### Before (Client-Side Implicit Flow)

```
Browser                          Supabase                    Google
───────                          ────────                    ──────
1. Click "Sign in"
   → supabase.auth.signInWithOAuth()
   → Redirect to Google

                                                         2. User consents
                                                            → Redirect to
                                                            Supabase /callback

                                 3. Exchange code for tokens
                                    → Redirect to your app
                                    with #access_token=xxx

4. Supabase JS SDK reads
   token from URL hash
5. Stores in localStorage
6. All DB queries use this token
```

**Problems:**
- Tokens stored in `localStorage` → any XSS vulnerability can steal them
- Token appears in URL hash → visible in browser history, server logs
- Navigator LockManager issues (what we kept hitting)
- No server-side control over sessions

### After (Server-Side PKCE Flow)

```
Browser              Netlify Functions         Supabase           Google
───────              ─────────────────         ────────           ──────
1. Click "Sign in"
   → navigate to
   /api/auth/login

                     2. Generate PKCE pair:
                        verifier (secret)
                        challenge (hash)
                        Store verifier in
                        httpOnly cookie
                        → Redirect to Supabase
                        with challenge

                                               3. Redirect to
                                                  Google with
                                                  challenge
                                                                 4. User
                                                                    consents

                                               5. Google sends
                                                  code back
                                                  Supabase redirects
                                                  to /api/auth/callback
                                                  with ?code=xxx

                     6. Read verifier from cookie
                        POST to Supabase:
                        { code, verifier }
                        (server-to-server!)

                                               7. Verify:
                                                  SHA256(verifier)
                                                  == challenge?
                                                  ✓ Return tokens

                     8. Encrypt tokens with
                        AES-256-GCM
                        Set httpOnly cookie
                        → Redirect to /dashboard

9. Page loads
   fetch /api/auth/session
   (cookie sent automatically)

                     10. Decrypt cookie
                         Check token expiry
                         Refresh if needed
                         → Return { user, accessToken }

11. Store accessToken
    in React state
    (memory only)
    Use for Supabase
    DB queries
```

## Files and What They Do

### Server-Side (Netlify Functions)

| File | Endpoint | Purpose |
|------|----------|---------|
| `netlify/functions/_utils/cookies.mjs` | — | AES-256-GCM encryption, cookie parsing/building |
| `netlify/functions/auth-login.mjs` | `/api/auth/login` | Generates PKCE pair, sets verifier cookie, redirects to Google |
| `netlify/functions/auth-callback.mjs` | `/api/auth/callback` | Exchanges code+verifier for tokens, encrypts into session cookie |
| `netlify/functions/auth-session.mjs` | `/api/auth/session` | Validates cookie, refreshes if expired, returns user+accessToken |
| `netlify/functions/auth-logout.mjs` | `/api/auth/logout` | Revokes session with Supabase, clears cookie |

### Client-Side (React)

| File | What Changed |
|------|-------------|
| `src/lib/api.js` | **NEW** — Fetch wrapper for `/api/auth/*` endpoints |
| `src/lib/supabase.js` | Auth disabled. Client-side auth features turned off. Token set manually via `setAccessToken()` |
| `src/hooks/useAuth.js` | Rewritten. Calls `/api/auth/session` instead of `supabase.auth.getSession()`. Stores access token in React state, not localStorage |
| `src/pages/Landing.jsx` | Simplified. Google button navigates to `/api/auth/login` instead of calling SDK |
| `netlify.toml` | Added `/api/*` redirects to route to Netlify Functions |

## Security Comparison

| Aspect | Before (Implicit) | After (Server PKCE) |
|--------|-------------------|---------------------|
| Token storage | localStorage (JS-accessible) | httpOnly cookie (JS-proof) |
| XSS token theft | Attacker gets long-lived refresh token | Attacker gets 1-hour access token from React state only |
| Token in URL | Yes (#access_token in hash) | Never (code exchange is server-to-server) |
| CSRF protection | None needed (no cookies) | SameSite=Lax on cookie |
| Cookie tampering | N/A | AES-256-GCM encryption prevents reading or modification |
| Session revocation | Client-side only | Server-side (Supabase + cookie clear) |
| Multi-tab sync | Navigator LockManager (buggy) | Not needed — each tab calls /api/auth/session |

## New Environment Variables

Set these in **Netlify → Site settings → Environment variables**:

| Variable | Where | Purpose |
|----------|-------|---------|
| `VITE_SUPABASE_URL` | Build time | Bundled into JS for DB queries |
| `VITE_SUPABASE_ANON_KEY` | Build time | Bundled into JS for DB queries |
| `SUPABASE_URL` | Runtime (functions) | Used by Netlify Functions to call Supabase |
| `SUPABASE_ANON_KEY` | Runtime (functions) | Used by Netlify Functions for token exchange |
| `COOKIE_SECRET` | Runtime (functions) | 32+ char random string for AES-256-GCM encryption |
| `SITE_URL` | Runtime (functions) | Your app URL (https://osps.clementlsw.com) |

Generate `COOKIE_SECRET` with:
```bash
openssl rand -base64 48
```

## Key Concepts Demonstrated

1. **PKCE (Proof Key for Code Exchange)** — The code_verifier/code_challenge mechanism that prevents auth code interception
2. **httpOnly Cookies** — Browser storage that JavaScript cannot access
3. **AES-256-GCM Encryption** — Authenticated encryption for cookie contents
4. **Token Relay Pattern** — Long-lived refresh token stays server-side, short-lived access token given to client
5. **BFF (Backend for Frontend)** — Netlify Functions act as a secure middleware layer between browser and auth provider
6. **Key Derivation (scrypt)** — Stretching a password/secret into a fixed-length encryption key
