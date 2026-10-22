# Password recovery

Keep the existing Supabase Auth user and membership; no SQL migration or replacement user is required.

## Hosted setup

1. Deploy the latest `main` branch to Vercel.
2. In Vercel Settings → Environment Variables, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Production and Preview using the same Supabase project as the Admin account. Redeploy after environment changes.
3. In Supabase Authentication → URL Configuration, set Site URL to `https://part-time-teacher-management-zeta.vercel.app` and add `https://part-time-teacher-management-zeta.vercel.app/reset-password` to Redirect URLs. Add an explicit reset URL separately for any preview deployment you use.
4. Open `/forgot-password` (also linked from Sign in), enter the existing Admin email, and open the new email link in the same browser. Set and confirm a new password of at least 12 characters, then sign in normally.

Requests made by the app use Supabase PKCE and redirect directly to `/reset-password`. Existing dashboard recovery emails using implicit tokens at the root Site URL are forwarded by the login page to the reset screen. Expired or missing links show a request-new-link action. Recovery credentials are removed from the address bar before verification; tokens and passwords are never logged by application code. The reset page uses a no-referrer policy.

Passwords are updated through Supabase Auth for the recovered account. A successful update requests global sign-out to revoke refresh sessions, then returns the user to sign-in through a link; existing access tokens can remain valid until expiration. School roles, user IDs, memberships and database records are not changed. Anonymous users cannot update a password without a verified recovery session.

If a recovery link has been shared, revoke the exposed session through Supabase administration and request a new link. Do not paste recovery tokens or passwords into chat or issue reports.

## Validation limits

Browser tests mock Supabase Auth responses to verify email redirects, legacy fragment recovery, rejection of invalid sessions, password confirmation, password update and sign-out. They do not send real email, reset the real Admin account, or establish that hosted environment variables and redirect allowlists are configured.
