# Story 4.2: Configure Optional Bundle Offers

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->
## Story

As an admin,
I want to configure bundle offers on shopping list items,
so that pricing rules like "3 for ₱5" are supported.

## Acceptance Criteria

1. **Given** I am creating or editing a shopping list item  
   **When** I define a bundle offer with bundle quantity and bundle price  
   **Then** the offer is saved with the shopping list item (FR47).
2. **Given** I am creating or editing a shopping list item  
   **When** I provide bundle fields  
   **Then** the system validates fields are present and sensible (no missing qty/price).

## Tasks / Subtasks

- [x] Extend shopping-list persistence model for optional bundle offers (AC: 1, 2)
  - [x] Add nullable bundle columns to `shopping_list_item` (`bundle_qty`, `bundle_price_cents`) with DB-level constraints.
  - [x] Add migration `src/db/migrations/0007_shopping_list_bundle_offer.ts` and register it in `src/db/db.ts`.
  - [x] Keep backward compatibility for existing shopping-list rows by defaulting bundle fields to `NULL`.

- [x] Update domain shopping-list contracts and validation (AC: 1, 2)
  - [x] Extend `ShoppingListItem`, `AddShoppingListItemInput`, and `UpdateShoppingListItemInput` in `src/domain/services/shopping-list-service.ts` with optional bundle fields.
  - [x] Enforce pair validation: either both bundle fields are `NULL` or both are provided.
  - [x] Enforce sensible values: `bundle_qty` integer >= 2 and `bundle_price_cents` integer > 0.
  - [x] Preserve existing owner-scope checks and deterministic error codes.

- [x] Add admin shopping-list UI controls for bundle offers (AC: 1, 2)
  - [x] Extend create/edit forms in `src/app/(admin)/shopping-list.tsx` with bundle quantity and bundle price inputs.
  - [x] Support clear optional behavior (no bundle) without breaking existing unit-price-only flow.
  - [x] Surface saved bundle summary in list rows (e.g., `Bundle 3 for ₱5.00`).

- [x] Add regression coverage for bundle configuration behavior (AC: 1, 2)
  - [x] Service integration tests in `tests/owner-scope-services.integration.test.tsx` for valid bundle create/update and invalid partial bundle inputs.
  - [x] Route integration tests in `tests/shopping-list-admin.integration.test.tsx` for create/edit bundle fields and validation messaging.
  - [x] Confirm existing non-bundle create/edit/remove flows remain green.

- [x] Run required quality gates (AC: 1, 2)
  - [x] `npm run test:gate:integration`
  - [x] `npx tsc --noEmit`
  - [x] `npm run lint`

### Review Follow-ups (AI)

- [x] [AI-Review][HIGH] Reject one-sided nullable bundle update payloads (`bundleQty: null` without `bundlePriceCents`, or vice versa) instead of silently clearing both fields. [`src/domain/services/shopping-list-service.ts:125`](src/domain/services/shopping-list-service.ts:125)
- [x] [AI-Review][MEDIUM] Align route integration mock semantics with real service behavior for omitted bundle fields (preserve existing values when both fields are omitted). [`tests/shopping-list-admin.integration.test.tsx:265`](tests/shopping-list-admin.integration.test.tsx:265)
- [x] [AI-Review][MEDIUM] Add migration-time integrity check/repair for pre-existing inconsistent bundle rows when columns already exist before trigger installation. [`src/db/migrations/0007_shopping_list_bundle_offer.ts:43`](src/db/migrations/0007_shopping_list_bundle_offer.ts:43)
- [x] [AI-Review][MEDIUM] Add route integration coverage for bundle bound validation (`bundleQty < 2`, `bundlePriceCents <= 0`) so UI validation regressions are caught without relying only on service-level tests. [`tests/shopping-list-admin.integration.test.tsx:543`](tests/shopping-list-admin.integration.test.tsx:543)
- [x] [AI-Review][MEDIUM] Gate legacy bundle repair behind migration state so startup does not execute a full-table repair `UPDATE` every bootstrap. [`src/db/migrations/0007_shopping_list_bundle_offer.ts:99`](src/db/migrations/0007_shopping_list_bundle_offer.ts:99)
- [x] [AI-Review][LOW] Strengthen migration coverage to verify trigger installation and column-add behavior; current test only asserts repair SQL dispatch. [`tests/shopping-list-bundle-migration.integration.test.tsx:14`](tests/shopping-list-bundle-migration.integration.test.tsx:14)
- [x] [AI-Review][MEDIUM] Ensure legacy bundle repair still executes for databases that already have pair triggers but may still contain inconsistent pre-trigger rows (avoid trigger-presence-only gating). [`src/db/migrations/0007_shopping_list_bundle_offer.ts:71`](src/db/migrations/0007_shopping_list_bundle_offer.ts:71)
- [x] [AI-Review][MEDIUM] Update migration tests to cover and assert the “triggers present + legacy inconsistent rows” repair path instead of only codifying repair skip. [`tests/shopping-list-bundle-migration.integration.test.tsx:20`](tests/shopping-list-bundle-migration.integration.test.tsx:20)
- [x] [AI-Review][LOW] Extend route bounds validation tests to include complementary permutations (`create + bundlePriceCents <= 0`, `edit + bundleQty < 2`) for branch-complete UI guardrail coverage. [`tests/shopping-list-admin.integration.test.tsx:591`](tests/shopping-list-admin.integration.test.tsx:591)

## Dev Notes

### Story Foundation

- Epic 4 governs published shopping-list management. Story 4.2 specifically adds admin configuration for optional bundle pricing metadata.
- This story introduces bundle configuration storage and validation only; bundle computation at purchase-time is implemented later in Story 6.2.
- Source: `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.2), `_bmad-output/planning-artifacts/prd.md` (FR47, FR48, AC13).

### Developer Context Section

- Story 4.1 already established the shopping-list management route and owner-scoped service patterns:
  - `src/app/(admin)/shopping-list.tsx`
  - `src/domain/services/shopping-list-service.ts`
  - `src/domain/services/owner-data-service.ts`
- Current `shopping_list_item` schema includes only `quantity` and `unit_price_cents`; no bundle fields exist yet.
- Existing form behavior and owner-switch stale response guards must be preserved while adding bundle inputs.
- Existing uniqueness guard (`owner_id`, `product_id`) must remain intact.
### Technical Requirements

- Add optional bundle fields to shopping-list records:
  - `bundle_qty INTEGER NULL`
  - `bundle_price_cents INTEGER NULL`
- Add schema-level integrity checks:
  - Pair rule: both values null or both values non-null.
  - Bounds rule: `bundle_qty >= 2`, `bundle_price_cents > 0` when present.
- Keep existing pricing and quantity rules from Story 4.1:
  - `quantity > 0`
  - `unit_price_cents >= 0`
- Keep all money in integer minor units (centavos).
- Preserve owner scope and current error-code contracts (`OWNER_SCOPE_*`, `OWNER_SCOPE_CONFLICT`, etc.).
- Persist bundle fields through create/list/update responses so downstream shopper/cart stories can consume them.
### Architecture Compliance

- Follow architecture boundary rules:
  - UI layer (`src/app/**`) must not write SQL directly.
  - Domain service layer (`src/domain/services/**`) owns validation + business rules.
  - DB layer (`src/db/**`) owns schema and migrations.
- Continue using stable result envelopes returned from services.
- Keep owner isolation enforcement in every read/write path.
- Maintain responsive admin list rendering and avoid regressing back to non-virtualized rendering patterns.
### Library & Framework Requirements

- Keep implementation aligned with current project baseline in `package.json`:
  - Expo `~55.0.4`
  - Expo Router `~55.0.3`
  - React Native `0.83.2`
  - expo-sqlite `~55.0.10`
- As of 2026-03-04 research:
  - Expo SDK 55 is the current stable line; SDK 56 is in beta and should not be introduced in this story.
  - Expo guidance confirms Expo SDK package versions share the same major SDK line.
  - SQLite integrity guidance still recommends explicit foreign-key enforcement and declarative constraints for data correctness.
- Story scope excludes framework upgrades.
### File Structure Requirements

- Primary files to update:
  - `src/db/schema.ts`
  - `src/db/db.ts`
  - `src/domain/services/shopping-list-service.ts`
  - `src/domain/services/owner-data-service.ts` (type/export propagation as needed)
  - `src/app/(admin)/shopping-list.tsx`
- New migration file expected:
  - `src/db/migrations/0007_shopping_list_bundle_offer.ts`
- Primary tests to update:
  - `tests/owner-scope-services.integration.test.tsx`
  - `tests/shopping-list-admin.integration.test.tsx`
### Testing Requirements

- Service-level validation tests:
  - create with valid bundle payload succeeds.
  - update existing item to add/change/remove bundle succeeds.
  - create/update fails when only one bundle field is provided.
  - create/update fails when `bundle_qty < 2` or `bundle_price_cents <= 0`.
- Route-level tests:
  - admin can create item with bundle qty + bundle price.
  - admin can edit existing item bundle values.
  - admin can clear bundle values back to optional none state.
  - invalid bundle input shows explicit validation message and blocks submit.
- Regression checks:
  - existing unit-price-only flow remains unchanged.
  - remove-item flow and owner-switch stale response handling still pass.
### Previous Story Intelligence

From Story 4.1 (`_bmad-output/implementation-artifacts/4-1-create-shopping-list-items-unit-price-available-qty.md`):
- Shopping-list UI is already virtualized with `SectionList`; keep this performance posture.
- Service and route logic use submit-lock patterns to prevent duplicate writes; preserve this for new bundle-form interactions.
- Owner-switch stale-response guards are in place and should remain untouched.
- DB-level owner/product uniqueness (`idx_shopping_list_item_owner_product_unique`) exists and should continue to be honored.
- Existing remove confirmation UX pattern should stay consistent after bundle fields are added.
### Git Intelligence Summary

Recent commit patterns (last 5 commits) indicate:
- Story delivery consistently updates three groups together: implementation artifact story file, sprint-status, and scoped code/test changes.
- Shopping-list work has converged on these files: `shopping-list-service.ts`, `owner-data-service.ts`, `src/app/(admin)/shopping-list.tsx`, `schema.ts`, and integration tests.
- Migrations are incremental and explicitly versioned (`0006_...` was latest before this story); bundle-offer support should follow the same pattern (`0007_...`).
- Regression-first discipline is expected: service tests + route integration tests + quality gates all run before story completion.
### Latest Tech Information (Verified 2026-03-04)

- Expo SDK 55 is the current stable SDK release (announced February 25, 2026). Keep this story on SDK 55-compatible APIs and dependency versions.
  - Source: https://expo.dev/changelog/sdk-55
- Expo SDK 56 is currently in beta. Do not perform SDK upgrade work inside this story.
  - Source: https://expo.dev/changelog/2026-03-03-sdk-56-beta
- Expo documentation reiterates the versioning convention that Expo SDK packages follow the same major SDK line.
  - Source: https://docs.expo.dev/versions/v55.0.0/
- React Native release documentation currently identifies 0.84 as current stable and 0.83 as older supported; this repository is pinned to 0.83.2 and should remain there for this story.
  - Source: https://reactnative.dev/docs/releases
- SQLite documentation confirms foreign-key constraints must be enabled per connection and supports check constraints needed for bundle-field integrity.
  - Sources:
    - https://www.sqlite.org/pragma.html#pragma_foreign_keys
    - https://www.sqlite.org/lang_createtable.html
### Project Context Reference

- No `project-context.md` file was discovered in this repository scan.

### Story Completion Status

- Story context created and status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.2)
- `_bmad-output/planning-artifacts/prd.md` (FR47, FR48, AC13)
- `_bmad-output/planning-artifacts/architecture.md` (data constraints, service boundaries)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (admin pricing UX + validation patterns)
- `_bmad-output/implementation-artifacts/4-1-create-shopping-list-items-unit-price-available-qty.md` (previous-story intelligence)
- `src/db/schema.ts`
- `src/db/db.ts`
- `src/domain/services/shopping-list-service.ts`
- `src/domain/services/owner-data-service.ts`
- `src/app/(admin)/shopping-list.tsx`
- `tests/owner-scope-services.integration.test.tsx`
- `tests/shopping-list-admin.integration.test.tsx`

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Workflow engine loaded: `_bmad/core/tasks/workflow.xml`
- Workflow config loaded: `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`
- Story loaded directly from path: `_bmad-output/implementation-artifacts/4-2-configure-optional-bundle-offers.md`
- Implemented bundle-offer schema + migration + service validation + admin route support.
- Executed red/green validation cycle with:
  - `npx jest --config ./jest.config.cjs --runInBand --watchman=false tests/owner-scope-services.integration.test.tsx tests/shopping-list-admin.integration.test.tsx`
  - `npm run test:gate:integration`
  - `npx tsc --noEmit`
  - `npm run lint`
- Addressed Senior Developer Review follow-ups:
  - Added explicit null/undefined symmetry validation for bundle update payloads in `shopping-list-service`.
  - Updated route integration mock update semantics to preserve existing bundle values when bundle fields are omitted.
  - Added migration-time legacy bundle integrity repair query and coverage.
- Executed verification cycle with:
  - `npx jest --config ./jest.config.cjs --runInBand --watchman=false tests/owner-scope-services.integration.test.tsx tests/shopping-list-admin.integration.test.tsx tests/shopping-list-bundle-migration.integration.test.tsx`
  - `npm run test:gate:integration`
  - `npx tsc --noEmit`
  - `npm run lint`
- Addressed follow-up review findings from Codex:
  - Added route integration tests for bundle bounds validation (`bundleQty < 2`, `bundlePriceCents <= 0`).
  - Gated legacy bundle repair so repair SQL only runs before bundle pair triggers exist (or when bundle columns are newly added).
  - Expanded migration integration tests to cover add-column paths, trigger-presence skip behavior, and trigger SQL export coverage.
- Executed post-fix verification cycle with:
  - `npx jest --config ./jest.config.cjs --runInBand --watchman=false tests/shopping-list-admin.integration.test.tsx tests/shopping-list-bundle-migration.integration.test.tsx`
  - `npm run test:gate:integration`
  - `npx tsc --noEmit`
  - `npm run lint`
- Addressed second-round Codex review findings in YOLO mode:
  - Updated migration repair gating to use one-time app-secret marker semantics (runs once per DB or when bundle columns are introduced), removing trigger-presence-only skip risk.
  - Expanded migration tests to validate marker-missing repair, marker-present skip, and marker update behavior during column add flows.
  - Added complementary route bundle-bounds tests for `create + bundlePriceCents <= 0` and `edit + bundleQty < 2`.
- Executed second-round verification cycle with:
  - `npx jest --config ./jest.config.cjs --runInBand --watchman=false tests/shopping-list-admin.integration.test.tsx tests/shopping-list-bundle-migration.integration.test.tsx`
  - `npm run test:gate:integration`
  - `npx tsc --noEmit`
  - `npm run lint`

### Completion Notes List

- Added nullable `bundle_qty`/`bundle_price_cents` support to shopping-list schema with check constraints and pair-validation triggers.
- Added migration `0007_shopping_list_bundle_offer` and registered it in DB bootstrap to preserve backward compatibility for existing rows.
- Extended shopping-list service contracts/results with optional bundle fields and enforced pair + bounds validation while preserving owner-scope error behavior.
- Extended admin shopping-list create/edit forms with optional bundle inputs, clear-to-none behavior, and bundle summary rendering in list rows.
- Added/updated integration tests for bundle create/update/clear flows, invalid partial bundle inputs, and DB schema-boundary constraints.
- Verified required quality gates pass: integration suite, TypeScript compile check, and lint.
- Addressed review findings by preserving existing bundle offers when update payloads omit bundle fields and by adding explicit edit-path partial-bundle validation coverage.
- ✅ Resolved review finding [HIGH]: one-sided nullable bundle update payloads are now rejected before input coercion.
- ✅ Resolved review finding [MEDIUM]: route integration mock now preserves existing bundle values when bundle fields are omitted.
- ✅ Resolved review finding [MEDIUM]: migration now repairs inconsistent legacy bundle rows before trigger enforcement.
- ✅ Resolved review finding [MEDIUM]: route integration suite now covers bundle bounds validation for create/edit flows.
- ✅ Resolved review finding [MEDIUM]: migration repair no longer runs unconditionally on every bootstrap.
- ✅ Resolved review finding [LOW]: migration tests now verify column-add scenarios and trigger-path expectations.
- ✅ Resolved review finding [MEDIUM]: migration repair now executes when repair marker is missing and is not incorrectly skipped by trigger presence.
- ✅ Resolved review finding [MEDIUM]: migration test suite now covers marker-missing repair and marker-present skip paths.
- ✅ Resolved review finding [LOW]: route tests now include complementary bundle-bounds permutations for create/edit validation branches.

### File List

- `_bmad-output/implementation-artifacts/4-2-configure-optional-bundle-offers.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/db/schema.ts`
- `src/db/db.ts`
- `src/db/migrations/0007_shopping_list_bundle_offer.ts`
- `src/domain/services/shopping-list-service.ts`
- `src/app/(admin)/shopping-list.tsx`
- `tests/owner-scope-services.integration.test.tsx`
- `tests/shopping-list-admin.integration.test.tsx`
- `tests/shopping-list-bundle-migration.integration.test.tsx`

### Senior Developer Review (AI)

Reviewer: myjmyj  
Date: 2026-03-04  
Outcome: Changes Requested

Summary:
- Acceptance Criteria coverage is mostly present in implementation and tests (bundle save + validation flows are implemented).
- Git vs story file list alignment is acceptable for this review run (no undocumented source-file changes detected).
- Three issues remain before this story should move to `done`.

Findings:
1. **[HIGH] Partial nullable bundle payload can bypass pair validation and clear bundle unexpectedly.**
   - `validateBundlePricing` coalesces `undefined` to `null` before pair-presence checks, so one-sided payloads like `{ bundlePriceCents: null }` can pass and clear both values.
   - Evidence: `src/domain/services/shopping-list-service.ts` lines 125-146 and update-path usage at lines 365-369.
2. **[MEDIUM] Route integration mock behavior diverges from production update semantics.**
   - Test mock forces `bundleQty`/`bundlePriceCents` to `null` when omitted, while service update logic preserves existing values when both fields are omitted.
   - This mismatch can hide regressions in callers that omit bundle fields.
   - Evidence: `tests/shopping-list-admin.integration.test.tsx` lines 265-271.
3. **[MEDIUM] Migration does not remediate existing invalid bundle row states.**
   - Migration adds columns/triggers but does not audit/repair already inconsistent records when columns pre-exist.
   - Trigger enforcement applies only to future writes, leaving potential legacy inconsistency unaddressed.
   - Evidence: `src/db/migrations/0007_shopping_list_bundle_offer.ts` lines 43-66.

Validation run by reviewer:
- `npm run test:gate:integration` (pass)
- `npx jest --config ./jest.config.cjs --runInBand --watchman=false tests/owner-scope-services.integration.test.tsx tests/shopping-list-admin.integration.test.tsx` (pass)
- `npx tsc --noEmit` (pass)
- `npm run lint` (pass)

Reviewer: Codex  
Date: 2026-03-04  
Outcome: Changes Requested

Summary:
- Core bundle-offer behavior is implemented and current quality gates are green.
- Git vs story file list is aligned for this review run.
- Three quality gaps remain before this story should move to `done` (2 MEDIUM, 1 LOW).

Findings:
1. **[MEDIUM] Route integration coverage is missing bundle-bounds validation paths.**
   - The route suite validates missing one-sided bundle input, but does not validate UI behavior for out-of-range bundle values (`bundleQty < 2`, `bundlePriceCents <= 0`), which are part of “sensible values” validation.
   - Evidence: `tests/shopping-list-admin.integration.test.tsx` lines 495-540.
2. **[MEDIUM] Bundle repair SQL runs unconditionally on every bootstrap.**
   - `ensureShoppingListBundleColumns` always executes `REPAIR_LEGACY_BUNDLE_INTEGRITY_SQL`, and bootstrap calls this path each app initialization. This adds avoidable startup scan/write work once data is already clean.
   - Evidence: `src/db/migrations/0007_shopping_list_bundle_offer.ts` line 84 and `src/db/db.ts` line 50.
3. **[LOW] Migration test does not verify trigger creation or column-add path.**
   - The migration test currently only checks that an UPDATE repair statement is dispatched, so regressions in trigger installation or add-column behavior can pass undetected.
   - Evidence: `tests/shopping-list-bundle-migration.integration.test.tsx` lines 13-37.

Validation run by reviewer:
- `npx jest --config ./jest.config.cjs --runInBand --watchman=false tests/owner-scope-services.integration.test.tsx tests/shopping-list-admin.integration.test.tsx tests/shopping-list-bundle-migration.integration.test.tsx` (pass)
- `npm run test:gate:integration` (pass)
- `npx tsc --noEmit` (pass)
- `npm run lint` (pass)

Reviewer: Codex  
Date: 2026-03-04  
Outcome: Changes Requested

Summary:
- The three prior follow-ups were implemented and quality gates remain green.
- New migration gating introduces a legacy-remediation risk and associated test coverage gaps.
- Three additional follow-ups are required (2 MEDIUM, 1 LOW).

Findings:
1. **[MEDIUM] Trigger-presence gating can skip required legacy repair.**
   - Repair now runs only when bundle columns were newly added or pair triggers are absent. Databases that already have both triggers can skip cleanup even if inconsistent rows still exist from pre-repair migrations.
   - Evidence: `src/db/migrations/0007_shopping_list_bundle_offer.ts` lines 92-108.
2. **[MEDIUM] Migration tests do not cover trigger-present legacy cleanup behavior.**
   - The suite currently asserts skip behavior when triggers exist, but lacks a test that proves legacy inconsistent rows are still remediated in that state.
   - Evidence: `tests/shopping-list-bundle-migration.integration.test.tsx` lines 81-112.
3. **[LOW] Route bounds tests remain permutation-incomplete.**
   - Added tests cover `create + bundleQty < 2` and `edit + bundlePrice <= 0`, but not the complementary branches (`create + bundlePrice <= 0`, `edit + bundleQty < 2`).
   - Evidence: `tests/shopping-list-admin.integration.test.tsx` lines 543-592.

Validation run by reviewer:
- `npx jest --config ./jest.config.cjs --runInBand --watchman=false tests/shopping-list-admin.integration.test.tsx tests/shopping-list-bundle-migration.integration.test.tsx` (pass)
- `npm run test:gate:integration` (pass)
- `npx tsc --noEmit` (pass)
- `npm run lint` (pass)

Reviewer: Codex  
Date: 2026-03-04  
Outcome: Approved

Summary:
- All previously raised HIGH/MEDIUM/LOW follow-ups are now implemented and checked.
- Acceptance Criteria are fully satisfied by implementation and tests.
- Git/story alignment is acceptable; no undocumented source changes were detected for this review run.

Findings:
- No new HIGH/MEDIUM issues found.
- No additional action items required.

Validation run by reviewer:
- `npx jest --config ./jest.config.cjs --runInBand --watchman=false tests/shopping-list-admin.integration.test.tsx tests/shopping-list-bundle-migration.integration.test.tsx` (pass)
- `npm run test:gate:integration` (pass)
- `npx tsc --noEmit` (pass)
- `npm run lint` (pass)

### Change Log

- 2026-03-04: Created Story 4.2 context file with comprehensive implementation guidance; status set to `ready-for-dev`.
- 2026-03-04: Implemented optional bundle-offer persistence, validation, admin UI controls, and regression coverage; story status set to `review`.
- 2026-03-04: Fixed review findings by preserving existing bundle offers on partial updates, adding missing edit-path regression coverage, and syncing story metadata with changed files.
- 2026-03-04: Senior Developer Review (AI) completed in YOLO mode; added 1 HIGH + 2 MEDIUM follow-ups and moved status to `in-progress`.
- 2026-03-04: Addressed code review findings - 3 items resolved (HIGH: nullable one-sided payload rejection, MEDIUM: route mock omitted-field parity, MEDIUM: migration legacy integrity repair); status set to `review`.
- 2026-03-04: Codex code review completed; added 2 MEDIUM + 1 LOW follow-ups (route bounds coverage, migration startup gating, migration test depth) and set status to `in-progress`.
- 2026-03-04: Implemented Codex follow-ups in YOLO mode (route bounds tests, migration repair gating, migration test expansion), re-ran quality gates, and set status back to `review`.
- 2026-03-04: Codex re-review (YOLO) identified 3 new follow-ups (2 MEDIUM + 1 LOW) around legacy repair semantics and bounds-test permutation coverage; status set to `in-progress`.
- 2026-03-04: Implemented second-round Codex follow-ups in YOLO mode (repair-marker migration semantics + complementary route bounds tests), re-ran quality gates, and set status back to `review`.
- 2026-03-04: Codex final code-review approved with no new findings; story status set to `done`.
