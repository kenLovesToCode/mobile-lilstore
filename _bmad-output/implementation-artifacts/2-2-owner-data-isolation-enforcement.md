# Story 2.2: Owner Data Isolation Enforcement

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want each owner's data to be strictly isolated,
so that I never see or modify the wrong owner's products, shoppers, shopping list, or history.

## Acceptance Criteria

1. **Given** Owner A and Owner B exist and both have data  
   **When** Owner A is the active owner  
   **Then** Owner B's products, shoppers, shopping list, ledger, and history are not visible and cannot be used (AC4, FR10).
2. **Given** Owner A is active  
   **When** I create or edit an entity (product, shopper, shopping list item, payment, purchase)  
   **Then** it is associated only with Owner A  
   **And** it does not appear under Owner B after switching owners (FR10).

## Tasks / Subtasks

- [x] Define and enforce owner-scoped data schema constraints (AC: 1, 2)
  - [x] Add `owner_id` foreign key coverage to all owner-scoped entities in `src/db/schema.ts` and migrations.
  - [x] Add required composite indexes/uniques for scoped lookup performance and integrity (for example `owner_id + barcode`, `owner_id + created_at_ms` as needed).
  - [x] Ensure no owner-scoped table can be inserted without a valid `owner_id`.

- [x] Implement owner-scope guardrails in domain services (AC: 1, 2)
  - [x] Add or refactor service-layer query APIs so every read/write requires active owner context.
  - [x] Introduce one shared helper for active-owner requirement checks to avoid duplicated logic and drift.
  - [x] Return stable typed errors for scope violations (e.g. missing active owner, cross-owner mismatch, not found in active owner scope).

- [x] Apply owner scoping to admin read paths (AC: 1)
  - [x] Products list/detail paths load only active owner records.
  - [x] Shoppers list/detail paths load only active owner records.
  - [x] Shopping list, ledger, purchase history, payment history paths load only active owner records.
  - [x] Add defensive empty-state behavior when no active owner is selected.

- [x] Apply owner scoping to admin write paths (AC: 2)
  - [x] Create/edit product writes force active `owner_id`.
  - [x] Create/edit shopper writes force active `owner_id`.
  - [x] Shopping list writes force active `owner_id`.
  - [x] Payment/purchase writes force active `owner_id` and reject cross-owner references.

- [x] Add explicit cross-owner negative tests (AC: 1, 2)
  - [x] Service tests proving owner B data is never returned while owner A active.
  - [x] Service tests proving writes while owner A active cannot mutate owner B rows.
  - [x] Integration tests: switch owner and verify view/data swap is scoped and deterministic.
  - [x] Regression tests for existing admin login/session behavior while owner scope is enforced.

- [x] Validate end-to-end quality gates
  - [x] Run `npm run test:gate:all`.
  - [x] Run `npx tsc --noEmit`.
  - [x] Run `npm run lint`.

## Dev Notes

### Story Foundation

- This story operationalizes Epic 2 isolation promises after Story 2.1 owner creation/switching is already done.
- Primary requirement is strict, consistent owner scoping on all reads and writes, not only UI filtering.
- Scope includes products, shoppers, shopping list, ledger, purchases, and payments.

### Technical Requirements

- Enforce owner scoping in both DB shape and service APIs (do not rely on UI-only guardrails).
- Every owner-scoped write must bind `owner_id` from active owner context.
- Every owner-scoped read must constrain by active owner context.
- Cross-owner operations must fail safely with explicit typed errors.
- Maintain offline-first behavior; no network dependency is introduced.

### Architecture Compliance

- Keep all DB schema and migration changes in `src/db/**`.
- Keep all write operations inside domain services in `src/domain/services/**`.
- Keep admin route group boundaries intact in `src/app/(admin)/**`.
- Maintain result-shape consistency: `{ ok: true, value } | { ok: false, error }`.
- Continue persisted conventions: `snake_case` columns, `*_at_ms` timestamps, owner-scoped indexes.

### Library & Framework Requirements

- Keep implementation aligned with current Expo SDK 55 baseline for this repo (SDK 55 release: February 25, 2026).
- Continue using Expo Router protected admin runtime guard pattern for admin-only screens.
- Keep SQLite local-first strategy via `expo-sqlite`; do not introduce alternate persistence.
- Preserve compatibility with existing planned Drizzle + Expo SQLite direction in architecture docs.

### File Structure Requirements

- Expected primary files for this story:
  - `src/db/schema.ts`
  - `src/db/migrations/*`
  - `src/domain/services/owner-service.ts`
  - `src/domain/services/admin-session.ts`
  - Owner-scoped domain services added in Story 2.2 work (for products/shoppers/shopping list/ledger/history)
  - `src/app/(admin)/dashboard.tsx`
  - `src/app/(admin)/owners.tsx`
  - New/updated admin feature routes that begin owner-scoped reads and writes
  - `tests/*owner*`
  - `tests/*integration*` covering owner scope boundaries

### Testing Requirements

- Positive path:
  - Create/update data under owner A, switch to owner B, verify A data hidden.
  - Switch back to owner A, verify A data visible and unchanged.
- Negative path:
  - Attempt cross-owner read using owner B identifiers while owner A active; expect scoped not found/error.
  - Attempt cross-owner write/mutation; expect explicit rejection.
- Regression path:
  - Admin login/logout and owner-switch behavior remains stable.
  - Existing Story 2.1 owner create/switch flow remains intact.

### Previous Story Intelligence

- Story 2.1 already introduced:
  - `store_owner` table + migration.
  - `owner-service` (`createOwner`, `listOwners`, `switchActiveOwner`).
  - Session owner context via `admin-session`.
  - Admin owners UI and dashboard active owner indicator.
- Reuse Story 2.1 patterns:
  - Single source of truth for active owner in session service.
  - Safe error mapping without leaking DB internals.
  - Typed service results and auth checks before owner operations.
- Story 2.1 review fixed race/session consistency issues around owner switching; keep those protections.

### Git Intelligence Summary

- Most recent relevant commit: `0716a3b story(2.1):done:create and switch store owners`.
- Existing files provide direct reuse patterns for this story:
  - `src/domain/services/owner-service.ts`
  - `src/domain/services/admin-session.ts`
  - `src/db/schema.ts`
  - `src/app/(admin)/dashboard.tsx`
  - `src/app/(admin)/owners.tsx`
  - Owner/session integration tests in `tests/*owner*`.
- Apply Story 2.2 changes incrementally on top of these paths to avoid parallel session/scope mechanisms.

### Latest Tech Information (verified 2026-03-03)

- Expo SDK 55 is current in Expo changelog with release dated **February 25, 2026**.  
  Source: https://expo.dev/changelog/sdk-55
- Expo docs list SDK 55 references for SQLite and Crypto APIs used by current architecture direction.  
  Sources:  
  - https://docs.expo.dev/versions/v55.0.0/sdk/sqlite/  
  - https://docs.expo.dev/versions/v55.0.0/sdk/crypto/
- Expo Router docs continue to recommend runtime auth/protected-route patterns aligned with current `(admin)` route guard usage.  
  Sources:  
  - https://docs.expo.dev/router/advanced/authentication/  
  - https://docs.expo.dev/router/advanced/protected/
- Drizzle official docs include Expo SQLite integration patterns and constraints to follow if used for typed DB expansion in this epic.  
  Source: https://orm.drizzle.team/docs/connect-expo-sqlite

### Project Structure Notes

- Current codebase has owner context foundation but not full owner data isolation across all entities yet.
- Story 2.2 is the enforcement layer that must make cross-owner leakage impossible in service and DB boundaries.
- Keep owner context clearly visible in admin UI header/state to reduce operator mistakes.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 2, Story 2.2, FR10)
- `_bmad-output/planning-artifacts/prd.md` (FR10, NFR-S4 owner isolation)
- `_bmad-output/planning-artifacts/architecture.md` (owner-scoped services/queries, structure rules)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (owner context visibility and admin flow expectations)
- `_bmad-output/implementation-artifacts/2-1-create-and-switch-store-owners.md` (previous story learnings and patterns)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (story status source of truth)

### Project Context Reference

- No `project-context.md` file was discovered in this repository scan.

### Story Completion Status

- Story context compiled and optimized for implementation handoff.
- Status finalized as `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Workflow engine loaded: `_bmad/core/tasks/workflow.xml`
- Workflow config loaded: `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`
- Story instructions loaded: `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml`
- Implemented owner-scope schema and migration updates across product, shopper, shopping list, purchase, and payment entities
- Added owner-scope service guardrails and stable typed scope errors for read/write APIs
- Added owner-scoped admin UI route and dashboard integration for scoped read/write operations
- Executed gates: `npm run test:gate:all`, `npx tsc --noEmit`, and `npm run lint`

### Implementation Plan

- Add owner-scoped table constraints and indexes so owner context is enforced at data-model level.
- Centralize owner-context validation in a shared helper, then require it in all owner-scoped services.
- Implement scoped read/write service APIs with explicit cross-owner mismatch handling.
- Expose scoped read/write paths in admin UI with no-active-owner defensive state.
- Add negative scope tests and owner-switch integration checks, then run project quality gates.

### Completion Notes List

- Implemented owner-scoped schema coverage for products, shoppers, shopping list items, purchases, and payments with mandatory `owner_id` FKs.
- Added owner-scoped indexes and unique constraints (including owner+barcode and owner+created_at_ms patterns) plus migration wiring.
- Added shared active-owner guard helper and new domain services for products, shoppers, shopping list, and ledger/history with stable typed errors.
- Added admin owner-scoped data screen and dashboard integration to ensure owner-scoped reads/writes and empty-state guard when no active owner exists.
- Added explicit cross-owner negative tests and owner-switch integration test to validate deterministic scope behavior.
- Completed all requested quality gates successfully.

### File List

- `_bmad-output/implementation-artifacts/2-2-owner-data-isolation-enforcement.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/db/schema.ts`
- `src/db/db.ts`
- `src/db/migrations/0003_owner_scoped_entities.ts`
- `src/domain/services/owner-scope.ts`
- `src/domain/services/product-service.ts`
- `src/domain/services/shopper-service.ts`
- `src/domain/services/shopping-list-service.ts`
- `src/domain/services/ledger-service.ts`
- `src/domain/services/owner-data-service.ts`
- `src/app/(admin)/dashboard.tsx`
- `src/app/(admin)/owner-data.tsx`
- `tests/owner-scope-services.integration.test.tsx`
- `tests/owner-data-scope.integration.test.tsx`

### Change Log

- 2026-03-03: Implemented owner data isolation enforcement across schema, services, admin read/write paths, and tests; moved story status to `review`.
- 2026-03-03: Addressed code-review findings: enforced composite owner foreign keys, removed shopper PIN read exposure, added service input validation, corrected duplicate barcode conflict mapping, and expanded negative integration tests; moved story status to `done`.

### Senior Developer Review (AI)

- Review outcome: **Approved after fixes**
- All High/Medium findings from code review were fixed in source and tests.
- Validation re-run:
  - `npm run test:gate:all` ✅
  - `npx tsc --noEmit` ✅
  - `npm run lint` ✅
