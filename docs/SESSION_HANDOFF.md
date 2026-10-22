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
