# Finwise — Personal Finance System

Local-first personal finance app built from the agreed specification. OCR is intentionally deferred.

## Stack
- Next.js App Router + React + TypeScript
- Bun package manager
- PostgreSQL + Drizzle ORM
- Dexie / IndexedDB local-first database
- PWA service worker, CSV/XLSX import-export, Lucide, Sonner

## Implemented in this build
- Transaction CRUD, soft delete, search/filter, tags, exclusion from reports, category split validation, transfer source/destination, partner-paid expenses and reimbursement payment tracking.
- IndexedDB ledger entries generated for income, expense, transfer, refund, asset purchase, debt payment, receivable payment, and reimbursement payments. Transfers post two equal-and-opposite account movements. Existing legacy transfers without a destination are skipped by ledger migration until edited.
- CRUD screens for accounts, categories, budgets, assets, valuation history, debts/receivables, goals, and recurring schedules.
- Budget progress and 75/90/100% browser alerts while the app is open and browser notification permission is granted.
- Manual processing of due recurring schedules into actual transactions, plus browser reminders while the app is open.
- Reports by category, refunds reducing the original expense category, a six-month estimate based on the recent three-month average, and simple high-amount review flags.
- CSV and Excel import with preview, validation, probable duplicate detection, and duplicate rows excluded by default; CSV and Excel export.
- Local JSON backup/restore, audit events for transaction and module-record changes, privacy masking for dashboard/reports, local PIN gate, login/register API, and cloud snapshot sync with version checks and manual conflict choices.
- PWA manifest/service worker caching for main app routes.

## Important boundaries
- **OCR is not included yet.**
- Install/build could not be verified in this environment because dependency installation timed out. Run the setup and build checks locally before relying on the app.
- Cloud sync stores a versioned JSON snapshot in PostgreSQL, not yet normalized cloud transaction/ledger rows. Sync is manual, not background automatic; conflicts are surfaced for explicit user choice.
- PIN is a local convenience gate, not a substitute for account authentication or device encryption. The JSON backup is not encrypted; store it securely.
- Browser reminders only fire while the app is running/open and notification permission is granted. They are not guaranteed background alarms.
- Debt payment principal/interest split is represented in local transaction metadata and reporting; production accounting still needs acceptance tests for edge cases.
- Valuation history is recorded separately from the current asset record; the user should update current value manually.
- The forecast and anomaly review are estimates/heuristics, not financial advice.
- This is an actively developed first release. Verify calculations with test cases and keep an independent backup before using as the sole financial record.

## Requirements
- Bun 1.1+
- PostgreSQL (Neon, Supabase PostgreSQL, or self-hosted)

## Setup

```bash
bun install
cp .env.example .env.local
# Set DATABASE_URL and SESSION_SECRET (at least 32 random characters)
bun run db:push
bun run dev
```

Open http://localhost:3000. For cloud sync, create an account at `/login` and then use **Pengaturan & Audit → Sinkronkan sekarang**.

## Database commands

```bash
bun run db:generate
bun run db:migrate
bun run db:studio
```

`db:push` is useful during local prototyping. For production, use reviewed migrations, backups, rate limiting, monitoring, and security review.

## Money conventions
- IDR amounts are positive integer rupiah in transaction forms.
- Account movements are signed ledger entries; balances equal opening balance plus ledger movements.
- Transfer requires different source and destination accounts and does not count as income/expense.
- Excluding a transaction affects reports, not its ledger/account movement.
- Partner-paid expenses remain spending, but do not reduce the user's account balance until the reimbursement payment is recorded.
- Debt principal is a cash movement but only interest/fees are treated as spending when those fields are present.
- Asset purchases are included in spending and the asset value is tracked separately for net-worth calculations.

## Authentication gate
All application pages and API routes are protected by `middleware.ts`. Without a valid `finwise_session` JWT, page visits redirect to `/login` and protected API requests return HTTP 401. Only `/login` and `/api/auth/login`, `/api/auth/register`, `/api/auth/logout` are public. Set `SESSION_SECRET` to a random secret of at least 32 characters and configure PostgreSQL before testing registration/login. The service worker deliberately does not cache HTML pages or API responses so offline cache cannot bypass the login gate.
