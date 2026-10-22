# Payroll and payment implementation

Apply **only** `supabase/migrations/202610220005_payroll.sql` to a development project that already has migrations 001–004. It adds financial functions and history protections without resetting existing tables or creating accounts. Review existing adjustments first: the pilot supports one editable signed adjustment per teacher/run, with all prior values retained in audit. If existing duplicate adjustment rows conflict with the new index, the transaction fails rather than silently combining/deleting data.

## Operations

- `calculate_payroll(start, end, key)` creates a versioned draft with included lines, held reasons, policy and full source snapshots. The period is inclusive in Asia/Yangon and limited to 367 days. Overnight sessions belong to their local start date. Rates apply at midnight of that start date; enter effective rate boundaries at school-local midnight.
- `recalculate_payroll(run, version, key)` refreshes source snapshots and lines, preserving explicit teacher adjustments.
- `set_payroll_adjustment(run, version, key, teacher, amount, reason, reference)` sets one signed whole-MMK adjustment per teacher. It can include a teacher with no current-period lessons for late adjustments. Draft net may be negative; approval rejects any teacher with negative net, even when the school total is positive.
- `approve_payroll(run, version, key)` revalidates the entire source snapshot, rebuilds authoritative lines, checks net values, freezes approval details and allocates sessions in one transaction. A changed source or existing allocation makes the draft stale. Approval does not mark anything Paid.
- `record_payment(run, version, key, teacher, date, method, reference)` records a full external payment from the teacher’s frozen net. It accepts no client amount and does not execute a transfer. One active payment is enforced per run/teacher.
- `reverse_payment(payment, run_version, key, reason)` retains the original payment, timestamps/reasons its reversal, and permits a later replacement payment. It transfers no money.
- `void_payroll(run, version, key, reason)` voids only an Approved run with **no payment history at all**, including reversals. It preserves snapshots/audit and releases active allocations. Replacement calculation gets a new run/revision.
- `get_payroll_detail(run)` is active-school-Admin-only. `get_my_payments()` returns only the active member’s own approved breakdown, adjustments and payment/reversal history, never a draft or school aggregate.

Whole-minute floor and numeric per-session round-half-up occur inside PostgreSQL. Rounded session amounts are summed, then signed adjustments are applied. No floating-point display-hours calculation authorizes money. Integer money returned to the UI is limited to JavaScript’s exact integer range; larger transactions roll back.

## Locking and history

Financial writes acquire a school financial advisory transaction lock, teacher rows in sorted UUID order, the school policy row, then the run/payment row. Capture/review and assignment/rate/exception/correction source triggers share the teacher lock protocol. Separate-connection PostgreSQL tests verify that overlapping approvals cannot both allocate a session and parallel payment retries cannot duplicate payment.

Every business mutation, retry result and audit event commits together. Same committed retry returns the original response; altered payload with the same key conflicts. Version checks reject stale actions. Approved lines/adjustments, original payment fields, and audit events have update/delete guards. An Approved run can change only through the permitted unpaid Void transition; its frozen amounts do not change when source rates or profiles change.

## Screens

`/workspace/payroll` is authenticated and dynamic. Admins can calculate, inspect included/held records, edit draft adjustments, approve, record full external payment, reverse, and void eligible unpaid runs. Destructive business decisions have explicit confirmations. Controlled forms retain entered data on error and preserve request keys for safe retry. Teachers see only their approved payment breakdown and status through the sanitized RPC. The workspace links to this route; anonymous access redirects to login.

The public `/demo` remains fictional and does not authorize or simulate real financial writes.

## Validation scope

Local PostgreSQL/PGlite tests cover session rounding, effective-date and overnight rates, stale drafts, negative net, authoritative rebuild after accidental draft edits, immutable snapshots, teacher/cross-school data isolation, retry conflicts, fixed payment amount, reversal history, unpaid void/replacement, and audit-failure rollback. Docker PostgreSQL 17 tests exercise capture/review races plus competing payroll approvals, payment retries and reversals.

Browser regression checks cover public demo behavior and redirect protection. The hosted authenticated UI has **not** been tested with a user login. Migration 005 has not been applied remotely by the agent; the app’s publishable key cannot perform schema changes. The user must run it in Supabase SQL Editor as postgres, then validate the Admin/Teacher flows with fictional data.

Original twelve-session fixture rows, master-data management UI, invitations/recovery/session-refresh administration, complete Burmese UI parity, performance/UAT, rate limiting/CSP, backup restore and production release remain separate outstanding work. No bank transfer or deployment has been made.
