# Story 3.3: Archive or Delete Products

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to archive or delete products,
so that my catalog stays current without clutter.

## Acceptance Criteria

1. **Given** a product exists for the active owner
   **When** I archive or delete the product
   **Then** it is removed from the active product list (or clearly marked archived) (FR15)
   **And** it is no longer offered as an active product choice in admin product pickers.
2. **Given** a product is referenced by a shopping-list item
   **When** I attempt to hard-delete it
   **Then** the system blocks deletion with a clear dependency error and guidance (PRD Journey 2 risk mitigation).
3. **Given** archived products exist
   **When** admin workflows create or edit shopping-list entries
   **Then** archived products are excluded from active selection paths so shoppers cannot buy archived items.

## Tasks / Subtasks

- [x] Implement product lifecycle actions in the owner-scoped service layer (AC: 1, 2)
  - [x] Add `archiveProduct` and `deleteProduct` operations in `src/domain/services/product-service.ts`.
  - [x] Ensure both operations enforce active owner context and owner mismatch protections.
  - [x] Add deterministic error mapping for dependency conflicts and owner-scope failures.

- [x] Add persistence support for archive state (AC: 1, 3)
  - [x] Add nullable `archived_at_ms` to `product` schema via migration.
  - [x] Update list/read queries to default to active products (`archived_at_ms IS NULL`) unless explicitly requesting archived data.
  - [x] Preserve existing owner-scoped uniqueness behavior (`(owner_id, lower(barcode))`).

- [x] Enforce safe hard-delete behavior (AC: 2)
  - [x] Prevent delete when product is referenced by `shopping_list_item` (pre-check and/or FK conflict handling).
  - [x] Return actionable error copy (for example: remove from shopping list first, or archive instead).

- [x] Update admin product UI to expose lifecycle controls (AC: 1, 3)
  - [x] Add archive action for selected product.
  - [x] Add delete action with confirmation for destructive intent.
  - [x] Keep archived products out of active picker paths and active list by default.
  - [x] Preserve existing submit-lock and owner-switch race protections from Stories 3.1/3.2.

- [x] Extend shopping-list integration guardrails (AC: 3)
  - [x] Ensure shopping-list add/edit paths reject archived products as selectable active items.
  - [x] Confirm shopper-facing purchasability remains based on active shopping-list entries only.

- [x] Add regression coverage and run quality gates (AC: 1, 2, 3)
  - [x] Service integration tests for archive success, delete success, delete dependency conflict, cross-owner protection.
  - [x] Route integration tests for archive/delete UX states, dependency messaging, and archived-product exclusion behavior.
  - [x] Run: `npm run test:gate:integration`, `npx tsc --noEmit`, `npm run lint`.

- [x] Review Follow-ups (AI)
  - [x] [AI-Review][HIGH] Keep product archive index creation upgrade-safe by creating it only after `archived_at_ms` exists.
  - [x] [AI-Review][HIGH] Exclude archived products from active shopper sale paths by filtering `listShoppingListItems` to active products only.
  - [x] [AI-Review][MEDIUM] Add explicit cross-owner regression tests for `archiveProduct` and `deleteProduct`.

## Dev Notes

### Story Foundation

- Epic 3 objective: maintain a clean, owner-scoped product catalog while preserving reliable scanner identity rules.
- Story 3.3 finalizes product lifecycle management after create/edit (3.1) and duplicate-barcode invariants (3.2).
- This story implements FR15 with safe behavior for existing shopping-list dependencies and owner isolation.
- Business outcome: admins can de-clutter catalog safely without introducing hidden shopper-facing regressions.
- Source: `_bmad-output/planning-artifacts/epics.md` (Epic 3, Story 3.3).

### Technical Requirements

- Continue owner-scoped enforcement in every product write path (`requireActiveOwnerContext`).
- Introduce explicit product lifecycle states:
  - active product: `archived_at_ms IS NULL`
  - archived product: `archived_at_ms` populated with epoch ms
- Keep hard-delete safety deterministic:
  - if product has active references in `shopping_list_item`, block delete with conflict error
  - do not silently cascade-delete shopping-list data
- Keep data contracts stable:
  - existing create/update behavior must not regress
  - barcode uniqueness remains per owner and case-insensitive (`lower(barcode)`)
- Ensure list APIs used by admin pickers can return only active products by default.
- Keep error codes aligned with owner-scope contract (`OWNER_SCOPE_CONFLICT`, `OWNER_SCOPE_NOT_FOUND`, `OWNER_SCOPE_MISMATCH`, `OWNER_SCOPE_UNAVAILABLE`).

### Architecture Compliance

- Keep architecture boundaries unchanged:
  - UI orchestration in `src/app/(admin)/products.tsx`
  - business logic and invariants in `src/domain/services/product-service.ts`
  - schema/migration changes only in `src/db/**`
- Respect current DB integrity model:
  - foreign keys enabled via `PRAGMA foreign_keys = ON` in `src/db/db.ts`
  - shopping-list references to products use owner-scoped FK constraints
- Do not move write logic into route components.
- Preserve owner-switch race safety and stale-response guards already implemented in product screens.
- Source: `_bmad-output/planning-artifacts/architecture.md` (boundaries, owner scoping, service write rules).

### Library & Framework Requirements

- Keep implementation compatible with repository stack:
  - Expo SDK `~55.0.4`
  - Expo Router `~55.0.3`
  - React `19.2.0`
  - React Native `0.83.2`
  - expo-sqlite `~55.0.10`
- Use SQLite-native constraints and conflict handling rather than ad hoc UI-only checks.
- If migration is added, ensure it is idempotent and included in bootstrap migration sequence.

### File Structure Requirements

- Primary change targets:
  - `src/domain/services/product-service.ts`
  - `src/domain/services/owner-data-service.ts` (export plumbing only if needed)
  - `src/app/(admin)/products.tsx`
  - `src/db/schema.ts`
  - `src/db/migrations/*` (new migration for `archived_at_ms` if implemented)
  - `tests/owner-scope-services.integration.test.tsx`
  - `tests/owner-data-scope.integration.test.tsx`
- Secondary verification targets:
  - `src/domain/services/shopping-list-service.ts` (active-product guardrail integration)
- Keep non-target modules stable unless required for regression fixes.

### Testing Requirements

- Service-level tests:
  - archive product marks state and removes from default active list reads
  - hard-delete succeeds when no shopping-list dependency exists
  - hard-delete returns deterministic conflict when dependency exists
  - cross-owner archive/delete attempts are blocked with mismatch errors
  - duplicate-barcode protections from Story 3.2 remain green
- Route-level tests (`/products`):
  - archive action updates visible list/picker behavior correctly
  - delete action confirmation and dependency error UX behave deterministically
  - inputs/error state handling remains stable under owner-switch and refresh races
- Integration guardrails:
  - shopping-list creation/edit cannot choose archived products as active options
- Required gates:
  - `npm run test:gate:integration`
  - `npx tsc --noEmit`
  - `npm run lint`

### Previous Story Intelligence (Story 3.2)

- Story 3.2 established strong owner-scoped product invariants:
  - deterministic duplicate-barcode conflict mapping
  - case-insensitive owner-scoped uniqueness
  - route-level conflict UX that preserves user inputs
- Reuse existing implementation patterns rather than introducing parallel product data paths.
- Keep current quality posture:
  - schema-level constraints as source of truth
  - service-layer deterministic errors
  - route-level owner-switch stale-response protection
- Avoid scope mixing: Story 3.3 should add lifecycle actions without regressing create/edit flows.
- Primary source: `_bmad-output/implementation-artifacts/3-2-prevent-duplicate-barcodes-within-an-owner.md`.

### Git Intelligence Summary

Recent commit patterns show product work is centered in service + route + integration tests:

- `8576347` (`story(3.2):done`)
  - `src/domain/services/product-service.ts`
  - `tests/owner-scope-services.integration.test.tsx`
  - `tests/owner-data-scope.integration.test.tsx`
- `1135246` (`story(3.1):done crate and edit products name barcode`)
  - `src/app/(admin)/products.tsx`
  - `src/domain/services/owner-data-service.ts`
  - same integration test suites

Actionable guidance:

- Implement Story 3.3 in the same file clusters for consistency and lower regression risk.
- Prefer extending existing test suites over creating new fragmented test files.
- Keep commit scope aligned with owner-scoped product lifecycle and avoid unrelated refactors.

### Latest Tech Information (Verified 2026-03-03)

- Expo SDK 55 is the current released SDK line (announced **February 25, 2026**) and includes React 19 / React Native 0.83 support; keep this story aligned to SDK 55 APIs.
  - Source: https://expo.dev/changelog/sdk-55
- Expo roadmap indicates SDK 56 is targeted for **Q2 2026**; avoid speculative upgrades inside this story unless explicitly requested.
  - Source: https://expo.dev/changelog
- React Native release support currently lists `0.83` as the active stable line, matching this repository baseline.
  - Source: https://reactnative.dev/docs/releases
- SQLite foreign key enforcement behavior remains dependent on `PRAGMA foreign_keys`; deletion semantics must respect FK rules (`RESTRICT`/`NO ACTION`) to avoid orphaned references.
  - Sources:
    - https://www.sqlite.org/pragma.html#pragma_foreign_keys
    - https://www.sqlite.org/foreignkeys.html

### Project Structure Notes

- Current codebase already has admin products UI and owner-scoped service plumbing in place.
- Story 3.3 should be implemented as an additive lifecycle extension:
  - add archive/delete behavior
  - preserve existing create/edit and owner-scope invariants
  - preserve existing route race-condition protections
- Dependency awareness is critical: shopping-list rows currently reference products with owner-scoped FK constraints, so destructive delete must be guarded.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 3, Story 3.3)
- `_bmad-output/planning-artifacts/prd.md` (FR15; Journey 2 dependency risk)
- `_bmad-output/planning-artifacts/architecture.md` (service boundaries, owner scoping, write rules)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (admin UX clarity and destructive-action confirmation patterns)
- `_bmad-output/implementation-artifacts/3-2-prevent-duplicate-barcodes-within-an-owner.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/app/(admin)/products.tsx`
- `src/domain/services/product-service.ts`
- `src/domain/services/owner-data-service.ts`
- `src/domain/services/shopping-list-service.ts`
- `src/db/schema.ts`
- `src/db/db.ts`
- `tests/owner-scope-services.integration.test.tsx`
- `tests/owner-data-scope.integration.test.tsx`
- Web references:
  - https://expo.dev/changelog/sdk-55
  - https://expo.dev/changelog
  - https://reactnative.dev/docs/releases
  - https://www.sqlite.org/pragma.html#pragma_foreign_keys
  - https://www.sqlite.org/foreignkeys.html

### Project Context Reference

- No `project-context.md` file was discovered in repository scan.

### Story Completion Status

- Story context created and status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Workflow engine loaded: `_bmad/core/tasks/workflow.xml`
- Workflow config loaded: `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`
- Workflow config loaded: `_bmad/bmm/workflows/4-implementation/code-review/workflow.yaml`
- Story file loaded: `_bmad-output/implementation-artifacts/3-3-archive-or-delete-products.md`
- Sprint status transitioned: `3-3-archive-or-delete-products` `ready-for-dev` → `in-progress` → `review` → `done`
- Validation commands executed:
  - `npm run test:gate:integration`
  - `npx tsc --noEmit`
  - `npm run lint`

### Implementation Notes For Dev Agent

- Prioritize deterministic service behavior and FK-safe delete handling before UI polish.
- Keep owner-scoped conflict/error handling consistent with Stories 3.1 and 3.2.
- Treat shopping-list dependency protection as a non-negotiable guardrail.

### Completion Notes

- Implemented `archiveProduct` and `deleteProduct` in `product-service` with owner-scope validation and deterministic dependency-conflict handling.
- Added archive persistence support with `archived_at_ms` schema/migration updates and active-by-default product listing (`archived_at_ms IS NULL`).
- Added shopping-list guardrails to reject archived products for add/edit list item flows.
- Updated admin `/products` UI with archive action and double-confirm delete UX while preserving owner-switch stale-response protections and submit lock semantics.
- Extended integration tests for service-level lifecycle operations and route-level archive/delete UX and messaging.
- Resolved review finding [HIGH]: migration safety for archive index creation now depends on `archived_at_ms` existence via post-column migration execution.
- Resolved review finding [HIGH]: `listShoppingListItems` now joins `product` and filters `archived_at_ms IS NULL` so archived products are excluded from active purchasability paths.
- Resolved review finding [MEDIUM]: added explicit cross-owner regression tests for `archiveProduct` and `deleteProduct`.

### Change Log

- 2026-03-03: Implemented Story 3.3 product archive/delete lifecycle, archive-aware persistence and queries, shopping-list archived-product guards, admin UI lifecycle controls, and full regression coverage.
- 2026-03-03: Senior Developer Review (AI) completed. Story moved to in-progress pending fixes for migration safety, archived-product purchasability guardrails, and missing cross-owner test coverage for new lifecycle actions.
- 2026-03-03: Addressed code review findings (3 items resolved), re-ran integration/type/lint quality gates, and approved story completion.

### File List

- `src/domain/services/product-service.ts`
- `src/domain/services/shopping-list-service.ts`
- `src/domain/services/owner-data-service.ts`
- `src/app/(admin)/products.tsx`
- `src/db/schema.ts`
- `src/db/db.ts`
- `src/db/migrations/0006_product_archive_lifecycle.ts`
- `tests/owner-scope-services.integration.test.tsx`
- `tests/owner-data-scope.integration.test.tsx`
- `_bmad-output/implementation-artifacts/3-3-archive-or-delete-products.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Senior Developer Review (AI)

Reviewer: myjmyj  
Date: 2026-03-03

Outcome: Changes Requested

Findings:

1. [HIGH] Upgrade path migration failure risk in existing installs.
   - `src/db/migrations/0003_owner_scoped_entities.ts` now executes `CREATE_PRODUCT_OWNER_ARCHIVED_CREATED_AT_INDEX_SQL` unconditionally in base bootstrap sequence.
   - `src/db/db.ts` runs base migration statements before `ensureProductArchiveColumn`, so pre-existing databases without `product.archived_at_ms` can fail while creating the new index.
   - Evidence:
     - `src/db/migrations/0003_owner_scoped_entities.ts` includes archived index in `OWNER_SCOPED_ENTITY_MIGRATION_STATEMENTS`.
     - `src/db/db.ts` applies `BASE_MIGRATION_STATEMENTS` before `ensureProductArchiveColumn`.
   - Impact: app bootstrap can fail for upgrade users.

2. [HIGH] AC3 is only partially implemented for archived-product exclusion from active sale paths.
   - Archiving a product does not remove or deactivate existing shopping-list rows referencing that product.
   - `listShoppingListItems` still returns all list rows by owner without filtering out archived products.
   - Evidence:
     - `archiveProduct` updates only `product.archived_at_ms` in `src/domain/services/product-service.ts`.
     - `listShoppingListItems` query in `src/domain/services/shopping-list-service.ts` does not join/filter on `product.archived_at_ms IS NULL`.
   - Impact: previously published list items for archived products can remain active and purchasable, conflicting with AC3 intent.

3. [MEDIUM] Task marked complete but required cross-owner regression coverage is missing for new lifecycle actions.
   - Story tasks claim service integration coverage for cross-owner archive/delete protection.
   - Current tests add archive success + delete success/conflict, but no explicit cross-owner archive/delete test case.
   - Evidence:
     - `tests/owner-scope-services.integration.test.tsx` has cross-owner test for update only (`rejects cross-owner product edits`) and no corresponding `archiveProduct`/`deleteProduct` cross-owner assertions.
   - Impact: owner-scope protection for new operations is unverified and can regress silently.

### Senior Developer Review (AI) - Follow-up

Reviewer: myjmyj  
Date: 2026-03-03

Outcome: Approved

Resolution Summary:

- [x] [HIGH] Migration safety fixed by ensuring archive index creation runs via `0006_product_archive_lifecycle` after `ensureProductArchiveColumn`.
- [x] [HIGH] AC3 active sale-path exclusion fixed by filtering `listShoppingListItems` to active products (`product.archived_at_ms IS NULL`).
- [x] [MEDIUM] Added explicit cross-owner coverage for `archiveProduct` and `deleteProduct` in `tests/owner-scope-services.integration.test.tsx`.

Validation:

- `npm run test:gate:integration` passed.
- `npx tsc --noEmit` passed.
- `npm run lint` passed.
