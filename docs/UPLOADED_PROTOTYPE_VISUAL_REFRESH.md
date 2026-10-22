# Uploaded prototype visual alignment

Reference: `Ai14_Blue_UI_latest.zip`. Scope: workspace visuals only. Login, password recovery, Supabase authentication, SQL and financial/authorization logic are unchanged.

The upload's eight core CSS files, Satoshi fonts and logo are byte-identical to the assets already in `public/prototype`. The existing workspace navigation, cards, colors and base typography therefore already use the reference assets. This change aligns the remaining React adapters rather than copying the prototype's fictional browser data or authentication.

Changes:

- Removed later enlarged review-panel font overrides so the uploaded compact type scale applies: 18px card heading, 14px row titles, 16px Burmese text, 13px action links and 18px counts. Retained wrapping/count safeguards for narrow screens.
- Aligned workspace dialog widths, corner radius, desktop/mobile padding, form spacing and native controls with the prototype.
- Used the shared prototype primary button class for payroll submit actions instead of a separately styled button.
- Aligned custom native filters with the prototype's compact text, border radius and control height.
- Preserved the labeled Edit assignments control, native keyboard navigation, focus traps, sticky dialog headers, validation, pagination and functional financial/date controls.

All new visual selectors target `#shell` or `.workspace-dialog`. Account screens do not use either scope. Existing login, forgot-password and reset-password source files were not edited. The recovery browser test now waits for the destination URL after client navigation before interacting with its form.

Verification: production build passed; all 33 Chromium browser checks passed. Full regression results are in `/workspace/scratch/uploaded-visual-alignment-browser.log`. Desktop/mobile screenshots are under `/workspace/deliverables/workspace-prototype-alignment/`. Account screen comparison screenshots are under `/workspace/scratch/auth-visual-before-*.png` and `auth-visual-after-*.png`; forgot/reset outputs matched exactly, with only a small boundary raster difference in the login output. Hosted login/email delivery and a Vercel deployment are not established by these local visual tests.
