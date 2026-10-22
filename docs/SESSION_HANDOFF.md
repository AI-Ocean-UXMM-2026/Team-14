# SayaSync session handoff — 22 October 2026

## Goal and branch

User requested detailed prototype alignment with a correct backend. Work is in `/workspace/part-time-teacher-management`, branch `sayasync-preview`, origin `ayemonkyaw/part-time-teacher-management`. Do not push the inaccessible `sayar-syns` remote. Preserve ignored `.env.local` and untracked `docs/reference/`; do not commit credentials or original uploads.

## Implemented in this increment

- Shared prototype components used by both fictional demo and real screens: headings, stat cards, people/statuses, class-record tables, review summary, Teacher timer/home, correction card grid/tabs, payroll preview, payment register/breakdown and teacher/class cards.
- Restored Admin eligible-payroll card, complete totals/chart and correct review links; restored Teacher summary cards/help/guidance.
- Real Payroll and Payments are separate prototype layouts; dialogs preserve protected server actions, confirmations, signed adjustments, immutable snapshots, external payment/reversal history, stale-draft recalculation and prior-payroll references.
- Teacher profiles/rate history, both directions of assignments, activation confirmations and readable paged activity. Class codes are generated; Teacher codes no longer truncate after 999.
- Accessible dialog names, Cancel/discard confirmation, focus restoration and background scroll lock. Controlled inputs survive failed saves. Admin completed entry shows only assigned classes; correction dates/times remain separate.
- New migration **007** provides complete/paged RLS read models, approved payment register with explicit Teacher ownership, navigation counts and an atomic class-assignment RPC. Existing 001–006 are not changed. The migration validates essential 006 definitions, is transactional, contains no record reset or column additions, and is designed to be reapplied safely.
- Authenticated UI errors keep the school shell and avoid showing migration details to Teachers.

## Verification and exact limits

Final verified results: production build and TypeScript passed; 84 unit/database checks passed; 11 PostgreSQL concurrency scenarios passed (12 runner tests including parent); all 13 Chromium browser tests passed. These runs include the final correction-card/dialog and migration preflight refinements.

New backend tests cover more than 50 records, old review queues, eligibility parity, complete payment totals before paging, Teacher/cross-school/anonymous isolation, assignment retries/conflicts/audit rollback and code generation. Existing original twelve-session fixture tests still cover 785 minutes / 147,000 MMK and 980 minutes / 182,500 MMK.

Seven browser checks render the actual authenticated React components in a **local-only fixture harness** with stubbed failed actions. They do not log in to hosted Supabase and do not prove real-token isolation. Six browser checks exercise the production demo/auth redirects. The harness is under tests/ui, generated outside the repo in `/workspace/scratch/sayasync-ui-harness`, and is never a deployed Next route.

Final commands/logs:
- `npm run typecheck`
- `npm test` → `/tmp/sayasync-all-tests.log`
- `npm run test:postgres` → `/tmp/sayasync-concurrency.log`
- `npm run test:e2e` → `/tmp/sayasync-browser-final.log` (builds production first, rebuilds fixture harness, runs production test server on 3100 and local fixture server on 4175).

If interrupted: read these logs and inspect `git status` and the latest commit/remote SHA before doing anything. The final code is ready to commit and push only `sayasync-preview`; if already pushed, proceed with the external steps below. Check Git remote SHA after pushing. Do not claim success based on an old log. Browser fixture screenshots are `/workspace/scratch/real-*.png`; reference screenshots `/workspace/scratch/reference-classes.png` and `/workspace/scratch/prototype-overview.png`.

## External steps still required

1. Agent has not applied **007** remotely. User previously installed 001–006; duplicate-column error plus presence checks established 006 objects exist but did not fully verify their definitions. 007 preflight now checks critical 006 definitions and fails before changes if incompatible. Do not delete columns or rerun the original combined SQL.
2. Run the entire `supabase/migrations/202610220007_workspace_read_models.sql` in development Supabase SQL Editor as postgres, with RLS enabled. If preflight fails, inspect installed 006 function definitions and prepare a targeted repair; do not blindly rerun 006.
3. Redeploy `sayasync-preview` in Netlify after migration success. Deployment was not independently triggered/verified by the agent.
4. Test actual Admin login and a real Teacher login, capture/correction/review, rate/assignment changes and approved payments. Hosted login/token tests remain outstanding; credentials are not available to the agent.
5. Keep public signup disabled for invitation-only access. Account invitation/recovery and explicit Auth session revocation still use Supabase administration. Real account linking remains an intentional production extension of the prototype.

Financial safeguard retained: any historical payment blocks voiding a payroll, including after reversal. Native date/select controls and pagination are deliberate accessibility/data-volume extensions. No claim of universal pixel identity or hosted end-to-end completion.

## Latest UI/UX polish increment

See UI_UX_POLISH.md. Reviewed prototype-latest.zip: all 30 files match the original ZIP. Completed the approved Priority 1 and 2 usability updates. Latest validation: build/typecheck passed, 88 unit/database checks passed, 20 browser checks passed; screenshots under /workspace/scratch/ux-polish-*.png. No SQL migration is needed for this increment. The user reports the existing hosted backend is working; the agent has not independently logged in to the live app. Git author email is locally configured to ayemonkyaw.amk@gmail.com to avoid the previous Vercel commit-author block. Push the UI update to main and sayasync-preview; Vercel deploys main. Preserve docs/reference/ as untracked user material.

## Login form restoration

Always render the prototype login form; missing Supabase configuration is reported by the existing server action instead of removing Email/Password/Sign in. Restored the “Demo accounts” heading and removed the additional invitation paragraph to match the supplied screenshot. Demo buttons still open fictional data; they do not authenticate real school accounts. Corrected the Show button vertical position. No SQL changes. Production build/typecheck passed and all 21 browser checks passed with both public Supabase environment variables explicitly empty during the build (regression coverage for the disappearing form). Rebuilt with the existing workspace configuration afterward. Desktop/mobile screenshots: `/workspace/scratch/login-desktop-preview.png` and `/workspace/scratch/login-mobile-preview.png`. Hosted sign-in was not independently tested.

## Password recovery implementation

Added `/forgot-password` and `/reset-password`, a Forgot password link on login, and forwarding of dashboard-issued root recovery fragments from login. Browser Supabase client explicitly consumes recovery fragments or PKCE codes; credentials are removed from browser history before verification. Reset validates confirmation/minimum 12 characters, calls Auth updateUser for the existing recovered user, and requests global sign-out. Missing/expired sessions cannot submit. No schema changes or account recreation.

Production build/typecheck passed; all 26 browser checks passed, including five new mocked Auth recovery checks (email redirect, invalid/missing session, root fragment recovery/update/sign-out, rejected password retry, PKCE). Log: `/workspace/scratch/recovery-browser.log`. The tests do not send real email or change the real Admin password. Hosted environment/Supabase configuration and live Admin login remain unverified.

User action after deployment: follow `docs/PASSWORD_RECOVERY.md`; Site URL must use the hosted origin and Redirect URLs must explicitly allow `/reset-password`. Open `/forgot-password`, request a fresh email and use the same browser for the new PKCE link. Never reuse the recovery link/token previously pasted into chat. Preserve the existing Admin UID/membership.

## Deep login/recovery review

See `docs/AUTH_FLOW_REVIEW.md`. Fixed root/login PKCE code forwarding (including optional flow ID), validated public connection settings, more accurate login/network/rate-limit diagnostics, 60-second wall-clock recovery cooldown, and password-success handling when global sign-out fails. Added Next.js `proxy.ts` to persist refreshed workspace cookies; authorization still uses getUser plus active membership. No SQL/account/role changes. Latest production build/typecheck passed, all 103 unit/database checks and 32 browser checks passed. Browser Auth HTTP and server SDK/framework adapters are simulated; live email, actual Admin/Teacher logins and production session expiry remain unverified. Logs `/workspace/scratch/auth-review-*.log`. Sync source main/preview and Team-14 staging; do not overwrite untracked `docs/reference/`.

## Team-14 app URL

The user selected `https://saya-sync-team-14.vercel.app` to replace the previous personal deployment URL. Updated README, Vercel deployment instructions (Team-14 staging), and password recovery setup. Runtime recovery already uses the current page origin; no application code or SQL change is required. Supabase Site URL/allowed redirect URLs and Vercel domain assignment must still be configured in their dashboards; workspace has no authenticated access to change them. Request fresh recovery emails from the Team-14 host after saving settings.

## Login demo shortcuts removed

Removed the Demo accounts heading and Admin/Teacher demo links from `/login` at the user’s request. Email/password sign-in and Forgot password remain. Existing desktop/mobile browser checks now require the demo shortcuts to be absent; standalone fictional demo checks navigate directly to `/demo`. No authentication or database permission changes. Production build and all 32 browser checks passed; log `/workspace/scratch/login-remove-demo-browser.log`. Sync Team-14 staging and personal main/preview, then wait for Vercel Ready.

## Latest user instruction — repository and branch

All future updates must be committed and pushed to `ayemonkyaw/Syar-Sync` on `staging`. This supersedes earlier directions to sync personal main/preview or Team-14. Do not push those branches/repositories unless explicitly requested again. The local origin URL is now the canonical Syar-Sync URL; staging was initialized from the latest personal main and records this instruction. Vercel branch settings have not been changed by the agent. See AGENTS.md for persistent workflow rules.

## Site scrollbars and reset-password visibility

Added native scrollbar styling across document, dialogs, tables and other scroll containers: rounded blue thumbs, hover/active states, Firefox standard-property fallback and forced-colors support. No scrolling interception or animations. Added independent Show/Hide buttons to New password and Confirm new password with accessible names, aria-pressed/controls, input padding and type=button. Existing password confirmation and Auth submission remain unchanged. Production build and all 33 Chromium browser checks passed, including a new desktop/mobile toggle check that verifies values are preserved and toggles never submit. Log `/workspace/scratch/scrollbar-password-browser.log`; preview `/workspace/scratch/reset-password-toggle-mobile.png`. Push only Syar-Sync staging unless the user asks for main.
