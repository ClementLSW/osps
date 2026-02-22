<div align="center">

# O$P$

### Owe Money, Pay Money.

Expense splitting for friends who keep score.

**[osps.clementlsw.com](https://osps.clementlsw.com)**

![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Status](https://img.shields.io/badge/status-active-brightgreen?style=flat-square)
![Netlify](https://img.shields.io/badge/netlify-deployed-00C7B7?style=flat-square&logo=netlify&logoColor=white)

---

**Frontend**

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)

**Backend**

![Supabase](https://img.shields.io/badge/Supabase-Postgres-3FCF8E?style=flat-square&logo=supabase&logoColor=white)
![Netlify Functions](https://img.shields.io/badge/Netlify-Functions-00C7B7?style=flat-square&logo=netlify&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18-339933?style=flat-square&logo=node.js&logoColor=white)

**Services**

![Resend](https://img.shields.io/badge/Resend-SMTP-000000?style=flat-square)
![OpenRouter](https://img.shields.io/badge/OpenRouter-Vision_AI-6366F1?style=flat-square)
![Google OAuth](https://img.shields.io/badge/Google-OAuth_2.0-4285F4?style=flat-square&logo=google&logoColor=white)

</div>

---

## What is O$P$?

O$P$ (Owe Money, Pay Money) is a free, open-source expense splitting app built for friend groups. Create a group, add expenses, and let the app figure out who owes whom — with the minimum number of payments to settle up.

The name is a nod to Singapore's infamous loan shark graffiti — except instead of threatening your neighbours, you're chasing your friend for $4.50 of roti prata.

## Features

### 🔐 Server-Side Authentication
Full PKCE OAuth flow with Google, plus email/password sign-up. Auth tokens are encrypted with AES-256-GCM and stored in httpOnly cookies — no tokens in localStorage, no tokens in JavaScript. Includes email confirmation, password reset, and auto-profile creation.

### 👥 Groups & Invites
Create groups for ongoing expenses (roommates, couples) or time-bound events (trips, dinners). Invite members by email (existing users added instantly, new users get an invite email) or share a link. Admin/member roles with group settings panel — rename, change currency, mark as settled, or delete.

### 💰 5 Ways to Split
- **Equal** — Total ÷ number of people
- **Exact** — Manually assign per person
- **Percentage** — Each person pays X%
- **Shares** — Weighted split (e.g., 2 shares vs 1 share)
- **Line Item** — Assign receipt items to people; tax/tip distributed proportionally

### 📷 Receipt Scanning (OCR)
Take a photo or upload a screenshot of any receipt — restaurant bills, GrabFood orders, supermarket runs. AI-powered vision model extracts the merchant name, line items, and total, then auto-populates the expense form. Tax, service charges, delivery fees, and discounts are distributed proportionally. Receipt images stored in Supabase Storage for later reference. Powered by OpenRouter (Gemini Flash / Qwen3 VL).

### ⚖️ Automatic Debt Simplification
A greedy reconciliation algorithm computes the minimum set of payments to settle all debts. For N people, it produces at most N-1 transactions. Record payments directly from the settle-up cards with two-tap confirmation.

### 📧 Transactional Emails
Branded email templates via Resend for account confirmation, password reset, and group invitations. Custom SMTP ensures reliable delivery.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Browser                          │
│  React 18 + Vite 5 + TailwindCSS 3                  │
│  No auth tokens — only httpOnly cookies              │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌───────────────┐          ┌────────────────────┐
│   Netlify     │          │    Supabase        │
│   Functions   │          │                    │
│   (Node.js)   │          │  ┌──────────────┐  │
│               │          │  │   Postgres   │  │
│  • OAuth      │ server   │  │   + RLS      │  │
│    (PKCE)     │ to       │  └──────────────┘  │
│  • Session    │ server   │  ┌──────────────┐  │
│    mgmt       ├─────────►│  │   Auth       │  │
│  • Email      │          │  │  (GoTrue)    │  │
│    auth       │          │  └──────────────┘  │
│  • Receipt    │          │  ┌──────────────┐  │
│    OCR        │          │  │   Storage    │  │
│               │          │  │  (receipts)  │  │
└───────┬───────┘          │  └──────────────┘  │
        │                  └────────────────────┘
        │
        ▼
┌───────────────┐
│  OpenRouter   │
│  Gemini Flash │
│  / Qwen3 VL  │
└───────────────┘
```

### Security Model

| Layer | Protection |
|-------|-----------|
| Auth tokens | AES-256-GCM encrypted, httpOnly cookies |
| PKCE OAuth | Code verifier never leaves the server |
| Database | Row Level Security on every table |
| Passwords | bcrypt hashed by Supabase (never stored in plaintext) |
| API keys | Anon key is public (RLS enforces access); service key server-only |
| Transport | HTTPS everywhere; Secure + SameSite=Lax on cookies |
| Receipt images | Private Supabase Storage bucket; signed URLs for access |

### Database Schema

```
profiles            groups              group_members
├── id (PK)         ├── id (PK)         ├── group_id (PK)
├── display_name    ├── name            ├── user_id (PK)
├── avatar_url      ├── currency        └── role (admin/member)
└── created_at      ├── type/category
                    ├── invite_code     expenses
                    ├── is_settled      ├── id (PK)
                    └── start/end_date  ├── group_id → groups
                                        ├── paid_by → profiles
settlements         expense_splits      ├── title, total_amount
├── id (PK)         ├── id (PK)         ├── split_mode
├── group_id        ├── expense_id      ├── receipt_url
├── paid_by         ├── user_id         ├── notes
├── paid_to         └── owed_amount     └── expense_date
└── amount
                    line_items          line_item_assignments
pending_invites     ├── id (PK)         ├── line_item_id (PK)
├── email           ├── expense_id      ├── user_id (PK)
├── group_id        ├── name, amount    └── share_count
└── invited_by      └── quantity
```

### Netlify Functions

| Endpoint | Purpose |
|----------|---------|
| `/api/auth/login` | PKCE initiation → Google redirect |
| `/api/auth/callback` | OAuth code+verifier exchange → cookie |
| `/api/auth/session` | Validate/refresh session → return user+token |
| `/api/auth/logout` | Revoke + clear cookie |
| `/api/auth/signup` | Email/password registration |
| `/api/auth/signin` | Email/password login |
| `/api/auth/set-session` | Email confirm/reset token → cookie |
| `/api/auth/reset-request` | Send password reset email |
| `/api/auth/update-password` | Set new password with active session |
| `/api/auth/invite` | Smart invite (existing → direct add, new → email) |
| `/api/auth/claim-invites` | Auto-join groups after signup |
| `/api/parse-receipt` | Receipt image → OpenRouter OCR → structured JSON |

## Roadmap

- [x] Server-side PKCE OAuth (Google)
- [x] Email/password authentication
- [x] Email confirmation + password reset
- [x] Encrypted httpOnly session cookies
- [x] Custom SMTP email delivery (Resend)
- [x] Branded transactional email templates
- [x] Groups with categories, currency, and date ranges
- [x] Group settings (rename, currency, settle, delete)
- [x] Invite by email + invite links
- [x] 5 split modes with rounding correction
- [x] Greedy debt simplification algorithm
- [x] Settle-up recording with confirmation
- [x] Expense editing with full split mode pre-population
- [x] Expense deletion with receipt cleanup
- [x] Expandable expense cards with split breakdown
- [x] Receipt OCR scanning (OpenRouter + Gemini/Qwen)
- [x] Receipt image storage (Supabase Storage)
- [x] Row Level Security across all tables
- [x] Mobile touch target + iOS zoom fixes
- [ ] Daily checkpoint / expense confirmation
- [ ] Multi-currency support
- [ ] Recurring expenses
- [ ] Export group summary as PDF
- [ ] Push notifications / reminders
- [ ] Realtime live updates

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- A [Netlify](https://netlify.com) account
- A [Google Cloud](https://console.cloud.google.com) project (for OAuth)
- A [Resend](https://resend.com) account (for transactional emails)
- An [OpenRouter](https://openrouter.ai) account (for receipt OCR)

### Setup

```bash
git clone https://github.com/ClementLSW/osps.git
cd osps
npm install
```

Create a `.env` file:

```bash
# Client-side (bundled into JS)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...

# Server-side (Netlify Functions only)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
COOKIE_SECRET=your-32-char-minimum-random-string
SITE_URL=http://localhost:5173
OPENROUTER_API_KEY=sk-or-v1-...
```

Generate `COOKIE_SECRET`:

```bash
openssl rand -base64 48
```

Run the database schema in Supabase SQL Editor:

```
supabase/migrations/schema.sql
```

Start the dev server:

```bash
npm run dev
```

### Supabase Configuration

1. **Authentication → Providers** — Enable Google OAuth
2. **Authentication → URL Configuration** — Add your site URL + `/auth/confirm` to Redirect URLs
3. **Authentication → Email Templates** — Customize with O$P$ branding
4. **Storage → New bucket** — Create `receipts` (private, 10MB limit, JPEG/PNG/WebP)
5. **Storage → Policies** — Add authenticated CRUD policy scoped to `receipts` bucket:
   ```sql
   bucket_id = 'receipts' AND auth.role() = 'authenticated'
   ```

### Netlify Configuration

1. **Environment variables** — Add all variables from `.env` above
2. **Build settings** — Command: `npm run build`, Publish: `dist`, Functions: `netlify/functions`

### Google Cloud Configuration

1. **OAuth consent screen** — Set app name to O$P$
2. **Credentials → OAuth 2.0 Client** — Add authorized origins (localhost + production) and redirect URI (Supabase callback URL)

## Project Structure

```
├── index.html                          # SPA entry point
├── netlify.toml                        # Build config + API redirects
├── netlify/functions/
│   ├── _utils/cookies.mjs              # AES-256-GCM encryption
│   ├── auth-*.mjs                      # Auth endpoints (11 functions)
│   └── parse-receipt.mjs               # OCR via OpenRouter
├── src/
│   ├── App.jsx                         # Router + AuthProvider
│   ├── index.css                       # Tailwind + component classes
│   ├── components/
│   │   ├── auth/AuthGuard.jsx          # Route protection
│   │   ├── ConfirmDialog.jsx           # Reusable delete confirmation
│   │   └── groups/
│   │       ├── InviteModal.jsx         # Email + link invite
│   │       └── GroupSettingsPanel.jsx   # Group management
│   ├── hooks/
│   │   ├── useAuth.jsx                 # Auth context + session
│   │   ├── useBalances.js              # Reconciliation hook
│   │   └── useScrollLock.js            # Modal body scroll lock
│   ├── lib/
│   │   ├── api.js                      # Auth API wrappers
│   │   ├── formatCurrency.js           # Intl.NumberFormat
│   │   ├── formatDate.js               # Relative date labels
│   │   ├── reconcile.js               # Debt simplification
│   │   ├── splitCalculators.js         # 5 split mode engines
│   │   └── supabase.js                 # Client (auth disabled)
│   └── pages/
│       ├── Landing.jsx                 # Google + email auth
│       ├── Dashboard.jsx               # Group list
│       ├── CreateGroup.jsx             # Two-step creation
│       ├── GroupDetail.jsx             # Expenses, balances, settle-up
│       ├── AddExpense.jsx              # Split modes, OCR, edit
│       ├── JoinGroup.jsx               # Invite link handler
│       ├── AuthConfirm.jsx             # Email redirect handler
│       ├── ForgotPassword.jsx          # Reset email request
│       └── ResetPassword.jsx           # New password form
└── supabase/migrations/
    └── schema.sql                      # Complete database schema
```

## License

MIT — free to use, fork, modify, and share.

<div align="center">
<br>
<sub>Built by <a href="https://clementlsw.com">Clement Leow</a> in Singapore 🇸🇬</sub>
</div>