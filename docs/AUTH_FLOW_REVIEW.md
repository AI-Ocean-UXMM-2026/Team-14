# Login and password recovery review

## Findings and changes

| Finding | Correction | Verification |
|---|---|---|
| A PKCE recovery code arriving at Site URL `/` was discarded by the redirect to login. | Preserve recognized Auth parameters and forward to `/reset-password`; login also forwards recovery query parameters and fragments. | Browser tests exchange a code arriving at each of `/`, `/login`, and `/reset-password`; invalid codes cannot display the update form. |
| Public connection settings were only checked for presence, and recovery catch blocks combined configuration and network errors. | Shared validation for missing settings, invalid URLs and whitespace. Login/recovery report setup errors separately from connection/service failures. | Unit configuration cases, mocked server Auth errors, browser network-failure recovery. No key values enter messages. |
| Server Components could refresh sessions but could not persist updated cookies. | Next.js proxy refreshes workspace session cookies into both the request and response. Protected data access still calls getUser and requires active membership. | Adapter tests verify both cookie destinations, private/no-store responses, outage behavior, authenticated-user/active-membership filters and anonymous denial. |
| A recovery rate limit allowed immediate repeat clicks and had no actionable retry period. | In-flight guard and at least 60-second wall-clock countdown. UI explains that project email limits may last longer. | Browser test verifies no extra request during cooldown and later retry availability. |
| A successful password update could appear to fail if subsequent sign-out threw; returned sign-out errors were ignored. | Preserve password-change success and show a separate session-revocation warning. | Browser test simulates successful update followed by rejected global sign-out. |
| Login hid rate-limit/service/unconfirmed-email errors behind the same credential message. | Specific safe messages while preserving generic rejected-credential output and entered form values. | Server action tests cover success, rejected credentials, missing configuration, 429, service/network failures, unconfirmed email, validation and redirect behavior. |

## Results

- Production build and TypeScript: passed.
- `npm test`: 103 passed, zero failures.
- `npm run test:e2e`: 32 passed, zero failures.
- No SQL migration, account deletion or school permission changes.

Logs in the review workspace: `/workspace/scratch/auth-review-all-unit.log`, `auth-review-browser.log`, `auth-review-typecheck.log`.

## Scope limits and hosted verification

Browser recovery tests run the real Supabase browser SDK against mocked Auth HTTP responses. Server Auth/proxy tests use isolated SDK/framework adapters to check action and cookie contracts. Database tests exercise local PostgreSQL/PGlite authorization. These do not prove real email delivery, actual production session refresh, Vercel environment values, or real Admin/Teacher login.

After deployment: confirm both public Supabase variables point to the intended project; Site URL uses the live origin and Redirect URLs permit its `/reset-password`. Create/confirm the intended Auth user and attach an active Admin membership. Then request one fresh recovery email from the live `/forgot-password` page, open it in the same browser, set a password and verify login. Confirm Teacher isolation and session persistence with real accounts. Do not reuse recovery links previously posted into chat.
