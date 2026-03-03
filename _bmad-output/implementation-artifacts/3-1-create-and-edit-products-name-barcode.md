# Story 3.1: Create and Edit Products (Name + Barcode)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,  
I want to create and edit products with a name and barcode,  
so that my store's catalog is accurate for shopping list publishing.

## Acceptance Criteria

1. **Given** I am logged in as admin and an owner is active  
   **When** I create a product with a name and barcode  
   **Then** the product appears in the active owner's product list (FR13).
2. **Given** a product exists  
   **When** I update its name or barcode  
   **Then** the changes are saved and reflected in the product list (FR14).

## Tasks / Subtasks

- [x] Build a dedicated admin product-management flow for create/edit (AC: 1, 2)
  - [x] Add a products route under `src/app/(admin)/` (for example `products.tsx`) with list, create form, and edit form state.
  - [x] Add dashboard navigation entry to the products flow without removing existing admin flows.
  - [x] Keep owner-context visibility prominent in the products UI and show explicit guard copy if no active owner is selected.

- [x] Wire product-management UI to existing domain services (AC: 1, 2)
  - [x] Use `listProducts`, `createProduct`, and `updateProduct` through `src/domain/services/owner-data-service.ts` exports.
  - [x] Refresh product list deterministically after successful create/edit operations.
  - [x] Preserve current owner-scope error handling style and map service errors to clear UI feedback.

- [x] Apply product input validation and submit guardrails (AC: 1, 2)
  - [x] Validate trimmed `name` and `barcode` inputs before submit to avoid avoidable round trips.
  - [x] Keep create/edit submit buttons locked while in-flight to prevent duplicate writes.
  - [x] Preserve user input on failure and display actionable error messages (including duplicate-barcode conflicts returned by services).

- [x] Preserve architecture boundaries and avoid scope creep (AC: 1, 2)
  - [x] Do not perform direct SQLite writes from route components; keep writes in domain services.
  - [x] Do not introduce archive/delete flows in this story (reserved for Story 3.3).
  - [x] Do not change cross-owner duplicate policy behavior beyond existing service/schema constraints (Story 3.2 formalizes this area).

- [x] Expand automated coverage for product create/edit behavior (AC: 1, 2)
  - [x] Add UI integration coverage for the products route (or extend owner-data integration coverage if route split is deferred) to verify create/edit behavior and list reflection.
  - [x] Extend service-level tests for successful `createProduct`/`updateProduct` and required input validation.
  - [x] Include owner-scope regression assertions so create/edit never affects records outside the active owner.

- [x] Run quality gates before handoff
  - [x] `npm run test:gate:integration`
  - [x] `npx tsc --noEmit`
  - [x] `npm run lint`

### Review Follow-ups (AI)

- [x] [AI-Review][Medium] Harden create/edit submit locking with a synchronous ref-based guard so rapid double-taps cannot bypass state-based button disabling. [src/app/(admin)/products.tsx:110]
- [x] [AI-Review][Medium] Replace the products `ScrollView` list rendering with a virtualized list to preserve responsiveness for larger owner catalogs. [src/app/(admin)/products.tsx:188]
- [x] [AI-Review][Low] Add `/products` owner-scope regression tests that switch owners after create/edit and add an update-conflict UI assertion path. [tests/owner-data-scope.integration.test.tsx:392]
- [x] [AI-Review][High] Prevent stale async owner-scope refresh results from older owner contexts from overwriting current owner product state after owner switching. [src/app/(admin)/products.tsx:58]
- [x] [AI-Review][Medium] Guard create/edit success state updates so in-flight operations started under a previous owner cannot repopulate edit fields after owner context changes. [src/app/(admin)/products.tsx:148]
- [x] [AI-Review][Medium] Add a `/products` regression test that switches owners while create/list requests are still in flight to catch cross-owner stale-response leaks. [tests/owner-data-scope.integration.test.tsx:569]
- [x] [AI-Review][High] Add explicit determinism assertions in the `/products` create/edit integration test to verify `listProducts` call sequencing/count and catch duplicate refetch regressions. [tests/owner-data-scope.integration.test.tsx:406]
- [x] [AI-Review][Medium] Remove `selectedProductId`-driven `refreshProducts` callback churn so selection changes do not retrigger list fetches and create flow does not double-refresh. [src/app/(admin)/products.tsx:122]
- [x] [AI-Review][Medium] Preserve visible products and edit selection on transient `listProducts` refresh failures instead of clearing state. [src/app/(admin)/products.tsx:82]

## Dev Notes

### Story Foundation

- Epic 3 starts product-catalog work; Story 3.1 is the functional baseline for product create/edit.
- Story 3.2 (duplicate barcode rules) and Story 3.3 (archive/delete) build on this story's product-management UX and service usage.
- The repository already has product domain service methods and product schema/index scaffolding, so this story should prioritize completing admin workflow quality and coverage, not reinventing domain primitives.

### Technical Requirements

- Product write payloads must contain non-empty trimmed `name` and `barcode`.
- Product creates/updates must remain strictly owner-scoped through active admin owner context.
- Product list updates must be visible immediately after successful create/edit.
- Persisted timestamps remain `created_at_ms`/`updated_at_ms` integer milliseconds.
- Service-facing error contract remains `OwnerScopeResult` with stable error codes/messages.

### Architecture Compliance

- Keep admin route-level session protection through `src/app/(admin)/_layout.tsx`.
- Keep business logic and DB writes in `src/domain/services/**`; UI should orchestrate only.
- Continue owner isolation enforcement through `requireActiveOwnerContext()` in owner-scoped services.
- Reuse existing schema/index constraints in `src/db/schema.ts`; avoid ad hoc duplicate-check queries that diverge from DB constraints.

### Library & Framework Requirements

- Continue current Expo Router + React Native + TypeScript stack already used in admin routes.
- Continue using `expo-sqlite` through existing `bootstrapDatabase()` and `getDb()` service pathway.
- Keep existing dependencies unless a clear gap is proven; do not add form/state libraries for this story unless necessary.

### File Structure Requirements

- Primary implementation targets:
  - `src/app/(admin)/products.tsx` (new route expected for focused product CRUD UX)
  - `src/app/(admin)/dashboard.tsx` (navigation entry)
  - `src/domain/services/owner-data-service.ts` (reuse/export integration surface)
  - `tests/owner-data-scope.integration.test.tsx` (UI route integration coverage)
  - `tests/owner-scope-services.integration.test.tsx` (service regression/success coverage)
- Existing files expected to remain authoritative:
  - `src/domain/services/product-service.ts`
  - `src/db/schema.ts`

### Testing Requirements

- Positive flow:
  - Create product with valid name/barcode and verify product appears in active-owner list.
  - Edit existing product name/barcode and verify list reflects latest values.
- Negative flow:
  - Empty/whitespace name or barcode is rejected with explicit validation feedback.
  - Service conflict errors (duplicate barcode within owner) surface clear user feedback.
- Isolation/regression:
  - Product create/edit actions never read or mutate records outside active owner scope.
  - Existing owner-data and shopper flows remain unaffected after product-route additions.

### Latest Tech Information (verified 2026-03-03)

- Expo SDK 55 is the current stable SDK line (released on February 25, 2026), and the repository is already aligned to SDK 55 package expectations.  
  Source: https://expo.dev/changelog/sdk-55
- Expo SQLite SDK 55 docs remain the authoritative implementation reference for local SQLite usage in this app.  
  Source: https://docs.expo.dev/versions/v55.0.0/sdk/sqlite/
- Drizzle's Expo SQLite integration guidance (for planned typed-query adoption) still uses the Expo SQLite driver with migration hooks; align any future migration to that documented path rather than custom forks.  
  Source: https://orm.drizzle.team/docs/connect-expo-sqlite
- SQLite expression-index behavior requires query expressions to match indexed expressions (for example `lower(barcode)`); keep this in mind when adding any explicit duplicate-check reads.  
  Source: https://www.sqlite.org/expridx.html
- SQLite UNIQUE index semantics remain the source of truth for duplicate prevention and should be preferred over UI-only checks.  
  Source: https://www.sqlite.org/lang_createindex.html

### Project Structure Notes

- Current admin flow already includes `owners`, `owner-data`, and `dashboard`; Story 3.1 should extend this structure with a focused products route rather than bloating existing utility screens.
- Product domain logic is already centralized in `product-service.ts`; avoid duplicating product SQL in route modules.
- No `project-context.md` file was discovered in the repository scan.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 3, Story 3.1)
- `_bmad-output/planning-artifacts/prd.md` (FR13, FR14, owner-scoped requirements)
- `_bmad-output/planning-artifacts/architecture.md` (Project Structure & Boundaries, Implementation Patterns)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (Admin flow UX guardrails and clarity requirements)
- `src/domain/services/product-service.ts`
- `src/domain/services/owner-data-service.ts`
- `src/domain/services/owner-scope.ts`
- `src/db/schema.ts`
- `src/app/(admin)/dashboard.tsx`
- `src/app/(admin)/owner-data.tsx`
- `tests/owner-data-scope.integration.test.tsx`
- `tests/owner-scope-services.integration.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Project Context Reference

- No `project-context.md` file was discovered in repository scan.

### Story Completion Status

- Story context created and status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Implementation Plan

- Introduce a dedicated `/products` admin route that is owner-context aware and keeps product CRUD orchestration in the UI layer only.
- Reuse owner-scoped domain operations through `owner-data-service` exports (`listProducts`, `createProduct`, `updateProduct`) to avoid direct DB access.
- Add deterministic list refresh after successful create/edit while preserving user input and surfacing service error messages on failures.
- Expand route integration and service-level tests first, then implement until all quality gates pass.

### Debug Log References

- Workflow engine loaded: `_bmad/core/tasks/workflow.xml`
- Workflow config loaded: `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`
- Story instructions loaded: `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml`
- Story selected from sprint status backlog order: `3-1-create-and-edit-products-name-barcode`
- Sprint status transition: `ready-for-dev` → `in-progress` → `review`
- Tests-first execution:
  - `npm run test:gate:integration -- tests/owner-data-scope.integration.test.tsx tests/owner-scope-services.integration.test.tsx` (red/green iterations)
  - `npm run test:gate:integration` (full regression)
  - `npx tsc --noEmit`
  - `npm run lint`
- Review follow-up implementation cycle:
  - `npm run test:gate:integration -- tests/owner-data-scope.integration.test.tsx` (review follow-up coverage)
  - `npm run test:gate:integration` (full regression re-run)
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm run test:gate:integration -- tests/owner-data-scope.integration.test.tsx` (owner-switch race regression red/green)
  - `npm run test:gate:integration` (full regression after stale-response guard fixes)
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm run test:gate:integration -- tests/owner-data-scope.integration.test.tsx` (deterministic refresh assertion + transient refresh failure regression)
  - `npm run test:gate:integration` (full regression after final review follow-up fixes)
  - `npx tsc --noEmit`
  - `npm run lint`
  - `npm run test:gate:integration -- tests/owner-data-scope.integration.test.tsx` (owner-switch refresh-failure isolation regression)
  - `npm run test:gate:integration` (full regression after adversarial code review fixes)
  - `npx tsc --noEmit`
  - `npm run lint`

### Completion Notes List

- Added dedicated admin products route at `src/app/(admin)/products.tsx` with owner-context visibility, guard copy, create/edit form state, deterministic refresh, and in-flight submit locking.
- Added dashboard navigation entry for products flow while preserving existing Owners and Owner Data routes.
- Reused owner-scoped services through `owner-data-service` by exporting and consuming `listProducts` alongside `createProduct` and `updateProduct`.
- Preserved architecture boundaries: no direct SQLite route writes, no archive/delete scope expansion, and duplicate handling remains governed by service/schema constraints.
- Extended UI integration tests for `/products` create/edit flows, validation/error behavior, and owner guard coverage.
- Extended owner-scope service tests for successful `createProduct`/`updateProduct` with trimmed inputs and invalid input rejection.
- Executed required quality gates successfully (`test:gate:integration`, `tsc --noEmit`, `lint`).
- ✅ Resolved review finding [Medium]: Added a synchronous ref lock (`submitLockRef`) to guard create/edit submits from rapid double-taps before state commits.
- ✅ Resolved review finding [Medium]: Replaced products `ScrollView` list mapping with a `FlatList` virtualized list rendering path.
- ✅ Resolved review finding [Low]: Added `/products` owner-scope regression tests for owner-switch isolation after create/edit and update-conflict UI assertions.
- ✅ Resolved review finding [High]: Added owner-context version and refresh-request sequencing guards so stale `listProducts` results cannot overwrite current-owner state after owner switches.
- ✅ Resolved review finding [Medium]: Guarded create/update success and error UI updates behind owner-context version checks so in-flight results from prior owner contexts are ignored.
- ✅ Resolved review finding [Medium]: Added `/products` race-condition regression tests for in-flight list/create/update operations during owner switching.
- ✅ Resolved review finding [High]: Added deterministic `/products` integration assertions for `listProducts` invocation count and mutation-to-refresh sequencing after create/edit.
- ✅ Resolved review finding [Medium]: Removed `selectedProductId`-driven `refreshProducts` callback churn by tracking selection via ref and stabilizing refresh callback dependencies.
- ✅ Resolved review finding [Medium]: Preserved visible product list and edit form state on transient refresh failures by keeping existing UI state and surfacing refresh errors without clearing products.
- ✅ Resolved review finding [High]: Prevented cross-owner product visibility leaks by resetting owner-scoped product/edit/create UI state immediately on owner changes before any refresh attempt.
- ✅ Resolved review finding [Medium]: Cleared stale create-form drafts on owner switches so pending values from a prior owner cannot be accidentally submitted under a different owner context.
- ✅ Resolved review finding [Medium]: Added owner-switch refresh-failure regression coverage to assert stale product rows and stale edit/create form state are not retained.

### File List

- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/app/(admin)/products.tsx`
- `src/app/(admin)/dashboard.tsx`
- `src/domain/services/owner-data-service.ts`
- `tests/owner-data-scope.integration.test.tsx`
- `tests/owner-scope-services.integration.test.tsx`
- `_bmad-output/implementation-artifacts/3-1-create-and-edit-products-name-barcode.md`

### Change Log

- 2026-03-03: Implemented Story 3.1 product-management flow (`/products`) with owner-scoped create/edit, deterministic refresh, validation/in-flight guards, and expanded integration/service test coverage. Story and sprint status moved to `review`.
- 2026-03-03: Senior Developer Review (AI) completed. Outcome set to Changes Requested; story and sprint status moved to `in-progress` with follow-up action items.
- 2026-03-03: Addressed code review findings - 3 items resolved (synchronous submit lock hardening, virtualized products list, expanded owner-scope/update-conflict route tests). Story and sprint status moved to `review`.
- 2026-03-03: Senior Developer Review (AI) rerun after follow-up implementation. Outcome remains Changes Requested due unresolved owner-switch stale-response race conditions; story and sprint status moved to `in-progress`.
- 2026-03-03: Addressed remaining code review findings - 3 items resolved (stale refresh overwrite guard, stale create/update success-state guard, in-flight owner-switch race regression tests). Story and sprint status moved to `review`.
- 2026-03-03: Senior Developer Review (AI) rerun. Outcome remains Changes Requested; added three follow-up action items for deterministic refresh assertions, selection-triggered refetch elimination, and transient refresh error state preservation. Story and sprint status moved to `in-progress`.
- 2026-03-03: Addressed final code review findings - 3 items resolved (deterministic `listProducts` sequencing assertions, refresh callback churn removal, transient refresh failure state preservation). Story and sprint status moved to `review`.
- 2026-03-03: Adversarial code review found and fixed 3 additional issues (cross-owner stale list leakage on owner-switch refresh failure, stale create draft retention, stale edit/create state retention). Story and sprint status moved to `done`.

## Senior Developer Review (AI)

### Reviewer

- myjmyj

### Date

- 2026-03-03

### Outcome

- Changes Requested

### Findings

1. **[High] Stale owner-scope list results can overwrite current owner state after owner switching.**  
   `refreshProducts` always applies response data (`setProducts`) without verifying that the response still belongs to the currently active owner context. If owner A and owner B refresh requests overlap, the slower response can win and show the wrong owner's product list under the current owner header.  
   Evidence: `src/app/(admin)/products.tsx:58-95`, `src/app/(admin)/products.tsx:97-109`.
2. **[Medium] In-flight create/update success handlers can repopulate edit fields from a previous owner context.**  
   `onCreateProduct` and `onUpdateProduct` write `selectedProductId`/`editName`/`editBarcode` after awaited service calls without checking whether the active owner changed during the request. This can leak stale owner product details into the edit form after context switches.  
   Evidence: `src/app/(admin)/products.tsx:148-153`, `src/app/(admin)/products.tsx:196-198`.
3. **[Medium] Regression suite does not cover owner-switch while product requests are in-flight.**  
   Current `/products` tests validate owner switching only after settled create/edit flows, so they would not catch stale-response race conditions in refresh/mutation callbacks.  
   Evidence: `tests/owner-data-scope.integration.test.tsx:569-605`.

### Validation Notes

- Git vs story file-list discrepancy count: **0**.
- Revalidated quality gates during review:
  - `npm run test:gate:integration -- tests/owner-data-scope.integration.test.tsx tests/owner-scope-services.integration.test.tsx` (pass, 2 suites / 37 tests)
  - `npx tsc --noEmit` (pass)
  - `npm run lint` (pass)

### Follow-up Review (AI) - Latest

- Date: 2026-03-03
- Outcome: Approved
- Fixed in this pass: 1 High, 2 Medium
- Remaining High/Medium issues: 0
- Git vs story file-list discrepancy count: 0
- Validation rerun:
  - `npm run test:gate:integration -- tests/owner-data-scope.integration.test.tsx` (pass, 1 suite / 14 tests)
  - `npm run test:gate:integration` (pass, 12 suites / 122 tests)
  - `npx tsc --noEmit` (pass)
  - `npm run lint` (pass)
