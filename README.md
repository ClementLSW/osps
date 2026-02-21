# O$P$ — Owe Money, Pay Money

> Expense splitting for friends who keep score.

![License](https://img.shields.io/badge/license-MIT-green)

## What is this?

O$P$ is a free, open-source expense splitting app. Create a group, add expenses, and let the app figure out who owes whom — with the minimum number of payments to settle up.

Supports five split modes: **equal**, **exact amounts**, **percentage**, **shares**, and **line items**.

## Tech Stack

- **Frontend:** React + Vite + TailwindCSS
- **Backend:** Supabase (Auth, Postgres, Realtime, Edge Functions)
- **Hosting:** Netlify
- **Auth:** Supabase Auth (Google OAuth + email/password)

## Getting Started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)
- A [Netlify](https://netlify.com) account (optional, for deployment)

### 1. Clone & install

```bash
git clone https://github.com/YOUR_USERNAME/osps.git
cd osps
npm install
```

### 2. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase/migrations/001_initial_schema.sql`
3. Enable **Google OAuth** in Authentication → Providers (optional)
4. Copy your project URL and anon key from Settings → API

### 3. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 4. Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

### 5. Deploy to Netlify

```bash
# Option A: Netlify CLI
npm install -g netlify-cli
netlify deploy --prod

# Option B: Connect your Git repo in Netlify dashboard
# Build command: npm run build
# Publish directory: dist
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Netlify → Site settings → Environment variables.

## Project Structure

```
osps/
├── src/
│   ├── components/     # UI components by feature
│   ├── hooks/          # React hooks (auth, data, balances)
│   ├── lib/            # Core logic (supabase client, split math, reconciliation)
│   ├── pages/          # Route-level page components
│   └── main.jsx        # App entry point
├── supabase/
│   └── migrations/     # SQL schema + RLS policies
├── netlify.toml        # Netlify deploy config
└── package.json
```

## Split Modes

| Mode | Description |
|------|-------------|
| **Equal** | Total ÷ number of people |
| **Exact** | Manually enter amount per person |
| **Percentage** | Each person pays X% |
| **Shares** | Weighted split (e.g., 2 shares vs 1 share) |
| **Line Item** | Assign receipt items to people; tax/tip distributed proportionally |

## Reconciliation

O$P$ uses a greedy debt simplification algorithm to minimize the number of payments needed to settle a group. For N people, it produces at most N-1 transactions.

## Roadmap

- [x] Auth (Google OAuth + email)
- [x] Groups with invite links
- [x] All 5 split modes
- [x] Debt simplification
- [ ] OCR receipt parsing (auto-populate line items)
- [ ] Multi-currency support
- [ ] Recurring expenses
- [ ] Export to PDF
- [ ] Push notifications / reminders

## Contributing

PRs welcome! This is a FOSS project — feel free to fork, modify, and share.

## License

MIT
