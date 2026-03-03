# Story 1.4: admin-logout

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,  
I want to log out,  
so that admin features are no longer accessible.

## Acceptance Criteria

1. **Given** I am logged in as admin  
   **When** I choose Log Out  
   **Then** I am returned to the admin login screen (FR5)  
   **And** admin-only screens are no longer accessible.

## Tasks / Subtasks

- [x] Add explicit logout action on the protected admin destination (AC: 1)
  - [x] Update `src/app/(admin)/dashboard.tsx` with a visible `Log Out` control (button-style, accessible label, disabled while processing).
  - [x] Wire action to call `clearAdminSession()` from `src/domain/services/admin-session.ts`.
  - [x] After session clear, navigate with `router.replace("/login")` to prevent back-navigation into protected screen.

- [x] Enforce and verify protected-route behavior after logout (AC: 1)
  - [x] Confirm `src/app/(admin)/_layout.tsx` guard keeps `/(admin)` routes protected and only allows `/login` and `/create-master-admin` publicly.
  - [x] Verify direct navigation to `/dashboard` immediately after logout redirects to `/login`.
  - [x] Verify admin-only UI state is not rendered once session clears.

- [x] Keep session security semantics consistent (AC: 1)
  - [x] Do not persist logout/session state to storage; runtime-only session remains source of truth.
  - [x] Ensure logout flow does not log sensitive auth/session payloads.
  - [x] Keep behavior deterministic under rapid taps (single-flight logout action in UI if async logic is introduced).

- [x] Extend automated test coverage for logout path (AC: 1)
  - [x] Add/extend mounted router integration tests in `tests/entry-gating.integration.test.tsx` (or dedicated admin-auth route test) to assert: login -> dashboard -> logout -> login.
  - [x] Add assertion that logged-out direct access to `/dashboard` redirects to `/login`.
  - [x] Keep `tests/admin-session.integration.test.tsx` coverage for session clear semantics and listener notification stability.

- [x] Validation gates
  - [x] `npm run test:gate:all`
  - [x] `npx tsc --noEmit`
  - [x] `npm run lint`

### Review Follow-ups (AI)

- [x] [AI-Review][Medium] Add an integration assertion that pressing back from `/login` after logout cannot return to `/dashboard`, so the `router.replace("/login")` back-stack claim is explicitly verified. [`tests/entry-gating.integration.test.tsx:447`]
- [x] [AI-Review][Medium] Add a logout rapid-tap test (double-press `Log Out`) to prove the single-flight behavior promised in the story task is deterministic under quick repeated input. [`tests/entry-gating.integration.test.tsx:485`]
- [x] [AI-Review][Medium] Update the “direct navigation immediately after logout” verification to run after an actual logout transition, not only from an initially logged-out state, to match the task wording and catch transition-specific regressions. [`tests/entry-gating.integration.test.tsx:478`]

## Dev Notes

### Developer Context Summary

- Story 1.3 already established runtime-only admin session (`setAdminSession` / `clearAdminSession`) and protected admin-route guarding.
- Story 1.4 should stay small and focused: add a reliable logout trigger and validate redirect + guard behavior end-to-end.
- Avoid introducing new auth persistence or navigation patterns; extend existing service + route guard approach.

### Technical Requirements

- Logout must clear current admin session through the existing session service (`clearAdminSession`).
- Post-logout user destination must be `/login` using replace navigation semantics.
- After logout, admin-only paths (for current scope: `/dashboard`) must be inaccessible and redirected by guard.
- Keep logout UX explicit and recoverable: visible action, clear pressed/disabled feedback, no ambiguous state.

### Architecture Compliance

- Maintain boundary rules:
  - UI logic in `src/app/**`.
  - Session/auth domain behavior in `src/domain/services/**`.
  - No DB writes in screen components.
- Continue route-group strategy in architecture: role-based separation with runtime guard enforcement.
- Preserve current non-persistent session model for shared-device safety.

### Library & Framework Requirements

- Continue Expo Router runtime-auth pattern (redirect/guard at runtime rather than compile-time route removal).
- Keep compatibility with project baseline (`expo ~55.0.4`, `expo-router ~55.0.3`) and prefer `npx expo install` for any Expo package changes.
- Reuse React `useSyncExternalStore` pattern already used by login/dashboard/admin layout for stable session subscriptions.

### File Structure Requirements

- Primary expected implementation files:
  - `src/app/(admin)/dashboard.tsx`
  - `src/app/(admin)/_layout.tsx`
  - `src/domain/services/admin-session.ts`
  - `tests/entry-gating.integration.test.tsx`
  - `tests/admin-session.integration.test.tsx`
- Keep existing `@/` alias import style and avoid introducing parallel auth/session modules.

### Testing Requirements

- Verify logout action clears session and returns to login route.
- Verify protected admin route remains blocked after logout, including direct route access.
- Regressions to watch:
  - stale dashboard render after session clear,
  - back-stack returning to protected UI,
  - route guard bypass when session flips quickly.

### Previous Story Intelligence

- Story 1.3 introduced the critical primitives this story should reuse directly:
  - `clearAdminSession()` in `src/domain/services/admin-session.ts`.
  - Admin route guard in `src/app/(admin)/_layout.tsx` redirecting unauthenticated users to `/login`.
  - Login success path setting session + replacing route to `/dashboard`.
- Review history from Story 1.3 emphasized race prevention, predictable redirects, and session-listener robustness; preserve these patterns for logout interaction.

### Git Intelligence Summary

- Recent commits show auth/session center of gravity is already in:
  - `src/app/(admin)/login.tsx`
  - `src/app/(admin)/_layout.tsx`
  - `src/app/(admin)/dashboard.tsx`
  - `src/domain/services/admin-session.ts`
  - `tests/entry-gating.integration.test.tsx`
  - `tests/admin-session.integration.test.tsx`
- Implementation trend is test-backed and service-first; continue this path for Story 1.4.

### Latest Tech Information (as of 2026-03-03)

- Expo SDK 55 was released on **November 12, 2025**, and this repo is aligned to that line; keep Story 1.4 changes SDK-compatible.  
  Source: https://expo.dev/changelog/sdk-55
- Expo Router authentication guidance states auth should be handled with runtime logic (redirect/guard), and protected-route support is available for SDK 53+; this matches current `/(admin)` layout guard design.  
  Source: https://docs.expo.dev/router/advanced/authentication/
- Expo Router docs reiterate that all routes are defined and auth is enforced at runtime, reinforcing use of route guards instead of route removal.  
  Source: https://docs.expo.dev/router/introduction/
- NPM package metadata indicates current `expo-router` latest is `5.1.4` and `scrypt-js` latest is `3.0.1`; project should stay on SDK-compatible versions unless explicitly upgrading.  
  Sources: https://www.npmjs.com/package/expo-router, https://www.npmjs.com/package/scrypt-js

### Project Structure Notes

- Current scope has only a minimal protected admin destination (`dashboard`) and auth-entry screens. That is sufficient for Story 1.4; do not expand feature surface.
- No repository `project-context.md` was discovered (`**/project-context.md`), so planning artifacts and prior story files are the authoritative context source.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 1, Story 1.4 requirements)
- `_bmad-output/planning-artifacts/prd.md` (FR5, admin session constraints)
- `_bmad-output/planning-artifacts/architecture.md` (route guard and service boundary guidance)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (shared-device safety and clear session boundaries)
- `_bmad-output/implementation-artifacts/1-3-admin-login-protected-admin-session-non-persistent.md` (previous story implementation + learnings)
- `src/app/(admin)/dashboard.tsx`
- `src/app/(admin)/_layout.tsx`
- `src/app/(admin)/login.tsx`
- `src/domain/services/admin-session.ts`
- `src/domain/services/auth-service.ts`
- `tests/entry-gating.integration.test.tsx`
- `tests/admin-session.integration.test.tsx`

### Project Context Reference

- No `project-context.md` file found via repository scan (`**/project-context.md`).

### Story Completion Status

- Story context compiled and optimized for implementation handoff.
- Status finalized as `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Target discovery: `_bmad-output/implementation-artifacts/sprint-status.yaml` (first backlog story resolved to `1-4-admin-logout`)
- Artifact analysis: `epics.md`, `architecture.md`, `prd.md`, `ux-design-specification.md`
- Previous story intelligence: `_bmad-output/implementation-artifacts/1-3-admin-login-protected-admin-session-non-persistent.md`
- Git intelligence: `git log --oneline -n 5`, `git log --name-status --oneline -n 5`
- Latest tech checks: Expo SDK changelog, Expo Router authentication/introduction docs, npm package pages for `expo-router` and `scrypt-js`
- Updated sprint tracking: `_bmad-output/implementation-artifacts/sprint-status.yaml` (`1-4-admin-logout` moved to `in-progress`, then `review`)
- Red phase: `npm run test:gate:integration -- tests/entry-gating.integration.test.tsx` (failed: missing `Log Out` control)
- Green/refactor verification: `npm run test:gate:integration -- tests/entry-gating.integration.test.tsx tests/admin-session.integration.test.tsx`
- Validation gates: `npm run test:gate:all`, `npx tsc --noEmit`, `npm run lint`

### Implementation Plan

- Add a visible logout control in `src/app/(admin)/dashboard.tsx` with button semantics, disabled/loading feedback, and single-flight tap handling.
- Reuse existing session boundary (`clearAdminSession`) and route transition pattern (`router.replace`) to keep runtime-only auth behavior consistent.
- Extend integration coverage for the full auth route loop (`/login -> /dashboard -> logout -> /login`) and preserve explicit `/dashboard` guard assertions.
- Expand session service tests to verify clear-session notifications remain stable, including thrown-listener resilience.

### Completion Notes List

- Generated Story 1.4 context with explicit acceptance criteria mapping, implementation tasks, architecture guardrails, previous-story learnings, git intelligence, and latest technical references.
- Prepared this story for `dev-story` execution with scope constrained to logout behavior and route-guard enforcement.
- Implemented logout CTA in admin dashboard with accessible label, disabled/loading state, and single-flight action guard.
- Wired logout action to `clearAdminSession()` and `router.replace("/login")`, preserving non-persistent runtime-only session behavior.
- Kept route protection model intact in `src/app/(admin)/_layout.tsx`; verified `/dashboard` remains blocked when unauthenticated.
- Added integration coverage for login-to-dashboard-to-logout route flow and retained direct `/dashboard` redirect assertion.
- Extended admin-session integration coverage for clear-session notification semantics and listener stability during logout.
- Passed all required validation gates: `npm run test:gate:all`, `npx tsc --noEmit`, `npm run lint`.

### File List

- `_bmad-output/implementation-artifacts/1-4-admin-logout.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/app/(admin)/dashboard.tsx`
- `tests/entry-gating.integration.test.tsx`
- `tests/admin-session.integration.test.tsx`

### Change Log

- 2026-03-03: Implemented Story 1.4 admin logout flow, expanded logout/session tests, and completed all validation gates.
