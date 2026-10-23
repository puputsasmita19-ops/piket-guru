# Piket Guru R42 — Modern Soft UI + Minimal Shadow

## Scope

This is an **incremental UI-only patch** to be installed **after R41**. It adopts the approved Modern Soft preview as the production visual system, using the **existing application components**, not the standalone demo HTML. No dummy data, demo routes, or replacement Firebase project are introduced.

## New visual styling

- Light first-time experience with white / soft gray surfaces, cyan accent, subtle borders, and very small shadows
- Inter typography if installed on the device, with a native system-font fallback (no external font requests)
- White sidebar with a clear active navigation highlight; header and mobile navigation match
- Responsive dashboard shortcuts with two columns on phones, three on tablets, four on desktops
- Color-coded floating shortcut icons; shortcut content/actions and Admin/Guru permissions remain fully dynamic
- Existing cards, tables, forms and dialog surfaces use consistent border radius, spacing and depth
- Dark Mode, System theme, existing saved theme settings, and other color palette options remain available
- No changes to school-specific photo URLs, service workers, offline queue, authentication, or live data

## Important behavior

- Existing `piket_guru_pastel_theme=default` preferences now render the approved Modern Soft colors. Other explicitly chosen palettes remain available.
- Brand-new browsers start with Light Mode; users who saved Light / Dark / System keep their own choice.
- Dashboard shortcuts still come from permission-checked original `QuickActions` and are not hardcoded placeholder cards.
- Colors for alerts, important warnings, user photos, and printed documents retain their semantics.
- Layout is visually changed, so test long tables and modal interactions on real Android devices and desktop before rollout to everyone.

## Incremental files

- `src/modern-soft.css` (new visual stylesheet)
- `src/main.tsx` (adds CSS import after the base stylesheet)
- `src/contexts/ThemeContext.tsx` (updates the default palette metadata and new-user theme choice)
- `scripts/verify_modern_soft_ui_r42.cjs`
- `docs/CHANGELOG_MODERN_SOFT_R42.md`

## Validation

Run after installing dependencies:

```sh
node scripts/verify_modern_soft_ui_r42.cjs
node scripts/verify_navigation_layout_r40.cjs
node scripts/verify_master_scroll_pagination_r41.cjs
npm run lint
npm run build
```

On the construction environment R40/R41 and R42 source checks passed. Full `npm ci` failed because of missing/unfinished packages in the local npm environment. Therefore lint/build have not been established as passing; Vercel's successful production build and device QA must be checked before rollout.

## Recommended deployment

1. Commit a backup of the current R41 code.
2. Copy the files above into the same repository paths.
3. Run local checks, Commit and Push in GitHub Desktop.
4. Confirm Vercel `Ready` and test both Admin / Guru users in mobile and desktop.
5. If any visual regression appears, revert the R42 commit; Firebase data and rules were not changed.
