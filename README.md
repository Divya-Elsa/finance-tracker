# Finance Tracker

A personal finance tracker: log income/expenses, see spending reports, and get rule-based
suggestions for better budgeting.

- `backend/` — Express + TypeScript API, Prisma ORM, Postgres
- `frontend/` — React + Vite + TypeScript, TanStack Query, Recharts

## Local setup

### 1. Database (Supabase Postgres)

1. Create a free project at [supabase.com](https://supabase.com).
2. Click **Connect** on the project dashboard and copy the **Session pooler** URI (NOT
   "Direct connection" — that host is IPv6-only and unreachable on most networks/hosts;
   NOT "Transaction pooler" on port 6543 either — `prisma migrate` needs session-level
   advisory locks that transaction-mode pooling doesn't support and it will hang). The
   session pooler URI uses port **5432** on a `*.pooler.supabase.com` host and a username
   like `postgres.<project-ref>`.
3. Append `?sslmode=require` to the connection string — Supabase requires SSL, and
   without this flag some clients fail with a misleading "password authentication failed"
   error instead of a clear SSL error.

### 2. Backend

```bash
cd backend
cp .env.example .env
# edit .env: paste your Supabase DATABASE_URL, set a random JWT_SECRET
npm install
npm run prisma:migrate   # creates tables in your Supabase database
npm run dev              # http://localhost:4000
```

### 3. Frontend

```bash
cd frontend
cp .env.example .env    # VITE_API_URL defaults to http://localhost:4000
npm install
npm run dev              # http://localhost:5173
```

Open http://localhost:5173, sign up with an email/password, and start adding transactions.
A default set of categories (Salary, Groceries, Rent, Dining, etc.) is created automatically
on signup.

## Deploying

### Backend → Render

1. Push this repo to GitHub.
2. In Render, "New Web Service" → connect the repo → it will detect `backend/render.yaml`.
3. Set the env vars Render prompts for: `DATABASE_URL` (Supabase), `JWT_SECRET` (any long
   random string), `CORS_ORIGIN` (your Vercel frontend URL, added after step below).
4. Render runs `prisma migrate deploy` on start, so your Supabase schema stays in sync.

### Frontend → Vercel

1. In Vercel, "Add New Project" → import the repo → set **Root Directory** to `frontend`.
2. Vercel auto-detects `vercel.json`. Add env var `VITE_API_URL` = your Render backend URL.
3. Deploy, then go back to Render and set `CORS_ORIGIN` to the resulting Vercel URL.

## How the insights work

`backend/src/lib/insights.ts` computes plain rule-based findings from your transactions and
budgets each month — no external AI calls:

- Savings rate vs a 20% target
- Categories that went over their budget
- Categories up more than 25% month-over-month
- Top 3 spending categories
- Largest single expense
