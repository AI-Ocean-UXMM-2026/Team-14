# Prototype parity work checklist

Reference: uploaded prototype ZIP, backed by the supplied PRDs. Preserve server authorization, exact MMK calculation, immutable financial history and correction holds. The separately linked conversation is not included.

- [x] Shared page headings, stat cards, people, badges, record tables and empty states for demo and real data.
- [x] Admin overview: four original cards with complete, server-derived eligibility totals; complete seven-day chart; correct review links.
- [x] Teacher home: original greeting, timer, assigned-class controls, help, four summary cards, earlier-correction notice and recent records.
- [x] Records/reviews: search and pagination over all accessible records, complete review queues, separate correction dates/times, assignment-aware Admin entry, accurate status and lock messages.
- [x] Payroll: original period toolbar/saved-run selector, preview/snapshot table, per-teacher breakdown/adjustment dialogs, totals and separate held table.
- [x] Payments: separate Admin/Teacher screen with four summary cards, status/period filters, detail/payment/reversal dialogs and retained history.
- [x] Teachers/classes: details/rate history, assignments from both directions, activation confirmation and account-link extension.
- [x] Activity: readable event/record/actor labels and paging without exposing audit snapshots to Teachers.
- [x] Desktop/mobile visual comparison and representative interactive tests on actual authenticated React components.
- [x] Backend tests for complete counts/queues, financial eligibility parity, Teacher/cross-school isolation, version conflicts, retries and rollback.
- [x] Final build/typecheck, unit/database tests and concurrency suite. Preview-branch publication is recorded in SESSION_HANDOFF.md and Git history.

Hosted real-token/browser checks remain separate from local UI and database checks. Any new migration follows 006 and is supplied separately; do not rerun 006.
