<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## User repository and branch preference

The user’s latest instruction supersedes earlier repository/branch sync instructions:

- Commit and push all future updates to `ayemonkyaw/Syar-Sync`, branch `staging`.
- Do not push to `main`, `sayasync-preview`, or Team-14 unless the user explicitly requests it.
- Keep credentials and `.env.local` out of Git. Preserve untracked `docs/reference/` material.
- A Git push does not confirm a Vercel deployment; report deployment status separately.
