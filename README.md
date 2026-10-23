# Saya-Sync

**Teaching records. Clearer decisions.**

**သင်ကြားမှုမှတ်တမ်းမှ ရှင်းလင်းသော ဆုံးဖြတ်ချက်များဆီသို့**

Saya-Sync helps private schools and education centres manage part-time teachers, teaching records, time corrections, payroll preparation and payment history in one place. Teachers record their classes; administrators review the records and prepare payroll from verified teaching time.

- **App:** [saya-sync-team-14.vercel.app](https://saya-sync-team-14.vercel.app/)
- **Repository:** [ayemonkyaw/Syar-Sync](https://github.com/ayemonkyaw/Syar-Sync)
- **Development branch:** `staging`. Promote to `main` when a production update is explicitly approved.
- **Hosting:** Vercel, with Supabase for authentication and PostgreSQL.

## Who it is for

School owners and administrators need a clear record of who taught, which class they taught, how long they taught and how much is payable. Part-time teachers need a simple way to record teaching time, request corrections and check their own approved pay.

Saya-Sync connects those tasks through a reviewable workflow, with English and Burmese text and school-local dates and times.

## Features

| Area | Admin | Teacher |
| --- | --- | --- |
| Overview | Review pending records, corrections and missing checkouts | See assigned classes and personal teaching summaries |
| Teaching records | Search records, inspect details and add completed records with a reason | Check in, check out and view personal records |
| Time corrections | Approve or reject requests with retained decision history | Submit corrections and withdraw pending requests |
| Record review | Resolve exceptions and verify completed records before payroll | See the status of personal records and requests |
| Teachers and classes | Create profiles and classes, manage active status and assignments | View assigned classes |
| Hourly rates | Manage effective-dated teacher rates | View personal approved pay breakdowns |
| Payroll | Calculate drafts, review held items, add adjustments and approve | View own approved payroll information |
| Payment records | Record external payments, reverse incorrect entries and inspect history | View own payment and reversal history |
| Account access | Link an existing invited Auth user to a Teacher profile | Sign in, activate an invitation and reset a forgotten password |

The interface includes responsive navigation, search and filters, paginated records, detail dialogs, inline validation, password visibility controls and styled native scrollbars.

## How the workflow works

### 1. Set up teachers and classes

An Admin creates teacher profiles and classes, assigns teachers to classes and sets hourly rates with effective dates. Existing history is retained when supported records are deactivated or assignments change.

A **Teacher profile and a Supabase Auth account are separate records**. Creating a profile in Saya-Sync does not automatically create or email a login account. An administrator must invite or create the Auth user through trusted Supabase administration and link its user ID to the Teacher profile. Automated invitation sending from the app is not implemented.

### 2. Record teaching time

Teachers check in to an assigned class and check out when teaching ends. Active sessions show an elapsed timer. The app interprets school-local timestamps in **Asia/Yangon**, independently of the device timezone.

Missing checkout is not replaced with an estimated class duration. A Teacher can request a time correction, and an Admin can add a completed record with an explanation. Original captured times remain available alongside effective times.

### 3. Review before payroll

Admins review completed records, decide correction requests and resolve exceptions such as overlapping records, assignment issues and long sessions. Completed sessions longer than six hours receive a review flag. Pending corrections and unresolved eligibility issues hold records out of payable payroll lines.

After review, an Admin verifies eligible records. Changes to relevant source information can require another review; sessions allocated to approved payroll are protected from ordinary edits.

### 4. Prepare and approve payroll

An Admin chooses a period, calculates a draft and inspects included records and held reasons. Drafts support a signed adjustment per teacher, with a reason and retained audit history. Recalculation refreshes source data; approval rechecks the source and freezes the approved financial details.

Pay uses whole teaching minutes and whole Myanmar kyat (MMK). Each session is rounded half up before totals and adjustments are combined. For example, **90 minutes at 10,000 MMK/hour produces 15,000 MMK**. PostgreSQL computes authoritative amounts; displayed decimal hours do not authorize money.

### 5. Record payment

Approval and payment are separate steps. An Admin records a full external payment against a teacher's approved net amount, including the date, method and reference. Incorrect payment records can be reversed with a reason while preserving history.

**Saya-Sync records payments; it does not transfer money or connect to a banking/payment gateway.** An approved run can be voided only when it has no payment history, including reversed payments. Teachers see their own approved breakdown and payment history rather than school totals or draft payroll.

## Technology and architecture

| Layer | Technology / responsibility |
| --- | --- |
| Web app | Next.js 16 App Router, React 19, TypeScript |
| Authentication | Supabase Auth with cookie-based sessions |
| Database | Supabase PostgreSQL, Row Level Security (RLS), authenticated RPCs |
| Business operations | PostgreSQL functions for capture, review, management and payroll |
| Styling | Prototype-derived CSS, bundled fonts and responsive components |
| Hosting | Vercel running the Next.js server application |
| Validation | Node/tsx tests, PGlite, Playwright and optional Docker PostgreSQL checks |

Protected requests verify the current user and active school membership. Database functions recheck role, school and record ownership. Version checks reject stale updates; idempotency keys protect supported operations against duplicate retries. Business mutations and audit records commit together. Approved financial snapshots and payment history have database protections.

## Local setup

### Requirements

- Node.js **24.x** and npm (npm 11 used during development).
- A Supabase development project for authenticated workflows.
- Chromium for browser tests; Docker only for the optional PostgreSQL concurrency suite.

```bash
git clone https://github.com/ayemonkyaw/Syar-Sync.git
cd Syar-Sync
git switch staging
npm ci
cp .env.example .env.local
```

Set these values in the ignored `.env.local` file using credentials from the **same Supabase project**:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PROJECT_PUBLISHABLE_KEY
```

The publishable key is intended for browser use; database access remains governed by Auth and RLS. Never place a Supabase service-role key, secret key, database password or GitHub token in a `NEXT_PUBLIC_` variable or commit credentials to Git.

### Prepare the database

For a **new development project**, review and apply all seven files in [`supabase/migrations`](supabase/migrations/) in filename order, from `202610220001_foundation.sql` through `202610220007_workspace_read_models.sql`. These migrations expect Supabase's Auth schema and roles.

For an **existing project**, check which migrations are already installed and apply only the missing ones in order. Do not rerun the original combined SQL or drop existing columns to bypass a duplicate-column error. Keep RLS enabled. Deploying the web app does not apply database migrations.

Disable public signup for invitation-only school access. Bootstrap the first Admin's school membership with trusted administrative tooling. There is no default real Admin password or public role selector.

### Run the app

```bash
npm run dev
```

Open [localhost:3000/login](http://localhost:3000/login) for real sign-in, or [localhost:3000/demo](http://localhost:3000/demo) for the fictional demo.

The demo works without Supabase credentials and stores fictional records in browser storage. Demo role selection does not grant authenticated school access. Resetting demo data affects the demo, not the Supabase database.

## Routes

| Route | Purpose |
| --- | --- |
| `/login` | Email and password sign-in |
| `/forgot-password` | Request a password-reset email |
| `/reset-password` | Verify a recovery link and choose a new password |
| `/set-password` | Verify an invitation and set an initial password |
| `/auth/callback`, `/auth/confirm` | Auth callback handling, including recovery and invitation links |
| `/workspace` | Role-specific overview, teaching records and reviews |
| `/workspace/manage` | Admin teacher, class, assignment, rate and account-link management |
| `/workspace/payroll` | Admin payroll/payment management or Teacher's own approved pay |
| `/demo` | Public fictional prototype/demo |

## Vercel deployment and email links

1. Connect Vercel to **`ayemonkyaw/Syar-Sync`**. Select Next.js, repository root `./`, Node.js 24.x and the default Next.js output directory. Use `npm ci` to install and `npm run build` to build. This is a server application, not a static export.
2. Select the intended production branch (`main` for the current release workflow); use `staging` for review deployments. The production domain and branch assignment must be checked in Vercel.
3. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for the appropriate deployment environments. Select **Config**, rather than Secret visibility, for these public framework variables. Redeploy after changing values.
4. In Supabase **Authentication → URL Configuration**, set Site URL to `https://saya-sync-team-14.vercel.app` and allow the exact live `/reset-password` and `/set-password` URLs. Add exact preview URLs separately when needed. Use separate development data for previews.
5. Check that Vercel reports the intended revision as **Ready**, then validate sign-in and recovery with real Admin and Teacher accounts. A successful Git push alone does not confirm a deployment.

Request a **fresh email** after changing redirect settings. Existing localhost, expired or consumed links do not become valid automatically. App-issued PKCE recovery links should be opened in the browser that requested them. Valid links display new-password and confirmation fields; a normal sign-in form requires an existing password.

See [password recovery and invitations](docs/PASSWORD_RECOVERY.md) for callback behavior, token-hash email template options, refresh handling and rate-limit troubleshooting. Account activation and password reset do not grant school membership by themselves.

## Checks and testing

```bash
npm run typecheck       # TypeScript checks
npm test                # Unit and PostgreSQL-engine tests using PGlite
npm run test:e2e        # Production build and Playwright browser tests
npm run build           # Production build
npm start               # Serve the production build
npm run test:postgres   # Optional: disposable Docker PostgreSQL concurrency tests
```

Browser tests use system Chromium at `/usr/bin/chromium`; set `CHROMIUM_PATH` for another installation. The current browser suite uses the production app on port **3100** and a local authenticated-component fixture harness on **4175**. Its harness command uses `/workspace/scratch/sayasync-ui-harness`; adjust that path for a different local environment.

The optional concurrency suite uses a disposable PostgreSQL 17 container, fictional data and no real database credentials. It checks simultaneous operations such as competing approvals and payment retries.

**Validation scope:** automated tests cover local application behavior, database permissions and financial rules. Auth browser tests mock Supabase responses, and the component harness uses fictional data. They do not establish real email delivery, production configuration or complete hosted Admin/Teacher acceptance. Those flows need separate live verification.

## Project structure

```text
app/                    Pages, route handlers, server actions and UI
  auth/                 Authentication callbacks
  login/                Sign-in and recovery-link forwarding
  forgot-password/      Recovery email request
  reset-password/       Shared recovery/invitation password form
  set-password/         Invitation activation page
  workspace/            Records, reviews, management and payroll
lib/
  domain/               Time, money, display and workflow helpers
  supabase/             Auth clients, configuration and authorization
  prototype/            Demo/prototype models and helpers
public/prototype/       Styles, fonts and brand assets
supabase/migrations/    Ordered database schema and business-function changes
tests/                  Unit, database, browser and fixture tests
docs/                   Detailed implementation and workflow notes
```

## Further documentation

- [Password recovery, invitations and hosted Auth configuration](docs/PASSWORD_RECOVERY.md)
- [Payroll operations, rounding, locking and history](docs/PAYROLL_WORKFLOW.md)
- [Capture and review rules](docs/REVIEW_WORKFLOW.md)
- [Prototype visual refresh](docs/UPLOADED_PROTOTYPE_VISUAL_REFRESH.md)
- [Implementation plan and architecture](docs/IMPLEMENTATION_PLAN.md)
- [Acceptance checklist](docs/ACCEPTANCE.md)

Some implementation notes describe earlier increments and their validation at that time. Use this README for the current repository, branch and hosting setup, and inspect the latest migrations and source when planning changes.
