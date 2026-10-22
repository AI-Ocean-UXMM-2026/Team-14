# Host SayaSync on Vercel

The app is a Next.js server application. Vercel should build from the Git repository, not a static export. Node 24 is pinned in package.json and the framework/build commands are declared in vercel.json.

## Create the project

1. Sign in at https://vercel.com/new using your GitHub account.
2. Import `AI-Ocean-UXMM-2026/Team-14`. Grant Vercel access to this repository if it is not listed.
3. Use project name `saya-sync-team-14` (or an available name), Next.js framework, root directory `./`, and Node.js 24.x. Keep the default Next.js output directory.
4. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` from the same development Supabase project already used by the app. Set them for Production and Preview. Do not add a service-role key or database password.
5. Deploy the **staging** branch. Under Settings → Environments → Production → Branch Tracking, select `staging`. Grant the Vercel GitHub app access to Team-14 if required by the organization.
6. The selected app URL is `https://saya-sync-team-14.vercel.app`. Confirm that this domain is assigned to the project and the latest deployment shows Ready.

## Database and login

The development Supabase project must already have migrations 001–006 and the new 007. For an existing installation, apply only 007; keep RLS enabled. Hosting does not install database migrations. See SESSION_HANDOFF.md for validation scope and safe migration instructions.

After Vercel provides the final hostname, add its exact `https://.../auth/callback` URL under Supabase Authentication → URL Configuration → Redirect URLs for invitations/email callbacks. Set Site URL to the selected primary app origin if Vercel becomes the primary host. For the selected host, set Site URL to `https://saya-sync-team-14.vercel.app` and allow `https://saya-sync-team-14.vercel.app/reset-password`. Password recovery requests use the origin where the form is opened, so request new emails from the Team-14 site. Password sign-in uses the configured project URL and publishable key.

Test the login page, real Admin access, a separate Teacher account, check-in/correction/review and approved pay. Demo role selection is fictional; it does not test hosted Auth or RLS.

No Vercel deployment was created by the agent: the workspace has no authenticated Vercel connection. GitHub push and local build validation are separate from a successful hosted deployment.
