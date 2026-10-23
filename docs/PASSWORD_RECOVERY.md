# Password recovery

Keep the existing Supabase Auth user and membership; no SQL migration or replacement user is required.

## Hosted setup

1. Deploy the latest code to Vercel (`staging` for Team-14, or `main` for the personal repository).
2. In Vercel Settings → Environment Variables, set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` for Production and Preview using the same Supabase project as the Admin account. Redeploy after environment changes.
3. In Supabase Authentication → URL Configuration, set Site URL to `https://saya-sync-team-14.vercel.app` and add `https://saya-sync-team-14.vercel.app/reset-password` to Redirect URLs. Add an explicit reset URL separately for any preview deployment you use.
4. Open `https://saya-sync-team-14.vercel.app/forgot-password` (also linked from Sign in), enter the existing Admin email, and open the new email link in the same browser. Set and confirm a new password of at least 12 characters, then sign in normally.

Requests made by the app use Supabase PKCE and redirect directly to `/reset-password`. PKCE codes arriving at the root Site URL or login page are preserved and forwarded to the reset screen, including an optional `sb_flow_id`. Dashboard recovery emails using implicit tokens at the root Site URL are forwarded by the login page. Expired or missing links show a request-new-link action. Recovery credentials are removed from the address bar before verification; tokens and passwords are never logged by application code. The reset page uses a no-referrer policy.

Passwords are updated through Supabase Auth for the recovered account. A successful update requests global sign-out to revoke refresh sessions, then returns the user to sign-in through a link; existing access tokens can remain valid until expiration. If global sign-out fails after a successful password update, the screen confirms the password change and separately warns that session revocation needs attention. School roles, user IDs, memberships and database records are not changed. Anonymous users cannot update a password without a verified recovery session.

If a recovery link has been shared, revoke the exposed session through Supabase administration and request a new link. Do not paste recovery tokens or passwords into chat or issue reports.

## Validation limits

Browser tests mock Supabase Auth responses to verify email redirects, legacy fragment recovery, rejection of invalid sessions, password confirmation, password update and sign-out. They do not send real email, reset the real Admin account, or establish that hosted environment variables and redirect allowlists are configured.

## Diagnostics and retry behavior

Missing/invalid deployment settings are reported separately from network/service failures. Login distinguishes rate limiting and unconfirmed emails from rejected credentials. Recovery rate limits disable the send button for a minimum 60-second countdown measured against wall-clock time; project-wide email limits can require longer. The countdown is a UI retry guard, not a replacement for Supabase rate limits.

The Next.js proxy refreshes authenticated workspace cookies for both the incoming server render and outgoing browser response. Every protected operation still verifies identity and active school membership; the proxy is not an authorization bypass.

## Teacher invitation links

Supabase Dashboard-issued invitations use a verified `type=invite` session. The login/root bridge forwards these to `/set-password`, which consumes the invitation, clears credentials from the address bar and lets the teacher choose a password. Expired invitations ask the teacher to contact the school Admin for a new invitation. Password recovery continues to use `/reset-password`.

For the selected deployment, configure Supabase Authentication → URL Configuration:

- Site URL: `https://saya-sync-team-14.vercel.app`
- Allowed Redirect URL: `https://saya-sync-team-14.vercel.app/set-password`
- Allowed Redirect URL: `https://saya-sync-team-14.vercel.app/reset-password`

When using trusted invitation tooling, set its `redirectTo` to the live `/set-password` URL. Default dashboard invitations using the root Site URL are also handled. Request a fresh invitation after changing URL settings; old localhost links do not automatically change. Do not paste or manually edit invitation tokens.

The activation form only sets the invited user's password. It does not create a Teacher profile, membership, rate or class assignment. Those must already be linked by an Admin. This change adds invitation-link handling; automated invitation sending from Saya-Sync still requires a protected server-side Admin integration.
