# Story 3.4: View and Restore Archived Products

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to view archived products and restore them,
so that accidental archives can be recovered without recreating products from scratch.

## Acceptance Criteria

1. **Given** archived products exist for the active owner
   **When** I switch to an archived-products view in admin product management
   **Then** I can see archived products for that owner only
   **And** active products remain hidden in that archived view by default (FR10, FR15).
2. **Given** an archived product is selected
   **When** I choose Restore
   **Then** the product is returned to the active product list
   **And** it becomes selectable again in active admin product pickers and shopping-list creation/edit paths (FR15, FR18, FR21).
3. **Given** restoring an archived product would violate owner-scoped barcode uniqueness
   **When** I attempt the restore
   **Then** the system blocks restore with a clear duplicate-barcode conflict message
   **And** no data is partially updated (FR16, FR17).

## Tasks / Subtasks

- [x] Implement restore lifecycle action in owner-scoped product service (AC: 2, 3)
  - [x] Add `restoreProduct` operation in `src/domain/services/product-service.ts`.
  - [x] Enforce active owner context and owner mismatch protections for restore.
  - [x] Reuse deterministic conflict mapping for barcode uniqueness on restore.

- [x] Extend product listing query support for archived-only admin view (AC: 1)
  - [x] Add service-layer listing option to request archived products without mixing active results.
  - [x] Preserve existing default active-only query behavior used by picker paths.
  - [x] Keep owner-scoped query guarantees unchanged.

- [x] Expose restore/listing APIs through owner data orchestration (AC: 1, 2)
  - [x] Export `restoreProduct` through `src/domain/services/owner-data-service.ts`.
  - [x] Keep existing owner-scoped snapshot and service exports stable.

- [x] Update admin products UI for archived browsing and restore action (AC: 1, 2, 3)
  - [x] Add active vs archived view mode in `src/app/(admin)/products.tsx`.
  - [x] In archived mode, surface restore action for selected archived products.
  - [x] Keep archive/delete controls constrained to active-mode semantics.
  - [x] Preserve submit-lock, owner-switch, and stale-response race protections from Stories 3.1-3.3.

- [x] Validate shopping-list purchasability behavior remains coherent after restore (AC: 2)
  - [x] Confirm restored products become valid active choices again in admin create/edit shopping-list paths.
  - [x] Confirm archived-product exclusion guardrails remain intact until restore occurs.

- [x] Add regression coverage and run quality gates (AC: 1, 2, 3)
  - [x] Service integration tests for restore success, cross-owner restore mismatch, and restore barcode conflict.
  - [x] Route integration tests for archived view toggle, restore UX states, and active-list reinclusion.
  - [x] Run: `npm run test:gate:integration`, `npx tsc --noEmit`, `npm run lint`.

## Dev Notes

### Story Foundation

- Epic 3 objective remains owner-scoped product lifecycle control with scanner-safe barcode identity rules.
- Story 3.4 builds on Story 3.3 by adding recoverability for archived products.
- Business outcome: admins can safely reverse accidental archive actions without destructive re-entry.
- Source: `_bmad-output/planning-artifacts/epics.md` (Epic 3, Story 3.4).

### Technical Requirements

- Keep owner-scoped enforcement in all restore/list APIs (`requireActiveOwnerContext`).
- Restore semantics:
  - archived product: `archived_at_ms` has value
  - restored product: set `archived_at_ms = NULL`, bump `updated_at_ms`
- Restore must obey existing owner-scoped barcode uniqueness (`(owner_id, lower(barcode))`):
  - if conflict exists with active product, return deterministic conflict error.
- Preserve existing read contracts:
  - default product lists for active management remain active-only.
  - archived-only view must not leak active products.
- Maintain deterministic owner-scope error codes:
  - `OWNER_SCOPE_CONFLICT`
  - `OWNER_SCOPE_NOT_FOUND`
  - `OWNER_SCOPE_MISMATCH`
  - `OWNER_SCOPE_UNAVAILABLE`

### Architecture Compliance

- Keep architecture boundaries unchanged:
  - UI orchestration in `src/app/(admin)/products.tsx`
  - business logic/invariants in `src/domain/services/product-service.ts`
  - owner-data API wiring in `src/domain/services/owner-data-service.ts`
- Do not move write logic into route components.
- Preserve owner-switch stale-response and submit-lock protections already established in product screens.
- Source: `_bmad-output/planning-artifacts/architecture.md` (owner scoping, service boundaries, and route responsibilities).

### Library & Framework Requirements

- Keep implementation compatible with repository baseline (`package.json`):
  - Expo SDK `~55.0.4`
  - Expo Router `~55.0.3`
  - React `19.2.0`
  - React Native `0.83.2`
  - expo-sqlite `~55.0.10`
- Prefer SQLite constraint-backed conflict handling over UI-only assumptions.
- No new dependencies are expected for this story.

### File Structure Requirements

- Primary change targets:
  - `src/domain/services/product-service.ts`
  - `src/domain/services/owner-data-service.ts`
  - `src/app/(admin)/products.tsx`
  - `tests/owner-scope-services.integration.test.tsx`
  - `tests/owner-data-scope.integration.test.tsx`
- Secondary verification target:
  - `src/domain/services/shopping-list-service.ts` (behavioral validation only unless fix is required)
- Keep non-target modules stable unless required for regressions.

### Testing Requirements

- Service-level tests:
  - restore success for archived product in active owner scope
  - restore blocked when product belongs to different owner
  - restore blocked with deterministic conflict when barcode uniqueness would be violated
  - default active list remains active-only
  - archived-only list returns only archived rows
- Route-level tests (`/products`):
  - archived view toggle displays archived products and hides active rows
  - restore action returns product to active list
  - restore conflict messaging is surfaced and preserves form/view state
  - owner switch/race protections remain intact
- Required gates:
  - `npm run test:gate:integration`
  - `npx tsc --noEmit`
  - `npm run lint`

### Previous Story Intelligence (Story 3.3)

- Story 3.3 established archive and delete lifecycle primitives, plus archived-product exclusion from active shopping-list sale paths.
- Reuse Story 3.3 patterns:
  - deterministic owner-scope error mapping
  - service-first invariants with minimal route orchestration
  - submit-lock and stale-response guards in products UI
- Avoid regressing Story 3.3’s migration and guardrail fixes while adding restore behavior.
- Primary source: `_bmad-output/implementation-artifacts/3-3-archive-or-delete-products.md`.

### Git Intelligence Summary

Recent commit patterns confirm product lifecycle work is concentrated in service, route, and integration tests:

- `992e3bf` (`story(3.3):done:archive or delete products`)
  - `src/domain/services/product-service.ts`
  - `src/app/(admin)/products.tsx`
  - `src/domain/services/shopping-list-service.ts`
  - `tests/owner-scope-services.integration.test.tsx`
  - `tests/owner-data-scope.integration.test.tsx`
- `8576347` (`story(3.2):done`)
  - product owner-scoped barcode invariants and tests

Actionable guidance:

- Implement Story 3.4 in the same clusters for consistency and low regression risk.
- Extend existing test suites rather than creating fragmented new test files.

### Latest Tech Information (Repository Baseline Snapshot 2026-03-03)

- This story should align with the repository’s pinned dependency set in `package.json` (Expo SDK 55 + React 19 + RN 0.83 line).
- No framework upgrade work is in scope for this story.

### Project Structure Notes

- Current product management flow already supports archive and delete actions.
- Story 3.4 is an additive admin capability:
  - archived list visibility
  - restore workflow
  - deterministic conflict handling
- Existing owner-scoped and shopping-list guardrails must remain unchanged except where restore intentionally reactivates archived products.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 3, Story 3.4)
- `_bmad-output/planning-artifacts/prd.md` (FR10, FR15, FR16, FR17, FR18, FR21)
- `_bmad-output/planning-artifacts/architecture.md` (service boundaries, owner scoping, route responsibilities)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (admin product UX, destructive-action clarity, loading/disable states)
- `_bmad-output/implementation-artifacts/3-3-archive-or-delete-products.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/app/(admin)/products.tsx`
- `src/domain/services/product-service.ts`
- `src/domain/services/owner-data-service.ts`
- `src/domain/services/shopping-list-service.ts`
- `tests/owner-scope-services.integration.test.tsx`
- `tests/owner-data-scope.integration.test.tsx`

### Project Context Reference

- No `project-context.md` file was discovered in repository scan.

### Story Completion Status

- Story context created and status set to `done`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Implementation Plan

- Add `restoreProduct` to product service with owner-scope validation, deterministic duplicate-barcode conflict mapping, and `archived_at_ms` reset semantics.
- Extend `listProducts` filtering to support archived-only reads while preserving default active-only behavior and optional include-archived behavior.
- Re-export restore functionality through owner-data orchestration for route usage.
- Add archived/active mode switch in admin products route; keep archive/delete behavior active-mode only and add restore action in archived mode.
- Expand service and route integration tests to cover restore success, owner mismatch, barcode conflict, archived view isolation, and restore UX flow.

### Debug Log References

- Workflow engine loaded: `_bmad/core/tasks/workflow.xml`
- Workflow config loaded: `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`
- Story loaded: `_bmad-output/implementation-artifacts/3-4-view-and-restore-archived-products.md`
- Project context scan: no `project-context.md` discovered
- Validation runs:
  - `npm run test:gate:integration -- tests/owner-scope-services.integration.test.tsx tests/owner-data-scope.integration.test.tsx` (initial red failure then green pass)
  - `npm run test:gate:integration` (pass)
  - `npx tsc --noEmit` (pass)
  - `npm run lint` (pass)
- Sprint status updated:
  - `3-4-view-and-restore-archived-products` → `in-progress` → `review`

### Completion Notes List

- Implemented `restoreProduct` in product service with deterministic owner-scoped mismatch/not-found/conflict handling and timestamp updates.
- Added `archivedOnly` product listing option while retaining default active-only and `includeArchived` behaviors.
- Exported `restoreProduct` through owner-data service without breaking existing owner snapshot/service exports.
- Updated admin products route with active/archived view toggle, archived-mode restore UX, and active-mode-only archive/delete controls while preserving submit-lock and stale response guards.
- Added service integration tests for restore success, restore conflict, restore owner mismatch, and archived-only listing behavior.
- Added products route integration tests for archived-view toggle, restore success flow, and restore conflict messaging/state preservation.
- Verified shopping-list archived guardrails remain intact by passing full integration suite.

### File List

- `src/domain/services/product-service.ts`
- `src/domain/services/owner-data-service.ts`
- `src/app/(admin)/products.tsx`
- `tests/owner-scope-services.integration.test.tsx`
- `tests/owner-data-scope.integration.test.tsx`
- `_bmad-output/planning-artifacts/epics.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/3-4-view-and-restore-archived-products.md`

### Change Log

- 2026-03-03: Implemented Story 3.4 archived product view/restore flow, added owner-scoped restore invariants and archived-only listing filters, expanded service/route integration coverage, and passed required quality gates.
- 2026-03-03: Code review remediation: enforced archived-only restore precondition, added regression coverage for restore-to-shopping-list create/edit flows, and synced story/sprint status to done.
