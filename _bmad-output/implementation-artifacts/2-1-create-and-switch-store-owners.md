# Story 2.1: Create and Switch Store Owners

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to create and switch between store owners on the same device,
so that I can operate multiple independent stores without mixing data.

## Acceptance Criteria

1. **Given** I am logged in as admin  
   **When** I create a new store owner with a name  
   **Then** the owner is persisted locally and appears in the owner list (FR8).
2. **Given** two or more owners exist  
   **When** I switch the active owner from Owner A to Owner B  
   **Then** the app's admin views operate in the context of Owner B (FR9)  
   **And** Owner A remains available to switch back to.

## Tasks / Subtasks

- [x] Implement store-owner persistence model and migration (AC: 1, 2)
  - [x] Add `store_owner` table with at minimum: `id`, `name`, `created_at_ms`, `updated_at_ms` in `src/db/schema.ts`.
  - [x] Add migration in `src/db/migrations/**` for `store_owner` table creation and owner-name uniqueness/index strategy.
  - [x] Keep naming/format conventions from architecture (`snake_case`, epoch-ms timestamps).

- [x] Implement owner domain service API (AC: 1, 2)
  - [x] Add `src/domain/services/owner-service.ts` with `createOwner(...)`, `listOwners(...)`, and `switchActiveOwner(...)`.
  - [x] Return stable discriminated result shape (`{ ok: true, value }` / `{ ok: false, error }`) consistent with existing auth services.
  - [x] Add validation and user-safe error mapping (empty name, duplicate name, DB failure).

- [x] Implement active-owner session state (AC: 2)
  - [x] Add owner context state to runtime session layer (`src/domain/services/admin-session.ts` or dedicated store/service).
  - [x] Ensure `switchActiveOwner(...)` updates active context atomically and notifies listeners.
  - [x] Keep context runtime-safe for current app behavior; do not introduce unsafe cross-owner defaults.

- [x] Build admin Owners UI (AC: 1, 2)
  - [x] Add route `src/app/(admin)/owners.tsx` (or `owners/index.tsx`) with owner list and create-owner form.
  - [x] Add owner switch control from admin dashboard (`src/app/(admin)/dashboard.tsx`) and/or owners screen.
  - [x] Show clear active-owner indicator in admin UI after switching.

- [x] Wire owner context into admin route flow (AC: 2)
  - [x] Ensure admin screens read active-owner context from session/service.
  - [x] Add guard behavior for "no owner yet" state (prompt to create first owner).
  - [x] Ensure owner switching does not break existing admin auth guard (`src/app/(admin)/_layout.tsx`).

- [x] Add tests and validation coverage (AC: 1, 2)
  - [x] Service tests for owner create/list/switch happy path and validation failures.
  - [x] Integration tests for UI flow: create owner -> appears in list -> switch owner -> active owner indicator updates.
  - [x] Regression coverage to ensure owner switching does not affect admin login/logout behavior.
  - [x] Run: `npm run test:gate:all`, `npx tsc --noEmit`, `npm run lint`.

## Dev Notes

### Developer Context Summary

- Epic 2 starts multi-owner capability. This story establishes owner creation and active-owner switching only.
- Keep implementation minimal but foundational for Story 2.2 (owner data isolation enforcement).
- Existing codebase currently has admin login/logout and protected admin shell but no owner domain yet.

### Technical Requirements

- Implement owner persistence locally via SQLite under existing DB bootstrap.
- Admin can create multiple owners and switch active owner without leaving admin flow.
- Active owner must be clearly represented in session/runtime context for follow-up owner-scoped features.
- Error handling must be explicit and user-safe; no raw DB/internal details in UI.

### Architecture Compliance

- Keep writes in domain services (`src/domain/services/**`), not in screen components.
- Keep schema + migrations exclusively in `src/db/**`.
- Preserve existing route-group strategy under `src/app/(admin)` and runtime auth guard logic.
- Use `Result<T, AppError>` style and typed error codes compatible with current service patterns.

### Library & Framework Requirements

- Expo Router runtime guards/protected routing patterns remain valid for SDK 53+ and current repo strategy.
- Keep project aligned to Expo SDK 55 toolchain in this repository.
- Continue SQLite + migration-first workflow used in Story 1.x groundwork.

### File Structure Requirements

- Primary expected files for this story:
  - `src/db/schema.ts`
  - `src/db/migrations/*`
  - `src/domain/services/owner-service.ts` (new)
  - `src/domain/services/admin-session.ts` (active-owner state extension)
  - `src/app/(admin)/dashboard.tsx`
  - `src/app/(admin)/owners.tsx` or `src/app/(admin)/owners/index.tsx` (new)
  - `tests/*owner*.test.ts*` (new)
  - `tests/entry-gating.integration.test.tsx` (only if route-flow regression assertions are needed)

### Testing Requirements

- Validate owner creation persists and list refreshes reliably.
- Validate active-owner switch updates runtime context and UI indicator.
- Validate switching is deterministic across rapid taps and does not produce stale owner UI state.
- Re-run baseline quality gates before moving to `review`.

### Previous Story Intelligence

- Story 1.4 established admin logout and protected-route behavior; owner flow must respect the same session boundaries.
- Story 1.3 hardened session/listener mechanics and single-flight style protections; reuse those patterns for owner switching.
- Story 1.2 and 1.1 established DB/bootstrap/service boundaries and gate reliability patterns; follow the same architectural conventions.

### Git Intelligence Summary

- Recent implementation focus is in:
  - `src/app/(admin)/dashboard.tsx`
  - `src/app/(admin)/_layout.tsx`
  - `src/domain/services/admin-session.ts`
  - `src/domain/services/auth-service.ts`
  - `src/db/schema.ts`
  - gate/auth integration tests under `tests/`
- Use this existing pattern set rather than creating parallel session or routing mechanisms.

### Latest Tech Information (as of 2026-03-03)

- Expo SDK 55 changelog entry is dated **February 25, 2026**; keep implementation SDK-compatible with current repo baseline.  
  Source: https://expo.dev/changelog/sdk-55
- Expo Router auth/protected route docs continue to emphasize runtime route protection, compatible with current `(admin)` guard pattern.  
  Sources: https://docs.expo.dev/router/advanced/authentication/, https://docs.expo.dev/router/advanced/protected/
- Drizzle supports Expo SQLite integration patterns including `openDatabaseSync` and migration workflows; useful for upcoming owner schema/service expansion if adopted in this code path.  
  Sources: https://orm.drizzle.team/docs/connect-expo-sqlite, https://orm.drizzle.team/docs/get-started/expo-new

### Project Structure Notes

- Current app has only base admin screens (`login`, `create-master-admin`, `dashboard`) and no owner management routes yet.
- Introduce owner screens/services in ways that preserve existing auth-entry and route-guard stability.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 2, Story 2.1)
- `_bmad-output/planning-artifacts/prd.md` (FR8, FR9, owner-scoping intent)
- `_bmad-output/planning-artifacts/architecture.md` (service boundaries, route groups, DB conventions)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (admin UX consistency, owner context visibility)
- `_bmad-output/implementation-artifacts/1-4-admin-logout.md`
- `_bmad-output/implementation-artifacts/1-3-admin-login-protected-admin-session-non-persistent.md`
- `_bmad-output/implementation-artifacts/1-2-create-initial-master-admin-username-password.md`
- `_bmad-output/implementation-artifacts/1-1-set-up-initial-project-from-starter-template-first-run-gating-shell.md`

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

- Workflow + story inputs loaded from `_bmad/core/tasks/workflow.xml`, `dev-story/workflow.yaml`, `dev-story/instructions.xml`
- Red phase: added failing tests in `tests/owner-service.integration.test.tsx`, `tests/admin-session-owner.integration.test.tsx`, `tests/owner-management.integration.test.tsx`
- Green/refactor: implemented owner schema + migration + service + session + admin routes
- Validation runs:
  - `npm run test:gate:all` (pass)
  - `npx tsc --noEmit` (pass)
  - `npm run lint` (pass)

### Completion Notes List

- Added `store_owner` persistence with migration-backed table creation and owner-name uniqueness index strategy.
- Implemented owner domain service API with stable `{ ok: true, value } | { ok: false, error }` results, safe validation, and error mapping.
- Extended runtime admin session with active-owner state and listener notification behavior suitable for owner switching.
- Added admin owners management route for create/list/switch flows and dashboard owner guard/indicator UI wiring.
- Added owner-focused service/session/UI integration tests and validated full project gates.

### File List

- `src/db/schema.ts`
- `src/db/db.ts`
- `src/db/migrations/0002_store_owner.ts`
- `src/domain/services/owner-service.ts`
- `src/domain/services/admin-session.ts`
- `src/app/(admin)/dashboard.tsx`
- `src/app/(admin)/owners.tsx`
- `tests/owner-service.integration.test.tsx`
- `tests/admin-session-owner.integration.test.tsx`
- `tests/owner-management.integration.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/2-1-create-and-switch-store-owners.md`

## Senior Developer Review (AI)

### Review Date

2026-03-03

### Reviewer

myjmyj (AI Senior Developer Review)

### Outcome

Approve

### Summary

- Adversarial review found 1 high + 3 medium issues across owner-session race handling, service auth boundary consistency, and test robustness.
- All high/medium issues were fixed in this review pass and validated with full project gates.

### Action Items

- [x] [High] Prevent owner-switch race from writing active owner after logout (`src/domain/services/owner-service.ts`).
- [x] [Medium] Enforce admin-session guard consistently across owner service read/write entrypoints (`src/domain/services/owner-service.ts`).
- [x] [Medium] Remove brittle mocked session side-effect from owner UI integration test (`tests/owner-management.integration.test.tsx`).
- [x] [Medium] Add missing negative-path coverage for owner service validation/failure behavior (`tests/owner-service.integration.test.tsx`).

## Change Log

- 2026-03-03: Implemented Story 2.1 owner create/switch capability, added migration/service/session/admin UI, and passed full test/type/lint gates.
- 2026-03-03: Senior code review completed; fixed 4 findings (1 high, 3 medium), re-ran quality gates, and approved story.
