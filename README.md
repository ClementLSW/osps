<div align="center">

# O$P$

### Owe Money, Pay Money.

Expense splitting for friends who keep score.

**[osps.clementlsw.com](https://osps.clementlsw.com)**

![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Status](https://img.shields.io/badge/status-active-brightgreen?style=flat-square)
![Netlify](https://img.shields.io/badge/netlify-deployed-00C7B7?style=flat-square&logo=netlify&logoColor=white)

---

![React](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-5-646CFF?style=flat-square&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/Tailwind-3-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white)
![Supabase](https://img.shields.io/badge/Supabase-Postgres-3FCF8E?style=flat-square&logo=supabase&logoColor=white)
![Netlify Functions](https://img.shields.io/badge/Netlify-Functions-00C7B7?style=flat-square&logo=netlify&logoColor=white)
![Resend](https://img.shields.io/badge/Resend-SMTP-000000?style=flat-square)

</div>

---

## What is O$P$?

O$P$ (Owe Money, Pay Money) is a free, open-source expense splitting app built for friend groups. Create a group, add expenses, and let the app figure out who owes whom — with the minimum number of payments to settle up.

The name is a nod to Singapore's infamous loan shark graffiti — except instead of threatening your neighbours, you're chasing your friend for $4.50 of roti prata.

## Features

### 🔐 Server-Side Authentication
Full PKCE OAuth flow with Google, plus email/password sign-up. Auth tokens are encrypted with AES-256-GCM and stored in httpOnly cookies — no tokens in localStorage, no tokens in JavaScript. The browser never sees your credentials.

### 👥 Groups & Invites
Create groups for ongoing expenses (roommates, couples) or time-bound events (trips, dinners). Share an invite link — anyone with the link can join after signing in. Groups support admin/member roles.

### 💰 5 Ways to Split
- **Equal** — Total ÷ number of people
- **Exact** — Manually assign per person
- **Percentage** — Each person pays X%
- **Shares** — Weighted split (e.g., 2 shares vs 1 share)
- **Line Item** — Assign receipt items to people; tax/tip distributed proportionally

### ⚖️ Automatic Debt Simplification
A greedy reconciliation algorithm computes the minimum set of payments to settle all debts. For N people, it produces at most N-1 transactions. No more "you pay me, I pay her, she pays you" chains.

### 📅 Trip Mode with Daily Checkpoints
Groups can have start/end dates. Time-bound groups get daily expense summaries so everyone confirms charges while memory is fresh — no more arguments at settlement time.

### 📧 Transactional Emails
Branded email templates via Resend for account confirmation, password reset, and invitations. Custom SMTP ensures reliable delivery.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Browser                          │
│  React + Vite + TailwindCSS                          │
│  No auth tokens — only httpOnly cookies              │
└──────────────────────┬──────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌───────────────┐          ┌────────────────────┐
│   Netlify     │          │    Supabase        │
│   Functions   │          │                    │
│               │          │  ┌──────────────┐  │
│  • OAuth      │ server   │  │   Postgres   │  │
│    (PKCE)     │ to       │  │   + RLS      │  │
│  • Session    │ server   │  └──────────────┘  │
│    mgmt       ├─────────►│  ┌──────────────┐  │
│  • Email      │          │  │   Auth       │  │
│    auth       │          │  │  (GoTrue)    │  │
│  • Token      │          │  └──────────────┘  │
│    refresh    │          │  ┌──────────────┐  │
│               │          │  │   Realtime   │  │
└───────────────┘          │  └──────────────┘  │
                           └────────────────────┘
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

## Roadmap

- [x] Server-side PKCE OAuth (Google)
- [x] Email/password authentication
- [x] Encrypted httpOnly session cookies
- [x] Custom SMTP email delivery (Resend)
- [x] Branded transactional email templates
- [x] Groups with categories, currency, and date ranges
- [x] Invite links for group joining
- [x] 5 split modes with rounding correction
- [x] Greedy debt simplification algorithm
- [x] Row Level Security across all tables
- [ ] Daily checkpoint / expense confirmation
- [ ] Settle-up recording ("mark as paid")
- [ ] Password reset flow
- [ ] OCR receipt parsing (auto-populate line items)
- [ ] Multi-currency support
- [ ] Recurring expenses
- [ ] Export group summary as PDF
- [ ] Push notifications / reminders

## Getting Started

```bash
git clone https://github.com/ClementLSW/osps.git
cd osps
npm install
cp .env.example .env    # fill in your Supabase credentials
npm run dev             # http://localhost:5173
```

See [docs/SERVER_AUTH_ARCHITECTURE.md](docs/SERVER_AUTH_ARCHITECTURE.md) for a detailed breakdown of the auth system.

## License

MIT — free to use, fork, modify, and share.

<div align="center">
<br>
<sub>Built by <a href="https://clementlsw.com">Clement Leow</a> in Singapore 🇸🇬</sub>
</div>