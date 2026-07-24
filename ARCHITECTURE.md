# Architecture

This document explains how the finance tracker actually works, end to end, for a developer
picking up the codebase. For setup/deploy instructions, see [README.md](README.md).

## Overview

A two-project app: a stateless Express API and a Vite/React SPA, talking over REST/JSON,
backed by a single Postgres database (Supabase). No server-side rendering, no shared code
between frontend and backend (types are duplicated by hand in `frontend/src/api/types.ts`
to mirror the Prisma models).

```
Browser (React SPA, Vercel)
   │  fetch + JWT Bearer token
   ▼
Express API (Render)
   │  Prisma Client
   ▼
Postgres (Supabase, via session pooler)
```

## Tech stack

| Layer | Choice | Why |
|---|---|---|
| Backend framework | Express + TypeScript | simple, unopinionated REST API |
| ORM | Prisma | typed schema, migrations, query builder |
| Database | Postgres (Supabase) | managed, free tier, real Postgres |
| Auth | JWT (jsonwebtoken) + bcryptjs | stateless, no session store needed |
| Validation | Zod | request body schemas on every mutating route |
| Frontend framework | React + Vite | fast dev loop, no SSR needed for a private app |
| Data fetching | TanStack Query | caching, invalidation, loading/error states |
| Routing | react-router-dom | client-side routing, protected routes |
| Charts | Recharts | category bar chart, income/expense trend line |

## Repo layout

```
backend/
  prisma/schema.prisma       data model (source of truth)
  prisma/migrations/         generated SQL migrations
  src/index.ts                Express app entrypoint, route mounting
  src/middleware/auth.ts       JWT verification middleware
  src/routes/                  one file per resource (auth, categories, transactions, budgets, reports)
  src/lib/prisma.ts             Prisma client singleton
  src/lib/serialize.ts          Decimal → number conversion for API responses
  src/lib/date.ts                month-key helpers (monthRange, previousMonthKey, lastNMonthKeys)
  src/lib/insights.ts             pure rule-based insight computation (no DB access)
  src/lib/categories.ts            default category seed list

frontend/
  src/api/client.ts             fetch wrapper + one function per endpoint
  src/api/types.ts               TypeScript types mirroring the API responses
  src/hooks/useAuth.tsx           auth context: holds JWT + current user, login/signup/logout
  src/components/                 shared UI (forms, charts, layout, route guard)
  src/pages/                      one component per route (Dashboard, Transactions, Budgets, Reports, Login, Signup)
  src/App.tsx                     route table
```

## Data model

Four tables, all scoped to a `User` (see `backend/prisma/schema.prisma`):

- **User** — `id`, `email` (unique), `passwordHash`. No profile fields; this is a single-tenant-per-account app.
- **Category** — `id`, `userId`, `name`, `type` (`income`|`expense`), `isDefault`. Unique on `(userId, name)`. A fixed set of 11 default categories (`src/lib/categories.ts`) is created transactionally alongside the user at signup.
- **Transaction** — `id`, `userId`, `categoryId`, `amount` (`Decimal(12,2)`), `type`, `date`, `description?`. Indexed on `(userId, date)` since every query filters/sorts by date within a user.
- **Budget** — `id`, `userId`, `categoryId`, `monthlyLimit` (`Decimal(12,2)`). Unique on `(userId, categoryId)` — one budget row per category, applied every month (there's no per-month budget history; changing a limit changes it for all months, past and future).

There is no cross-user data ever exposed — every query in every route is filtered by
`req.userId` (set by the auth middleware), and `categoryId`/`transaction id` ownership is
re-checked server-side before any mutation, not trusted from the client.

## Auth flow

1. `POST /api/auth/signup` — Zod-validates `{email, password}` (password ≥ 8 chars), hashes
   the password with bcrypt (cost 10), creates the `User` + the 11 default `Category` rows
   in one `prisma.$transaction`, signs a JWT (`{userId}`, 7-day expiry, `JWT_SECRET`), returns
   `{token, user}`.
2. `POST /api/auth/login` — looks up by email, `bcrypt.compare`, signs and returns a token the
   same way.
3. The frontend stores the token in `localStorage` (`src/hooks/useAuth.tsx`) and attaches it
   as `Authorization: Bearer <token>` on every request (`src/api/client.ts`).
4. `backend/src/middleware/auth.ts` (`requireAuth`) verifies the token on every route except
   `/api/auth/*`, and sets `req.userId`. It's mounted per-router in `index.ts`:
   ```ts
   app.use("/api/categories", requireAuth, categoriesRouter);
   app.use("/api/transactions", requireAuth, transactionsRouter);
   app.use("/api/budgets", requireAuth, budgetsRouter);
   app.use("/api/reports", requireAuth, reportsRouter);
   ```
5. On app load, `AuthProvider` calls `GET /api/auth/me` with whatever token is in
   `localStorage`; if it 401s, the token is cleared and the user is treated as logged out.
   `ProtectedRoute` redirects to `/login` while this resolves.

There's no refresh-token flow — when the 7-day JWT expires, the user has to log in again.

## API reference

All routes except `/api/auth/*` require the `Authorization` header. Request/response bodies
are JSON.

| Method & path | Body | Notes |
|---|---|---|
| `POST /api/auth/signup` | `{email, password}` | seeds default categories |
| `POST /api/auth/login` | `{email, password}` | |
| `GET /api/auth/me` | — | |
| `GET /api/categories` | — | |
| `POST /api/categories` | `{name, type}` | |
| `PUT /api/categories/:id` | `{name?, type?}` | |
| `DELETE /api/categories/:id` | — | |
| `GET /api/transactions` | query: `month?, categoryId?, type?` | `month` is `YYYY-MM` |
| `POST /api/transactions` | `{categoryId, amount, type, date, description?}` | validates `categoryId` belongs to the caller |
| `PUT /api/transactions/:id` | any subset of the above | |
| `DELETE /api/transactions/:id` | — | |
| `GET /api/budgets` | — | |
| `PUT /api/budgets` | `{categoryId, monthlyLimit}` | **upsert** — one row per category, no separate create endpoint |
| `DELETE /api/budgets/:id` | — | |
| `GET /api/reports/summary` | query: `month?` (defaults to current) | totals, category breakdown, 6-month trend |
| `GET /api/reports/insights` | query: `month?` | see below |

### Why `Decimal` fields are explicitly serialized

Prisma's `Decimal` type (used for `amount` and `monthlyLimit`) serializes to JSON as a
**string**, not a number, because `Decimal` has a `toJSON()` that stringifies to avoid float
precision loss. Every route that returns a `Transaction` or `Budget` runs the result through
`serializeTransaction`/`serializeBudget` (`src/lib/serialize.ts`) to convert those fields to
real `number`s before sending — otherwise the frontend receives `"650"` instead of `650`,
which silently breaks `.toLocaleString()`/`.toFixed()` calls downstream. This was found and
fixed during initial verification; if you add a new route or field that returns Decimal data,
route it through the same serializer.

## Rule-based insights (`backend/src/lib/insights.ts`)

`computeInsights(currentMonth, previousMonth, budgets)` is a **pure function** — no DB or
network access — that takes plain transaction/budget arrays and returns a list of
`{message, severity}`. `routes/reports.ts` is the only caller; it fetches the current month's
transactions, the previous month's (for month-over-month comparison), and all budgets, then
hands them to this function. Rules, in order:

1. **Savings rate** — `(income - expense) / income`. Only computed if `income > 0`.
   `< 0` → critical ("spent more than you earned"). `< 20%` → warning. Otherwise → info.
2. **Over-budget categories** — for each `Budget`, compare that category's spend this month
   against `monthlyLimit`; over → critical, with the dollar and percent amount over.
3. **Month-over-month spend spikes** — per category, if spend is up more than 25% vs. the
   previous month (and the previous month wasn't zero) → warning.
4. **Top 3 spending categories** — by amount, with each one's share of total expense → info.
5. **Largest single expense** of the month → info.

To change thresholds, edit the two constants at the top of the file
(`SAVINGS_RATE_WARNING_THRESHOLD`, `MONTH_OVER_MONTH_INCREASE_THRESHOLD`). To add a new rule,
add another `insights.push(...)` block — it's plain array-building, no framework.

`routes/reports.ts` also serves `/summary`, which is a separate, simpler computation (totals,
per-category breakdown with percentages, and a 6-month trend built via `lastNMonthKeys` +
one `fetchMonthTransactions` call per month) — it doesn't share code with `computeInsights`
beyond both reading from the same `fetchMonthTransactions` helper.

## Frontend architecture

- **`src/api/client.ts`** is the only place that calls `fetch`. Every other component goes
  through the `api.*` functions it exports. It reads the JWT from `localStorage` on every
  call and throws `ApiError` (with the server's `{error}` message) on non-2xx responses.
- **TanStack Query** owns all server state — no Redux/Context for data, just `useQuery` per
  page and `useMutation` for writes, with `queryClient.invalidateQueries` in each mutation's
  `onSuccess` to refetch affected data (e.g. adding a transaction invalidates
  `["transactions"]`, `["summary"]`, and `["insights"]` — see `pages/Transactions.tsx`).
- **`useAuth()`** (React Context, `src/hooks/useAuth.tsx`) is the only piece of client-only
  state: the current user object and the login/signup/logout functions. The JWT itself lives
  in `localStorage`, not React state.
- **Routing** (`src/App.tsx`): `/login` and `/signup` are public; everything else is nested
  under `<ProtectedRoute>` (redirects to `/login` if `useAuth().user` is null) and `<Layout>`
  (nav bar + `<Outlet/>`).
- **Charts** (`components/CategoryBarChart.tsx`, `components/TrendLineChart.tsx`) are
  Recharts wrappers styled with CSS custom properties from `src/styles.css`
  (`--series-1`/`--series-2` etc.) so light/dark mode and chart colors stay in one place.

### A race condition worth knowing about (already fixed, but instructive)

`TransactionForm` needs a `categoryId` to submit, defaulted from the `categories` list passed
in as a prop. That list comes from a `useQuery` in `pages/Transactions.tsx` that resolves
asynchronously. Originally the form picked a default category only once, at mount — on
localhost (near-zero API latency) this almost always resolved before a user could interact,
but on the real Vercel→Render→Supabase network path, the form could render and become
"submittable" before categories had actually loaded, leaving `categoryId` stuck empty. Fixed
two ways (`pages/Transactions.tsx` + `components/TransactionForm.tsx`):
1. The page doesn't render `<TransactionForm>` at all until `categories.data` exists
   (shows "Loading categories…" instead).
2. The form also has a `useEffect` that re-syncs `categoryId` whenever the `categories` prop
   or `type` changes and the current `categoryId` is no longer valid.
The lesson: **don't assume localhost latency is representative — verify against the real
deployed network path**, especially for anything that depends on data being loaded before a
user can act on it.

## Deployment topology

| Piece | Host | Notes |
|---|---|---|
| Frontend | Vercel | `frontend/vercel.json`, root dir `frontend`, env `VITE_API_URL` |
| Backend | Render | `backend/render.yaml` (Blueprint), runs `prisma migrate deploy && npm start` on every deploy |
| Database | Supabase Postgres | see connection-string gotchas below |

Env vars:
- Backend: `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGIN` (must exactly match the deployed
  frontend origin, no trailing slash), `PORT` (Render provides/expects this — `render.yaml`
  pins it to 4000).
- Frontend: `VITE_API_URL` (the deployed backend's base URL).

### Supabase connection string gotchas

Three connection variants are offered in Supabase's "Connect" panel, and two of them don't
work for this app:
- **Direct connection** (`db.<ref>.supabase.co:5432`) — resolves to an **IPv6-only** address.
  Unreachable from networks/hosts without IPv6 (this was the case both for local dev here and
  is a common issue generally).
- **Transaction pooler** (`*.pooler.supabase.com:6543`) — IPv4-compatible, but pgbouncer
  transaction-mode pooling doesn't support the session-level advisory locks
  `prisma migrate deploy` takes out. Using it makes migrations **hang silently** (this is what
  caused the first Render deploy to fail with a port-scan timeout: the app never got past the
  migration step to start listening).
- **Session pooler** (`*.pooler.supabase.com:5432`) — the one that actually works for both
  migrations and the running app. Username is `postgres.<project-ref>`, not just `postgres`.

The working connection string shape is:
```
postgresql://postgres.<project-ref>:<password>@<pooler-host>:5432/postgres?sslmode=require
```
`?sslmode=require` matters too — Supabase requires SSL, and a client that doesn't request it
gets a misleading `password authentication failed` error instead of a clear SSL error, which
cost real debugging time.

The session pooler's free-tier pool is capped at **15 concurrent clients**. Running the local
dev backend and the deployed Render backend against it at the same time is normally fine, but
if you spin up extra scripts/connections against the same database (migrations, one-off
queries, another `prisma studio`), you can hit `EMAXCONNSESSION`. Stop unneeded local
processes if that happens.
