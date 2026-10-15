# Project status — first integrated local-first build

## Implemented
- Transaction create/edit/archive, search/filter, tags, exclusion toggle, category split validation, transfer source/destination, partner-paid expenses, reimbursements.
- IndexedDB ledger entry generation for account movements and a local account-balance view.
- Operational CRUD for accounts, categories, budgets, assets, valuation history, liabilities/receivables, goals, and recurring schedules.
- Due-schedule processing into actual transactions, budget threshold alerts and due-date notifications while app is open.
- Reports, refund offsets by category, six-month average-based forecast, high-amount review heuristic, privacy masking.
- CSV/XLSX import preview, validation and duplicate review; CSV/XLSX export.
- Local JSON backup/restore, audit log for transaction and generic module changes, PIN gate, login/register endpoints, versioned cloud snapshots and explicit conflict choices.
- PWA manifest and service worker route caching.

## Deliberately deferred
- OCR receipt scanning.

## Still needs deployment/verification or deeper hardening
- Dependencies/build/tests could not be verified in this environment because `npm install` timed out; run `bun install`, `bun run db:push`, `bun run build`, and acceptance tests locally.
- Cloud sync is manual snapshot sync, not automatic background sync and not yet normalized row-by-row synchronization to PostgreSQL transaction/ledger tables.
- The login/register API requires PostgreSQL, migrations, and a strong `SESSION_SECRET`; add rate limiting, password reset, email verification, and production security review before public deployment.
- Local PIN is a convenience gate only. JSON backup is not encrypted.
- Browser notifications are not guaranteed when the browser/app is closed.
- Legacy transfers without a destination account are skipped by automatic ledger backfill until edited.
- Valuation history does not automatically update the current asset value.
- Forecast/anomaly checks are simple heuristics; validate accounting edge cases (especially credit cards, debt/receivable repayments, refunds, and asset purchases) with a proper acceptance-test suite.

## Access control update
- Added root `middleware.ts` to require a valid signed `finwise_session` JWT for all application pages and API routes, excluding only login, registration, and logout endpoints plus Next.js/static assets.
- Unauthenticated page requests redirect to `/login`; unauthenticated API requests receive HTTP 401. Expired or invalid JWTs are rejected.
- Login screen no longer renders the authenticated app shell/sidebar.
- Updated service worker to avoid caching HTML navigations and API responses, preventing stale cached pages from bypassing the login redirect. Static assets only are cached.
- Runtime verification is still required with a configured `SESSION_SECRET` and PostgreSQL; this environment does not have dependencies installed.
