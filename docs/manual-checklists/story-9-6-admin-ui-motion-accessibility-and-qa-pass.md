# Story 9.6 Manual QA Checklist

Date: 2026-03-09
Story: `9-6-admin-ui-motion-accessibility-and-qa-pass`

## Setup

- Sign in as an admin with at least one active owner and seeded data for products, shopping list rows, history, export, and restore.
- Run the pass on a phone-sized layout.
- Repeat the motion checks twice: once with reduced motion disabled, once with reduced motion enabled at the OS level.

## Admin Shell And Tabs

- Verify `/dashboard`, `/products`, `/shopping-list`, and `/more` keep the current bottom-tab shell and do not remount into a route-directory flow.
- Confirm tab presses keep draft state intact when moving between primary tabs.
- Check each primary tab remains understandable from screen-reader labels and selected-state announcements.
- Confirm primary tab hit areas feel at least 44x44 without precision tapping.

## Motion And Interaction Feedback

- With reduced motion off, verify cards and sections reveal quickly and consistently with no long or exaggerated motion.
- With reduced motion on, verify reveal motion is removed or noticeably shortened across dashboard cards, state surfaces, and CTA feedback.
- Confirm pressed, success, warning, and destructive states remain understandable without relying on animation alone.
- Verify the restore confirmation, selection rows, and segmented controls still communicate state clearly when color cues are limited.

## Primary Workspaces

- On `/dashboard`, verify active owner context, inventory watch, backup freshness, and offline-ready messaging remain obvious.
- On `/products`, verify product lane switching, selected-product state, archive/delete actions, and no-owner fallback remain readable and screen-reader safe.
- On `/shopping-list`, verify selected product rows, selected shopping rows, assorted member toggles, and destructive removal confirmation remain clear.
- On `/more`, verify the secondary destinations still route to the intended admin pages and keep the curated gateway model.

## Secondary Modules And Backup Flows

- On `/owners`, verify owner switching remains explicit and the current owner stays understandable before and after a switch.
- On `/owner-data`, verify owner-scoped helpers still match the active owner and stale-owner protection messaging remains clear.
- On `/history`, verify purchase rows, detail entry points, empty/error states, and selected detail context remain screen-reader friendly.
- On `/data/export`, verify successful export, share-unavailable fallback guidance, and owner-scoped backup messaging remain clear.
- On `/data/restore`, verify preview, replace-all confirmation, destructive copy, and post-restore login reset still behave correctly.

## Result

- Record any blocker that would prevent calling Epic 9 ship-ready.
- Record any accessibility, reduced-motion, or trust-state regression with route, device, and reproduction steps.
