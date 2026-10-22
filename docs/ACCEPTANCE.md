# Product PRD v0.3 acceptance coverage

Source: [Ai14_EduControl_PRD03_MM.md](reference/Ai14_EduControl_PRD03_MM.md), §14. Next.js/Supabase/Netlify migration plan controls stack selection; backend v1 pilot decisions refine older open policy notes. This checklist records coverage components, not completed UAT. PGlite tests simulate authenticated PostgreSQL roles. A separate Docker PostgreSQL 17 suite tests simultaneous connections. Neither validates hosted Supabase Auth or deployed UI integration.

| Case | Requirement | Evidence / remaining work |
|---|---|---|
| AT01 | Active Teacher, assigned class, server-time capture | RPC component tested; authenticated UI and hosted Auth pending |
| AT02 | Double tap/retry creates one session | Same-key sequential and simultaneous PostgreSQL retries tested; hosted UI pending |
| AT03 | One open session per teacher | RPC rejection and unique index tested; authenticated workspace shows open sessions; hosted validation pending |
| AT04 | Checkout retry/device clock | Same-key sequential/concurrent retry preserves result; server clock tested; device/network UI integration pending |
| AT05 | Teacher A cannot read B sessions/payroll | Teacher-profile RLS and checkout ownership tested; own-approved and cross-school financial RLS/RPC tests pass locally; hosted validation pending |
| AT06 | Admin APIs denied to Teacher | Raw writes/rate history denied; Teacher calls to Admin entry/review denied; payroll RPC role guards tested locally |
| AT07 | Missing checkout held, no inferred duration | Eligibility unit test; authoritative draft eligibility implemented; original fixture integration pending |
| AT08 | Completed/Pending excluded | Eligibility component; authoritative draft pending |
| AT09 | Pending correction held, times retained | Pending request holds verification; original/effective/proposed times retained; tested via SQL RPC; payroll RPCs tested with synthetic sessions; original fixture integration pending |
| AT10 | CR003 approval/verification gives 65 min / 13,000 MMK | 65-minute correction approval and separate verification tested; payroll RPCs tested with synthetic sessions; original fixture integration pending |
| AT11 | Rejected CR004 preserves 60 min / 13,000 MMK | Reason-required rejection leaves times unchanged, tested; 60-minute amount component passes; original CR004 session dataset unavailable |
| AT12 | Unassigned coverage cannot verify | Capture assignment checks; mismatch flags block verification until reasoned Admin resolution; tested |
| AT13 | Overnight 60 min, start-date period | Duration and Yangon date tested; database payroll selection pending |
| AT14 | Same-date end before start rejected | Calculation/SQL interval validation and explicit datetime forms implemented; hosted browser validation pending |
| AT15 | Missing/overlapping rates blocked | Missing-rate eligibility, DB overlap guard; authoritative payroll source/rate checks implemented; hosted validation pending |
| AT16 | Effective rate per session | Yangon start-date rate lookup and two-rate/overnight fixtures pass locally |
| AT17 | Changed source makes draft stale | Snapshot comparison rejects stale drafts; recalculation refreshes lines, tested locally |
| AT18 | Admin self-entry/review allowed with audit | Admin completed entry, self-verification, source/reason and review-version/audit tested; payroll approval/freeze tests pass locally |
| AT19 | Approved snapshot unaffected by new rate | Approved line/run mutation guards and changed-rate snapshot test pass locally |
| AT20 | Duplicate allocations denied | Concurrent overlapping approvals produce one winner/active allocation under PostgreSQL 17 |
| AT21 | Fixed amount, idempotent payment | Server-fixed net, sequential/concurrent retry and changed-payload conflict tests pass locally |
| AT22 | Some paid, run stays Approved; void denied | Part-paid run stays Approved; any payment history blocks Void, including fully reversed, tested locally |
| AT23 | Unpaid void/replacement preserves audit | Unpaid Void retains lines/audit, releases allocation and permits replacement, tested locally |
| AT24 | Payment reversal retains original/history | Reasoned reversal retains original; retry/race and replacement payment tests pass locally |
| AT25 | Concurrent edit/review version conflict | Parallel correction request, approve/reject and verification races tested on PostgreSQL 17; financial approval and payment races also tested locally |
| AT26 | Base 785 min / 147,000 MMK | Published teacher summary arithmetic tested; original session fixture missing |
| AT27 | Corrected 980 min / 182,500 MMK | Published increments tested; correction-to-payroll RPCs tested with synthetic sessions; original fixture integration pending |
| AT28 | Per-session rounding 8,333 + 167 = 8,500 | Unit test passes |
| AT29 | Deactivation revokes sessions, preserves payable history | Inactive-membership RLS denial tested; profile deactivation preserves history and blocks new capture; hosted session revocation and payroll pending |
| AT30 | 09:00:59 to 10:00:00 gives 59 min | Unit test passes |
| AT31 | Own approved/paid only, no drafts/other teacher | Initial RLS policies; own-approved breakdown, draft/other-teacher exclusion tests pass locally; Teacher UI implemented, hosted validation pending |
| AT32 | 360px, network errors/retries, no false success | 360px demo navigation/search tested; controlled authenticated forms retain input; hosted capture UI/network failure tests pending |

## Gaps discovered in source comparison

- The original prototype is still needed to claim approved interface parity. The current English demo is a scaffold; Burmese Unicode screens/localization and correction/payment screens remain required.
- PRD §13 supplies teacher summary totals, S0003/CR003 and S0006/CR004 behavior, and two correction increments, but not every original session row. Aggregate arithmetic must not be reported as full fixture integration.
- Teacher permissions have been tightened: raw rate history is Admin-only; Teacher applied rates belong in approved payroll lines.
- Ownership of past records is separate from profile eligibility to start a lesson. An inactive profile retains history for an active account; an inactive membership loses application access immediately.
- Six-hour automatic review was proposed in this older PRD; later backend pilot decision excludes it from the initial release.
- Rounding/time defaults marked proposed here have subsequent MVP approval notes in supplied backend v1. Preserve those decisions for development and reconcile final policy version before pilot.
