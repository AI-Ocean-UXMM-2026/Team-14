# Development preview on Netlify

This repository is a Next.js server application. Use a Git-connected Netlify build; uploading the source ZIP to Netlify Drop will not build the server application. The source ZIP is for transferring files to GitHub, not a prebuilt deployment.

## 1. Put the prepared application in GitHub

The application is prepared on the `sayasync-preview` branch of `ayemonkyaw/part-time-teacher-management`. In Netlify, import this repository and select that branch. Keep `main` unchanged for this development preview.

The branch includes application code, migrations, tests, deployment configuration and implementation documentation. It excludes .env.local, .git, node_modules, .next, test outputs, browser sessions and uploaded reference documents. Do not add those local files from your computer. A source ZIP was also prepared as a fallback; it is not a prebuilt Netlify deployment.

## 2. Import into your Netlify account

Open https://app.netlify.com/start (sign in or create your own account). Select the GitHub import option, authorize access to the selected repository, and choose its `sayasync-preview` branch.

- Base directory: repository root (empty).
- Build command: npm run build.
- Publish directory: .next.
- Node version: 24 (already set in netlify.toml).

Netlify detects Next.js and supplies its server runtime. No service-role key or database password is required for the app.

## 3. Configure this development site

Before deployment, add these under Netlify environment variables for the build and server/functions runtime:

NEXT_PUBLIC_SUPABASE_URL=https://kpzmngzguzkdzkeowqcc.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<the publishable key for that same development project>

Copy the key from Supabase Settings > API Keys; do not put it in GitHub or a chat message. Use the current development database only. NEXT_PUBLIC values are bundled during build, so changing them requires a new deploy. Do not copy the cloud workspace's proxy environment variables into Netlify.

Deploy this development site. Netlify will provide an HTTPS `*.netlify.app` URL. This does not migrate a database; the owner has already applied migrations 001–005 separately.

## 4. Confirm authentication configuration

Using the confirmed development hostname, configure Supabase Authentication > URL Configuration with the development Site URL and exact callback URL `https://<your-site>.netlify.app/auth/callback`. Do not guess a production domain or use wildcard redirects unnecessarily. Disable public signup: this app uses invitations. Invitations/recovery/session-refresh administration remain unfinished features; do not treat the development site as production-ready.

## 5. Browser validation

Send the public development site URL, not passwords, keys, cookies or session tokens. We can inspect public pages, security headers, form behavior, and anonymous redirects. You must sign in privately to verify the actual Admin workspace, payroll pages, sign-out and session behavior. Use fictional teaching/payment data for UAT. Database smoke tests passed separately; they do not prove browser login or real Teacher-token isolation.

No deployment has been created by preparing this package. Keep production launch gated on the implementation plan, authenticated UAT and restore/security checks.
