# UI/UX polish — 22 October 2026

The uploaded prototype-latest.zip contains the same 30 files as the previous prototype, byte for byte. This increment implements the reviewed Priority 1 and Priority 2 improvements on the existing shared UI. Optional changes such as replacing mobile tables with a new card layout are outside this increment.

## Changes

- Mobile navigation makes the hidden drawer inert, contains keyboard focus while open, makes the background inert, handles Escape and breakpoint changes, and restores focus to the toggle.
- Shared form validation shows field-specific messages, associates them with inputs, focuses the first invalid control and focuses server-error summaries. Corrected errors clear while editing. Login retains entered values in component memory after unsuccessful sign-in; no credentials are persisted to browser storage. Authentication still uses Supabase and the workspace independently resolves membership/roles.
- Teacher assigned classes identify the current class as In progress, Missing checkout or Correction pending. Recent classes link to All my records.
- Successful school/management/financial actions have specific, dismissible confirmations, including required next steps. Approving payroll and recording external payment remain separate actions.
- Payroll defaults to a Monday–Sunday week when no run is selected, with This week / Last week shortcuts and editable custom dates. Shortcuts change date inputs only; the existing calculated snapshot remains until Calculate draft succeeds. Existing saved runs use their original period.
- Display dates consistently use Asia/Yangon and include year context. Class-record lists show class codes rather than database UUID fragments; the full reference remains in Details. Financial audit references remain available where needed to identify held or included records.
- Improved payroll toolbar grouping, Burmese paragraph spacing, validation styling, mobile controls and sticky dialog headers.

No database migrations, authorization rules, rate calculations, allocation guards or payment-history protections are changed. Continue using the installed migrations through 007.

## Validation scope

Verified: production build and TypeScript passed, all 88 unit/database checks passed, and all 20 Chromium browser checks passed. Desktop payroll and mobile form/dialog layouts were also visually inspected. Browser component fixtures use fictional data and stubbed actions; they are not real hosted Admin/Teacher login tests. Existing database tests continue to exercise RLS, payroll, correction holds and history protections.

After the Git push, wait for Vercel's main deployment to become Ready and refresh the live app. Hosted deployment status is not directly available to the agent.
