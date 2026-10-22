# SayaSync

App URL: [saya-sync-team-14.vercel.app](https://saya-sync-team-14.vercel.app). Deployment repository: `AI-Ocean-UXMM-2026/Team-14`, production branch `staging`.

Next.js + Supabase + Netlify foundation for part-time teacher management. The fictional local demo works without external credentials. Authenticated capture, correction and verification interfaces are implemented; payroll/payment transactions and screens are implemented; hosted integration remains under development. This is not a production payroll system.

## Local development

Requires Node.js 24 and npm 11 (versions used here). Use the existing checkout; a separate Git worktree is unnecessary.

```sh
cd /workspace/part-time-teacher-management
npm ci --cache /workspace/.npm-cache
npm run dev
```

Open `/` or `/demo` on the local server's port 3000. Demo records are fictional and persist in this browser until Reset demo data is used. Demo role selection grants no real application access. `/login` always displays the form and reports missing connection settings on submission. Password recovery is available at `/forgot-password` and `/reset-password`; see [recovery setup](docs/PASSWORD_RECOVERY.md).

```sh
npm test
npm run typecheck
npm run test:e2e # Uses system Chromium; set CHROMIUM_PATH if needed
npm run build
npm start
```

`npm test` includes exact-money unit tests and PostgreSQL-engine migration/RLS/capture tests using PGlite. For simultaneous-connection checks, run `npm run test:postgres` with Docker available. It creates a disposable PostgreSQL 17 container from a pinned image digest, publishes no ports, disables container networking, uses fictional data, and removes its container afterward. No real database credentials are needed. These tests do not replace hosted Supabase Auth/integration tests.

## Development Supabase

Copy `.env.example` to ignored `.env.local` and supply a **development** project URL and publishable key through secure configuration. Do not include a service-role key. Apply `supabase/migrations/*.sql` in timestamp order to a new development project after review. The migrations include capture, review, exception, allocation-lock and Admin-entry functions. The migrations require Supabase `auth.users`, `auth.uid()`, `anon`, and `authenticated`; the local tests supply an isolated compatibility shim.

Disable public registration in the Supabase dashboard. The initial Admin membership must be bootstrapped by the project owner with trusted administrative tooling. No public signup, role selector or seed account is provided for real authentication. Password recovery and authenticated workspace session refresh are implemented. Invitations and account administration use Supabase administration. Never connect preview deployments to production data.

The authenticated `/workspace` loads the latest 50 sessions plus open sessions for up to 100 pilot teachers and exposes operations permitted for the active membership: Teacher check-in/out and correction requests; Admin completed entry, correction decisions, exception resolution and session verification. It shows original/effective times and review history, and disables changes on allocated sessions. All mutation permissions are checked again in PostgreSQL. Errors retain form input; retries use the same key. Browser inputs are explicitly converted from Asia/Yangon rather than device timezone. Hosted validation is still pending.

See [implementation plan](docs/IMPLEMENTATION_PLAN.md) for decisions, ERD, permissions, route map, outstanding work, and release gates. Netlify configuration is prepared; deployed-site status must be checked in Netlify.

## Payroll increment

See [payroll workflow](docs/PAYROLL_WORKFLOW.md). If the first four migrations are already applied, run **only** `supabase/migrations/202610220005_payroll.sql` in the development project’s SQL Editor as postgres. Do not rerun the original combined setup. This increment is locally validated but has not been applied or verified against hosted authenticated users by the agent.

## Uploaded prototype increment

See [prototype alignment and migration 006 instructions](docs/PROTOTYPE_ALIGNMENT.md). The original uploaded blue design and demonstration model are now incorporated. On an existing database with 001–005 installed, run only migration 006; keep RLS enabled. Hosted authenticated browser validation remains outstanding.

## Current preview handoff

See [session handoff](docs/SESSION_HANDOFF.md) for completed prototype alignment, test scope and remaining hosted steps. On a database with 001–006 installed, apply **only migration 007** and keep RLS enabled. Browser tests now build production and use port 3100 plus the local-only authenticated-component fixture harness on 4175; the fixture harness does not test hosted Auth.
