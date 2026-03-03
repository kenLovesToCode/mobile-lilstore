# Story 4.3: Create and Manage Assorted Shopping List Groups

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,  
I want to create an "Assorted" shopping list entry that groups multiple barcodes,  
so that multiple products can share pricing rules and a pooled available quantity.

## Acceptance Criteria

1. **Given** multiple products exist for the active owner  
   **When** I create an assorted shopping list item and add multiple barcodes as members  
   **Then** the shopping list shows a single "Assorted" entry for the group (FR51)  
   **And** the group has one shared available quantity pool and one shared pricing rule set.
2. **Given** an assorted group exists  
   **When** I edit its member barcodes, pricing, or available quantity  
   **Then** the changes are saved and reflected in shopper sessions.

## Tasks / Subtasks

- [x] Add owner-scoped persistence for assorted groups and members (AC: 1, 2)
  - [x] Add new schema entities for assorted groups (shared quantity + shared pricing) and member-product mappings.
  - [x] Add migration `src/db/migrations/0008_shopping_list_assorted_groups.ts` and register it in `src/db/db.ts`.
  - [x] Keep existing `shopping_list_item` schema and bundle rules backward-compatible for standard items.
  - [x] Enforce DB-level invariants where practical (owner scope FKs, duplicate member prevention per group, numeric bounds checks).

- [x] Extend shopping-list domain services for assorted lifecycle operations (AC: 1, 2)
  - [x] Add typed contracts for assorted group create/list/update operations (shared unit price, optional bundle, shared available quantity, member products).
  - [x] Enforce service-level validation: minimum two members, no duplicate members, owner-scoped products only, archived products cannot be members.
  - [x] Enforce deterministic error contracts using existing `OWNER_SCOPE_*` and `INVALID_INPUT` patterns.
  - [x] Keep existing standard shopping-list create/update/remove flows unchanged.

- [x] Add admin UI flows for creating and managing assorted groups (AC: 1, 2)
  - [x] Extend `src/app/(admin)/shopping-list.tsx` to support an assorted entry workflow alongside standard-item workflow.
  - [x] Provide member selection UX (multi-select from active owner products) and clear guardrail messaging for invalid selections.
  - [x] Show assorted entries as a single published row with shared pricing/quantity context (and member count summary).
  - [x] Support edit flow for members + shared pricing + shared quantity with current stale-response and submit-lock protections.

- [x] Ensure shopper-session compatibility for downstream stories (AC: 2)
  - [x] Store assorted data in a form consumable by upcoming shopper scan/cart stories (FR52/FR53).
  - [x] Preserve "single source of truth" for shared availability and pricing so future confirm-time decrement logic can use one pooled value.

- [x] Add regression and migration coverage (AC: 1, 2)
  - [x] Service integration tests in `tests/owner-scope-services.integration.test.tsx` for create/edit assorted groups, owner isolation, and validation failures.
  - [x] Route integration tests in `tests/shopping-list-admin.integration.test.tsx` for assorted create/edit interactions and guardrail messaging.
  - [x] Migration tests in `tests/shopping-list-assorted-migration.integration.test.tsx` for add-table/idempotency/repair expectations.
  - [x] Confirm existing standard-item + bundle tests remain green.

- [x] Run quality gates before moving to review (AC: 1, 2)
  - [x] `npm run test:gate:integration`
  - [x] `npx tsc --noEmit`
  - [x] `npm run lint`

## Dev Notes

### Story Foundation

- Epic 4 adds published shopping-list management with shared pricing/availability controls.
- Story 4.3 is the admin-side foundation for FR51 and prepares data structures needed by FR52/FR53 in shopper flows.
- This story is not purchase-time pooled decrement logic (that behavior is implemented in later shopper/purchase stories), but it must persist clean pooled metadata now.

### Developer Context Section

- Existing shopping-list implementation supports standard per-product rows with optional bundle pricing:
  - `src/domain/services/shopping-list-service.ts`
  - `src/app/(admin)/shopping-list.tsx`
  - `src/db/migrations/0007_shopping_list_bundle_offer.ts`
- Existing admin shopping-list screen already has:
  - owner-switch stale-response guards
  - submit locking (`create`/`update`/`remove`)
  - deterministic form validation and error messaging
- Existing schema currently models one `product_id` per shopping-list item; assorted groups require a many-member shape and shared quantity/pricing.
- No `project-context.md` file is currently present in the repository scan.

### Technical Requirements

- Add new owner-scoped persistence for assorted groups with shared pricing + shared availability.
- Recommended schema shape (aligned to current constraints and minimal regression risk):
  - `shopping_list_assorted_item`: `id`, `owner_id`, `name`, `quantity`, `unit_price_cents`, `bundle_qty`, `bundle_price_cents`, `created_at_ms`, `updated_at_ms`
  - `shopping_list_assorted_member`: `id`, `owner_id`, `assorted_item_id`, `product_id`, `created_at_ms`
- Required invariants:
  - `quantity > 0`, `unit_price_cents >= 0`
  - bundle pair rule: both null or both set
  - bundle bounds: `bundle_qty >= 2`, `bundle_price_cents > 0` when set
  - no duplicate product membership within the same assorted group
  - all member products must belong to the active owner and must not be archived
  - minimum member count for create/update: 2
- Service operations must be transactional for multi-row writes (group row + member rows).
- Keep all money values in centavos (`*_cents`) and timestamps in epoch ms (`*_at_ms`).

### Architecture Compliance

- Respect existing boundaries:
  - UI only in `src/app/**`
  - business rules and transactions in `src/domain/services/**`
  - schema/migrations in `src/db/**`
- Do not introduce SQL writes in UI components.
- Preserve owner-scoping guarantees for every read/write.
- Do not regress existing standard shopping-list and bundle-offer behavior from Stories 4.1 and 4.2.
- Keep route-group security boundaries intact (`(admin)` vs `(shopper)`).

### Library & Framework Requirements

- Stay on current project baselines from `package.json`:
  - `expo` `~55.0.4`
  - `expo-router` `~55.0.3`
  - `react-native` `0.83.2`
  - `expo-sqlite` `~55.0.10`
- Verified 2026-03-04:
  - Expo SDK 55 is the current stable SDK line.
  - React Native docs list 0.84 as current stable, so this repo’s 0.83.2 is one version behind but should not be upgraded inside this story.
  - SQLite still requires per-connection foreign-key enforcement and supports `CHECK` constraints used for pricing invariants.
- Story scope excludes framework or SDK upgrades.

### File Structure Requirements

- Primary files expected to change:
  - `src/db/schema.ts`
  - `src/db/db.ts`
  - `src/db/migrations/0008_shopping_list_assorted_groups.ts`
  - `src/domain/services/shopping-list-service.ts`
  - `src/domain/services/owner-data-service.ts`
  - `src/app/(admin)/shopping-list.tsx`
  - `tests/owner-scope-services.integration.test.tsx`
  - `tests/shopping-list-admin.integration.test.tsx`
  - `tests/shopping-list-assorted-migration.integration.test.tsx`
- Keep current file naming and service/export patterns consistent with prior stories.

### Testing Requirements

- Service integration coverage:
  - create assorted group with valid shared pricing/quantity + members
  - edit assorted group members, shared pricing, and shared quantity
  - reject create/edit with fewer than two members
  - reject duplicate members and cross-owner product references
  - reject archived products as assorted members
- Route integration coverage:
  - admin can create assorted group from shopping-list screen
  - admin can edit existing assorted group and persist changes
  - invalid assorted submissions show explicit guardrail messages and block submit
  - owner switch does not leak stale assorted state
- Migration coverage:
  - migration creates required tables/indexes/constraints idempotently
  - migration is safe on repeated bootstraps
- Regression expectations:
  - existing standard-item and bundle-offer tests remain green

### Previous Story Intelligence

From Story 4.2 (`_bmad-output/implementation-artifacts/4-2-configure-optional-bundle-offers.md`):
- Extend, do not replace, existing shopping-list patterns in `shopping-list-service.ts` and `shopping-list.tsx`.
- Keep deterministic invalid-input behavior for pricing fields (pair + bounds).
- Reuse migration safety pattern already used in `0007` (idempotent ensure + repair marker where needed).
- Preserve owner-switch stale response handling and submit-lock protections already implemented in the admin route.

### Git Intelligence Summary

Recent commit patterns show this feature area consistently changes:
- `src/app/(admin)/shopping-list.tsx`
- `src/domain/services/shopping-list-service.ts`
- `src/domain/services/owner-data-service.ts`
- `src/db/schema.ts` + incremental migration + migration registration in `src/db/db.ts`
- integration test files under `tests/`

Follow the same incremental and regression-first pattern for Story 4.3.

### Latest Tech Information (Verified 2026-03-04)

- Expo SDK 55 changelog confirms the active stable line: https://expo.dev/changelog/sdk-55
- Expo SDK 55 documentation set: https://docs.expo.dev/versions/v55.0.0/
- React Native release status page (0.84 currently listed as latest): https://reactnative.dev/docs/releases
- SQLite foreign key pragma reference: https://www.sqlite.org/pragma.html#pragma_foreign_keys
- SQLite `CREATE TABLE` and `CHECK` constraints reference: https://www.sqlite.org/lang_createtable.html

### Project Context Reference

- No `project-context.md` file found via repository scan pattern `**/project-context.md`.

### Story Completion Status

- Story context created and status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.3)
- `_bmad-output/planning-artifacts/prd.md` (FR51, FR52, FR53, AC14, AC15)
- `_bmad-output/planning-artifacts/architecture.md` (service boundaries, owner-scope architecture, file targets)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (assorted UX and guardrail behavior)
- `_bmad-output/implementation-artifacts/4-2-configure-optional-bundle-offers.md` (previous-story intelligence)
- `src/app/(admin)/shopping-list.tsx`
- `src/domain/services/shopping-list-service.ts`
- `src/domain/services/owner-data-service.ts`
- `src/db/schema.ts`
- `src/db/db.ts`
- `src/db/migrations/0007_shopping_list_bundle_offer.ts`
- `tests/shopping-list-admin.integration.test.tsx`
- `tests/owner-scope-services.integration.test.tsx`

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Workflow engine loaded: `_bmad/core/tasks/workflow.xml`
- Workflow config loaded: `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`
- Sprint status transitioned `4-3-create-and-manage-assorted-shopping-list-groups` from `ready-for-dev` → `in-progress` → `review`.
- Added assorted schema + migration wiring and transactional assorted-group service operations.
- Added admin assorted create/edit UX with member multi-select and stale-response protections.
- Executed quality gates: `npm run test:gate:integration`, `npx tsc --noEmit`, `npm run lint`.
- Review workflow executed: `_bmad/bmm/workflows/4-implementation/code-review/workflow.yaml`.
- Applied review fixes for assorted visibility under archived members, redundant assorted refresh calls, and owner-data standard-item targeting.
- Re-ran quality gates after review fixes: `npm run test:gate:integration`, `npx tsc --noEmit`, `npm run lint`.

### Completion Notes List

- Implemented owner-scoped assorted-group persistence (`shopping_list_assorted_item`, `shopping_list_assorted_member`) with constraints, indexes, and repair-safe migration bootstrap.
- Extended shopping-list domain services with `createAssortedShoppingListItem`, `listAssortedShoppingListItems`, `updateAssortedShoppingListItem`, and combined published-list reads that include assorted single-row entries.
- Updated admin shopping-list screen with assorted create/edit workflows, member selection toggles, and shared pricing/quantity management while preserving standard-item behaviors.
- Added regression coverage for assorted service flows, assorted admin route interactions, and assorted migration idempotency/repair behavior.
- Verified all quality gates pass on current workspace.
- Fixed review findings by keeping assorted groups visible when active member counts drop, removing redundant assorted refresh fetching, and ensuring owner-data edits target standard list items only.

### File List

- `src/db/schema.ts`
- `src/db/migrations/0008_shopping_list_assorted_groups.ts`
- `src/db/db.ts`
- `src/domain/services/shopping-list-service.ts`
- `src/domain/services/owner-data-service.ts`
- `src/app/(admin)/shopping-list.tsx`
- `src/app/(admin)/owner-data.tsx`
- `tests/owner-scope-services.integration.test.tsx`
- `tests/shopping-list-admin.integration.test.tsx`
- `tests/shopping-list-assorted-migration.integration.test.tsx`
- `tests/owner-data-scope.integration.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-3-create-and-manage-assorted-shopping-list-groups.md`

### Senior Developer Review (AI)

- Result: Changes requested and resolved.
- Resolved review finding 1: Owner-data first-item edit now explicitly targets the first standard shopping-list row before invoking `updateShoppingListItem`.
- Resolved review finding 2: Assorted-group listing no longer hides groups when active member count temporarily drops below two, enabling repair edits.
- Resolved review finding 3: Shopping-list refresh now uses `listShoppingListItems()` as the single source and removes redundant assorted fetch/error coupling.
- Validation after fixes: all integration tests, type checks, and lint pass.

### Change Log

- 2026-03-04: Added assorted shopping-list schema entities, migration 0008, bootstrap registration, assorted service contracts/validation, admin assorted workflows, and test coverage; story moved to `review`.
- 2026-03-04: Resolved code-review findings (assorted visibility, refresh-path simplification, owner-data standard-item edit targeting), added regression tests, and moved story to `done`.
