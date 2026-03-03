# Story 3.1: Create and Edit Products (Name + Barcode)

Status: ready-for-dev

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

- [ ] Build a dedicated admin product-management flow for create/edit (AC: 1, 2)
  - [ ] Add a products route under `src/app/(admin)/` (for example `products.tsx`) with list, create form, and edit form state.
  - [ ] Add dashboard navigation entry to the products flow without removing existing admin flows.
  - [ ] Keep owner-context visibility prominent in the products UI and show explicit guard copy if no active owner is selected.

- [ ] Wire product-management UI to existing domain services (AC: 1, 2)
  - [ ] Use `listProducts`, `createProduct`, and `updateProduct` through `src/domain/services/owner-data-service.ts` exports.
  - [ ] Refresh product list deterministically after successful create/edit operations.
  - [ ] Preserve current owner-scope error handling style and map service errors to clear UI feedback.

- [ ] Apply product input validation and submit guardrails (AC: 1, 2)
  - [ ] Validate trimmed `name` and `barcode` inputs before submit to avoid avoidable round trips.
  - [ ] Keep create/edit submit buttons locked while in-flight to prevent duplicate writes.
  - [ ] Preserve user input on failure and display actionable error messages (including duplicate-barcode conflicts returned by services).

- [ ] Preserve architecture boundaries and avoid scope creep (AC: 1, 2)
  - [ ] Do not perform direct SQLite writes from route components; keep writes in domain services.
  - [ ] Do not introduce archive/delete flows in this story (reserved for Story 3.3).
  - [ ] Do not change cross-owner duplicate policy behavior beyond existing service/schema constraints (Story 3.2 formalizes this area).

- [ ] Expand automated coverage for product create/edit behavior (AC: 1, 2)
  - [ ] Add UI integration coverage for the products route (or extend owner-data integration coverage if route split is deferred) to verify create/edit behavior and list reflection.
  - [ ] Extend service-level tests for successful `createProduct`/`updateProduct` and required input validation.
  - [ ] Include owner-scope regression assertions so create/edit never affects records outside the active owner.

- [ ] Run quality gates before handoff
  - [ ] `npm run test:gate:integration`
  - [ ] `npx tsc --noEmit`
  - [ ] `npm run lint`

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

### Debug Log References

- Workflow engine loaded: `_bmad/core/tasks/workflow.xml`
- Workflow config loaded: `_bmad/bmm/workflows/4-implementation/create-story/workflow.yaml`
- Story instructions loaded: `_bmad/bmm/workflows/4-implementation/create-story/instructions.xml`
- Story selected from sprint status backlog order: `3-1-create-and-edit-products-name-barcode`
- Discovery results:
  - `epics_content`: 1 file (`_bmad-output/planning-artifacts/epics.md`)
  - `prd_content`: 2 files (`_bmad-output/planning-artifacts/prd.md`, `_bmad-output/planning-artifacts/prd.validation-report.md`)
  - `architecture_content`: 1 file (`_bmad-output/planning-artifacts/architecture.md`)
  - `ux_content`: 1 file (`_bmad-output/planning-artifacts/ux-design-specification.md`)
  - `project_context`: not found

### Completion Notes List

- Completed exhaustive artifact analysis for Epic 3 and Story 3.1 context.
- Added architecture and codebase-specific guardrails to prevent owner-scope and structure regressions.
- Added latest-technology references from primary documentation sources for implementation safety.

### File List

- `_bmad-output/implementation-artifacts/3-1-create-and-edit-products-name-barcode.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
