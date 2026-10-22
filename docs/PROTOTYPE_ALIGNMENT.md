# Uploaded prototype alignment — 22 October 2026

The uploaded `prototype.zip` is the visual and demonstration reference for this increment. The separately linked ChatGPT conversation and its final V07 Markdown were not supplied; they are not treated as requirements or validation evidence. This document supersedes older notes saying that the prototype or all twelve session rows are unavailable.

## Implemented

- Original blue sidebar, Saya Sync logo, locally hosted Satoshi fonts, slate background, navigation groups, dashboard cards, teaching chart, class records, status filters, correction review, teacher/class management and activity log.
- Matching Teacher navigation, assigned classes, green elapsed timer without a countdown, missing checkout guidance, and separate correction start/end date and time fields.
- Native accessible dialogs with Escape, focus restoration, dirty-form discard confirmation, and retained form values on validation errors; responsive navigation and horizontal table scrolling.
- Real Supabase login remains separate from the fictional demo. Demo records persist in this browser and can be reset. Its role selector grants no school access.
- Authenticated Admin teacher creation, initial/effective rates, class assignments, activation and linking an existing invited Auth user. Invitation delivery and password recovery still use Supabase administration; the app never creates passwords or exposes privileged keys.
- Transactional capture/review alignment: after an incomplete record has a pending correction whose requested end has passed, the Teacher can start another nonoverlapping class. The earlier record keeps its original timestamps and a correction hold; no checkout or payable duration is invented. Checkout is blocked while its correction is pending.
- New manual overlaps and overlapping corrections are rejected. Historical overlap flags remain reviewable with reasons. Sessions longer than six hours require reasoned Admin review, matching the supplied prototype and restoring that behavior after the earlier pilot exclusion.

## Deliberate differences and limits

The actual database retains RLS, idempotency, version checks, school isolation, immutable financial history and server-side payroll calculations. A run with any payment history cannot be voided, including after reversal; the demo UI enforces that backend rule even though the original demo model allowed a fully reversed run to be voided. Payment reversal preserves history and does not move money.

The authenticated overview labels the available recent/open-record scope rather than showing invented all-time financial totals. Its fourth card reports recent class records; authoritative money totals remain in Payroll. Teacher applied rates are shown with approved pay, not raw Admin rate history. Live payroll uses the protected database workflow and therefore retains more detail than the static prototype. This is a functional visual alignment, not a claim of exact pixel equivalence for every authenticated state.

The ZIP's core model is retained under `lib/prototype/core.cjs` exclusively for fictional demonstration and fixture validation. It is never authoritative for school capture, payroll or authorization.

## Apply to the existing development database

1. Back up the development project and open Supabase SQL Editor as `postgres`.
2. Run **only** [202610220006_prototype_alignment.sql](../supabase/migrations/202610220006_prototype_alignment.sql), once, after the already installed 001–005 migrations. It runs in a transaction, preserves records, adds the correction-hold state and Admin management RPC, and keeps RLS enabled. Do not rerun the original combined SQL.
3. Deploy the `sayasync-preview` branch with the existing public Supabase URL and publishable-key environment variables.
4. Check Admin login, master management and a real Teacher login. Create an invited Auth user in Supabase, copy its UID, then use Teachers → Link account. No service-role key is needed in the browser or repository.

The agent has not applied migration 006 to the hosted project. Authenticated browser workflows and real Teacher token isolation still need hosted validation after application. Public registration must be disabled in Supabase for invitation-only access. Profile/membership deactivation blocks database access immediately; explicit Auth session revocation remains an administrative action.

## Validation

- Production Next.js build and TypeScript checks.
- Local unit/database tests, including the original twelve-session fixture through both the uploaded model and database RPCs: 785 minutes / 147,000 MMK base, 980 minutes / 182,500 MMK corrected.
- PostgreSQL 17 concurrency scenarios cover capture, correction/review, allocation approval, payment and reversal races.
- Chromium checks cover Admin/Teacher demo navigation, own-record filtering, correction dates/times, dialog discard protection, 360px navigation, protected-route redirects, and verification → payroll → payment with browser persistence.
- Desktop screenshots compared with the uploaded prototype. These are local checks, not a claim that Netlify has deployed or that real hosted credentials were exercised.
