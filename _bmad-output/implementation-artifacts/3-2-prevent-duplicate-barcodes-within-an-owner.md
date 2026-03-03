# Story 3.2: Prevent Duplicate Barcodes Within an Owner

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want duplicate product barcodes blocked within the same owner,
so that scanning can identify a single product reliably.

## Acceptance Criteria

1. **Given** Owner A already has a product with barcode X
   **When** I attempt to create or update another Owner A product to barcode X
   **Then** the system blocks the save and shows a clear error (FR16).
2. **Given** Owner A and Owner B exist
   **When** Owner B creates a product using barcode X
   **Then** it is allowed and does not affect Owner A's product (FR17).

## Tasks / Subtasks

- [x] Enforce owner-scoped duplicate barcode blocking at the persistence boundary (AC: 1)
  - [x] Confirm uniqueness is enforced by DB schema/index for `(owner_id, lower(barcode))` and not only by UI checks.
  - [x] Ensure both create and update code paths produce the same deterministic conflict result/message.
  - [x] Keep behavior case-insensitive within owner scope (for example `ABC-1` vs `abc-1`).

- [x] Preserve cross-owner barcode independence (AC: 2)
  - [x] Verify duplicate barcode values are still permitted across different owners.
  - [x] Ensure owner context switching does not leak conflict state between owner A and owner B.

- [x] Keep admin product UX behavior consistent with story 3.1 guardrails (AC: 1, 2)
  - [x] Surface clear conflict feedback in create and edit forms.
  - [x] Preserve form inputs on conflict so the admin can quickly correct and retry.
  - [x] Do not introduce archive/delete behavior in this story (reserved for Story 3.3).

- [x] Strengthen automated coverage for duplicate-barcode rules (AC: 1, 2)
  - [x] Add/extend service tests for create conflict, update conflict, case-insensitive conflict, and cross-owner allowance.
  - [x] Add/extend route integration coverage for create/edit conflict presentation and cross-owner same-barcode success after owner switch.
  - [x] Keep existing owner-scope regression tests green (especially owner-switch + in-flight request isolation patterns from Story 3.1).

- [x] Run quality gates before handoff
  - [x] `npm run test:gate:integration`
  - [x] `npx tsc --noEmit`
  - [x] `npm run lint`

### Review Follow-ups (AI)

- [x] [AI-Review][MEDIUM] Narrow duplicate-barcode conflict mapping to detect `idx_product_owner_barcode_unique` specifically (avoid misclassifying future UNIQUE failures). [src/domain/services/product-service.ts:65]
- [x] [AI-Review][MEDIUM] Update duplicate-barcode tests to use SQLite expression-index error shape (`UNIQUE constraint failed: index 'idx_product_owner_barcode_unique'`). [tests/owner-scope-services.integration.test.tsx:331]
- [x] [AI-Review][LOW] Add this story file to git (`git add`) so review context is versioned like prior stories. [_bmad-output/implementation-artifacts/3-2-prevent-duplicate-barcodes-within-an-owner.md]

## Dev Notes

### Story Foundation

- Epic 3 objective: per-owner product catalog management with deterministic barcode identity.
- Story 3.1 already delivered the dedicated admin products route, owner-context race guards, and conflict-friendly form behavior.
- Story 3.2 must lock down the barcode uniqueness rule as a stable invariant:
  - Block duplicates within the same owner (FR16).
  - Allow same barcode across different owners (FR17).
- Story 3.3 (archive/delete) depends on this invariant staying intact during product lifecycle changes.
- Source: `_bmad-output/planning-artifacts/epics.md` (Epic 3, Story 3.2).

### Technical Requirements

- Keep owner-scoped uniqueness enforced in SQLite using the existing unique expression index at schema level.
- Continue normalized input behavior (`trim`) before writes so conflict checks are applied to canonical values.
- Ensure create/update conflict mapping stays consistent:
  - service code should return `OWNER_SCOPE_CONFLICT`
  - message: `A product with this barcode already exists for the active owner.`
- Ensure same barcode remains valid across owners by preserving owner scoping in all write/read paths.
- Preserve non-conflict behavior from Story 3.1:
  - stable owner switch state
  - no stale response leakage
  - no direct DB writes from route components
- Relevant sources:
  - `src/db/schema.ts`
  - `src/domain/services/product-service.ts`
  - `src/app/(admin)/products.tsx`
  - `tests/owner-scope-services.integration.test.tsx`
  - `tests/owner-data-scope.integration.test.tsx`

### Architecture Compliance

- Keep write-path architecture boundaries intact:
  - UI in `src/app/(admin)/products.tsx` orchestrates state and user feedback only.
  - business rules and conflict mapping remain in `src/domain/services/product-service.ts`.
  - persistence constraints remain in `src/db/schema.ts` and migrations.
- Do not bypass DB uniqueness with ad hoc pre-check-only logic; DB is the source of truth for duplicate safety.
- Keep owner-scope enforcement unchanged (`requireActiveOwnerContext` pattern); no cross-owner read/write side effects.
- Keep result/error contract stable for UI handling (`OwnerScopeResult` with deterministic `error.code`).
- Continue timestamp conventions (`created_at_ms`, `updated_at_ms`) and ordering patterns used by list views.
- Source:
  - `_bmad-output/planning-artifacts/architecture.md` (Data Architecture, Boundaries, Naming Patterns)
  - `src/domain/services/owner-scope.ts`

### Library & Framework Requirements

- Maintain current stack and version line already used in this repository:
  - Expo SDK 55 (`expo ~55.0.4`)
  - React 19.2.0 / React Native 0.83.2
  - `expo-sqlite ~55.0.10`
- This story should not introduce additional persistence libraries; use existing `expo-sqlite` service pathway.
- If any index/query change is required, align to SQLite expression-index rules (`lower(barcode)` expression consistency).
- Keep changes compatible with current service and test tooling (Jest + TypeScript + Expo lint).

### File Structure Requirements

- Primary expected change targets:
  - `src/domain/services/product-service.ts`
  - `src/db/schema.ts` (and migration files only if schema changes are needed)
  - `src/app/(admin)/products.tsx`
  - `tests/owner-scope-services.integration.test.tsx`
  - `tests/owner-data-scope.integration.test.tsx`
- Keep non-target files stable unless required by tests/refactors.
- Do not move product domain logic out of `src/domain/services`.
- Do not place SQL write logic in route components.

### Testing Requirements

- Service-level assertions:
  - create conflict when same owner attempts duplicate barcode.
  - update conflict when changing to a barcode already used by another product of same owner.
  - case-insensitive conflict when only letter case differs.
  - same barcode allowed when products belong to different owners.
- Route-level assertions (`/products`):
  - create conflict error message is shown and create inputs remain editable.
  - update conflict error message is shown and edit inputs remain editable.
  - owner switch still allows same barcode in a different owner context.
  - no stale-owner conflict/result leaks during owner switches.
- Regression + gates:
  - Run full integration suite and ensure Story 3.1 regressions stay green.
- `npm run test:gate:integration`
- `npx tsc --noEmit`
- `npm run lint`

### Previous Story Intelligence (Story 3.1)

- Story 3.1 introduced a dedicated `/products` admin route with owner-context protections and deterministic refresh handling.
- The implementation already uses conflict-safe UX patterns:
  - preserve create/edit inputs on conflict
  - surface conflict message clearly
  - avoid stale owner response leaks on owner switch
- Apply the same quality bar in Story 3.2:
  - never regress owner-switch race protections
  - keep conflict handling deterministic for both create and update
  - keep route behavior stable under transient refresh failures
- Reuse established testing style from Story 3.1:
  - owner-scope route integration assertions
  - service-layer conflict mapping assertions
- Primary source:
  - `_bmad-output/implementation-artifacts/3-1-create-and-edit-products-name-barcode.md`

### Git Intelligence Summary

Recent commits indicate strong current patterns around owner scoping and product-route reliability:

- `1135246`: Story 3.1 completion touched:
  - `src/app/(admin)/products.tsx`
  - `src/domain/services/owner-data-service.ts`
  - `tests/owner-data-scope.integration.test.tsx`
  - `tests/owner-scope-services.integration.test.tsx`
- Earlier commits (`24f5953`, `c9c3244`) reinforced strict uniqueness/conflict handling patterns in adjacent shopper PIN features.

Actionable guidance:
- Extend existing product-service + `/products` patterns instead of creating parallel duplicate-check paths.
- Maintain the repository's regression-first style: add/adjust tests in existing suites, then implement/fix.

### Latest Tech Information (Verified 2026-03-03)

- Expo SDK 55 is the current stable line and was announced on **February 25, 2026**; it ships with React 19 and React Native 0.83.
  - Source: https://expo.dev/changelog/sdk-55
- Expo SQLite SDK 55 docs continue to support async/sync DB usage (`openDatabaseSync`, `runAsync`, prepared statements) and remain the canonical implementation reference for this project line.
  - Source: https://docs.expo.dev/versions/v55.0.0/sdk/sqlite/
- Drizzle's Expo integration guidance continues to use Expo SQLite driver patterns (relevant if future typed-schema migration work is added around product queries).
  - Source: https://orm.drizzle.team/docs/connect-expo-sqlite
- SQLite expression-index rules require query/index expression consistency; keep `lower(barcode)` usage consistent for case-insensitive uniqueness semantics.
  - Source: https://www.sqlite.org/expridx.html
- SQLite unique index semantics remain the authoritative conflict behavior boundary for duplicate prevention.
  - Source: https://www.sqlite.org/lang_createindex.html

### Project Structure Notes

- Existing product CRUD route and owner-context state machinery are already in place from Story 3.1.
- Story 3.2 should be an invariant-hardening story (duplicate rule precision + tests), not a route architecture rewrite.
- Keep Story 3.3 scope (archive/delete) out of this implementation.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 3, Story 3.2, FR16, FR17)
- `_bmad-output/planning-artifacts/prd.md` (FR16, FR17 product behavior requirements)
- `_bmad-output/planning-artifacts/architecture.md` (boundaries, data architecture, conventions)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (admin clarity/error feedback patterns)
- `_bmad-output/implementation-artifacts/3-1-create-and-edit-products-name-barcode.md`
- `src/db/schema.ts`
- `src/domain/services/product-service.ts`
- `src/domain/services/owner-data-service.ts`
- `src/app/(admin)/products.tsx`
- `tests/owner-scope-services.integration.test.tsx`
- `tests/owner-data-scope.integration.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Web references:
  - https://expo.dev/changelog/sdk-55
  - https://docs.expo.dev/versions/v55.0.0/sdk/sqlite/
  - https://orm.drizzle.team/docs/connect-expo-sqlite
  - https://www.sqlite.org/expridx.html
  - https://www.sqlite.org/lang_createindex.html

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
- Story selected from sprint backlog order: `3-2-prevent-duplicate-barcodes-within-an-owner`
- Validation task fallback: `_bmad/core/tasks/validate-workflow.xml` not present in repository, so manual checklist validation was performed.
- Dev workflow loaded: `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`
- Dev instructions loaded: `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml`
- Regression and quality gates executed: `npm run test:gate:integration`, `npx tsc --noEmit`, `npm run lint`

### Implementation Plan

- Extend service-level tests to explicitly validate owner-scoped barcode uniqueness guarantees:
  - DB index expression remains `(owner_id, lower(barcode))`
  - update flow maps duplicate conflicts to deterministic `OWNER_SCOPE_CONFLICT`
  - conflict state does not leak across owner context switches
- Extend route integration tests for `/products` to validate owner-scoped conflict behavior and cross-owner barcode reuse after owner switch.
- Preserve existing production code path and architecture boundaries; use tests to lock the invariant for Story 3.2 and guard against regressions from Story 3.1.

### Completion Notes List

- Created Story 3.2 context with explicit FR16/FR17 guardrails.
- Included architecture and file-level implementation boundaries for owner-scoped duplicate enforcement.
- Added previous-story intelligence and git-pattern guidance from Story 3.1 and latest commits.
- Added latest technical reference links relevant to Expo SDK 55, Expo SQLite, Drizzle Expo integration, and SQLite uniqueness/index semantics.
- Updated sprint tracking status for this story to `ready-for-dev`.
- Added service integration coverage for Story 3.2:
  - schema-level owner-scoped unique index assertion using `lower(barcode)`
  - deterministic update conflict mapping for duplicate barcode collisions
  - cross-owner same-barcode allowance after an owner-A conflict
- Added route integration coverage for owner-scoped conflict handling and cross-owner same-barcode success after owner switch.
- Verified quality gates pass with no regressions:
  - `npm run test:gate:integration` (12 suites, 126 tests passed)
  - `npx tsc --noEmit` (passed)
  - `npm run lint` (passed)
- Story status moved to `review`.
- ✅ Resolved review finding [MEDIUM]: Barcode-duplicate conflict mapping now detects `idx_product_owner_barcode_unique` and falls back to a generic conflict for other UNIQUE failures.
- ✅ Resolved review finding [MEDIUM]: Duplicate-barcode tests now simulate the SQLite expression-index conflict message shape.
- ✅ Resolved review finding [LOW]: Story 3.2 markdown file is now tracked in git for review/PR visibility.

### File List

- `_bmad-output/implementation-artifacts/3-2-prevent-duplicate-barcodes-within-an-owner.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/domain/services/product-service.ts`
- `tests/owner-scope-services.integration.test.tsx`
- `tests/owner-data-scope.integration.test.tsx`

### Change Log

- 2026-03-03: Implemented Story 3.2 validation coverage updates for owner-scoped duplicate barcode enforcement, deterministic conflict handling, and cross-owner barcode reuse safeguards; executed full integration/type/lint quality gates.
- 2026-03-03: Addressed code review findings (3 items resolved): narrowed barcode conflict mapping, updated duplicate-barcode error fixtures, tracked story markdown; re-ran `npm run test:gate:integration`, `npx tsc --noEmit`, `npm run lint`.
- 2026-03-03: Code review follow-up complete; action items verified resolved; story status moved to `done`.
- 2026-03-03: Re-ran `bmad-bmm-code-review` re-validation for Story 3.2; no new HIGH/MEDIUM findings; quality gates reconfirmed (`npm run test:gate:integration` = 12 suites / 127 tests passed, `npx tsc --noEmit`, `npm run lint`).

## Senior Developer Review (AI)

**Date:** 2026-03-03
**Reviewer:** GPT-5.2 (Codex)
**Outcome:** Changes Requested

### Scope

- Story file: `_bmad-output/implementation-artifacts/3-2-prevent-duplicate-barcodes-within-an-owner.md`
- Git changes reviewed: `tests/owner-scope-services.integration.test.tsx`, `tests/owner-data-scope.integration.test.tsx`, `_bmad-output/implementation-artifacts/sprint-status.yaml`

### Acceptance Criteria Check

- AC1 (block duplicates within owner): Implemented via DB unique expression index `(owner_id, lower(barcode))` + service-level conflict mapping + UI error surfacing.
- AC2 (allow cross-owner same barcode): Implemented via owner-scoped uniqueness + owner-context isolation in service/UI.

### Findings

- **MEDIUM:** `src/domain/services/product-service.ts` currently maps any `UNIQUE constraint failed` to the barcode-conflict message; tighten detection to the specific barcode index to avoid future false positives.
- **MEDIUM:** Tests simulate `UNIQUE constraint failed: product.owner_id, product.barcode` but SQLite expression-index violations commonly surface as `UNIQUE constraint failed: index 'idx_product_owner_barcode_unique'`; update test fixtures for realism.
- **LOW:** Story file is currently untracked; add it to git so the review context is versioned consistently with prior stories.

### Action Items

- [x] [MEDIUM] Narrow duplicate-barcode conflict mapping to detect `idx_product_owner_barcode_unique` specifically. [src/domain/services/product-service.ts:65]
- [x] [MEDIUM] Update duplicate-barcode tests to use SQLite expression-index error shape. [tests/owner-scope-services.integration.test.tsx:331]
- [x] [LOW] Add this story file to git (`git add`). [_bmad-output/implementation-artifacts/3-2-prevent-duplicate-barcodes-within-an-owner.md]

### Review Follow-up Status

All action items above are resolved; ready for re-review.

### Follow-up Review (AI)

**Date:** 2026-03-03
**Outcome:** Approved
**Notes:** Verified action items resolved; quality gates confirmed (`npm run test:gate:integration`, `npx tsc --noEmit`, `npm run lint`).

### Re-validation Review (AI)

**Date:** 2026-03-03
**Reviewer:** GPT-5 (Codex)
**Outcome:** Approved

#### Re-validation Scope

- Story artifact and AC/tasks traceability: `_bmad-output/implementation-artifacts/3-2-prevent-duplicate-barcodes-within-an-owner.md`
- Story-listed implementation files: `src/domain/services/product-service.ts`, `tests/owner-scope-services.integration.test.tsx`, `tests/owner-data-scope.integration.test.tsx`
- Story-listed tracking file: `_bmad-output/implementation-artifacts/sprint-status.yaml`
- Git working set cross-check: file list matches live changes; no undocumented source-code deltas for this story scope.

#### Re-validation Findings

- No new HIGH, MEDIUM, or LOW issues found in Story 3.2 scope.
- AC1 and AC2 remain satisfied:
  - Owner-scoped duplicate blocking is enforced by DB unique expression index + deterministic conflict mapping.
  - Cross-owner barcode reuse remains allowed and covered by service/route test assertions.

#### Fresh Gate Evidence

- `npm run test:gate:integration` → PASS (12 suites, 127 tests)
- `npx tsc --noEmit` → PASS
- `npm run lint` → PASS
