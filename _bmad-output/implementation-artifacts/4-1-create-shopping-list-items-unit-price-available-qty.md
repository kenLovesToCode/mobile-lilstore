# Story 4.1: Create Shopping List Items (Unit Price + Available Qty)

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to publish a shopping list with price and available quantity,
so that shoppers only see what is for sale (and stock constraints are enforced).

## Acceptance Criteria

1. **Given** I am logged in as admin and an owner is active  
   **When** I create a shopping list item referencing a product/barcode with a unit price and available quantity  
   **Then** the item appears in the published shopping list for that owner (FR18).
2. **Given** a shopping list item exists  
   **When** I update its unit price or available quantity  
   **Then** the updated values are saved and used for shopper purchase sessions (FR19).
3. **Given** a shopping list item exists  
   **When** I remove it from the shopping list  
   **Then** it is no longer purchasable by shoppers (FR20, FR21).

## Tasks / Subtasks

- [x] Implement shopping-list lifecycle service operations for create, update, list, and remove (AC: 1, 2, 3)
  - [x] Extend `src/domain/services/shopping-list-service.ts` with `removeShoppingListItem` using owner-scope checks and deterministic error mapping.
  - [x] Keep existing add/update validation guardrails (`quantity > 0`, `unit_price_cents >= 0`) and owner/product scope checks.
  - [x] Ensure remove flow enforces active owner scope and idempotent error behavior (`OWNER_SCOPE_NOT_FOUND` vs `OWNER_SCOPE_MISMATCH`).
  - [x] Keep active-product join filtering (`product.archived_at_ms IS NULL`) so archived products never remain purchasable through list reads.

- [x] Wire shopping-list APIs through owner-data orchestration (AC: 1, 2, 3)
  - [x] Export `removeShoppingListItem` from `src/domain/services/owner-data-service.ts`.
  - [x] Keep `getOwnerScopedSnapshot` contract stable and owner-scoped.

- [x] Build dedicated admin shopping-list management screen (AC: 1, 2, 3)
  - [x] Add route screen `src/app/(admin)/shopping-list.tsx` for shopping-list CRUD (create, edit, remove).
  - [x] Add product selector sourced from active owner products only.
  - [x] Add validated numeric inputs for unit price (centavos-backed) and available quantity.
  - [x] Add explicit remove action with confirmation and clear destructive copy.
  - [x] Preserve owner-switch stale-response protection and submit-lock behavior used in `products.tsx`.

- [x] Connect admin navigation to shopping-list screen (AC: 1, 2, 3)
  - [x] Add navigation entry from `src/app/(admin)/dashboard.tsx` to `/shopping-list`.
  - [x] Keep existing dashboard and owner-data flows backward compatible.

- [x] Add regression coverage for service and route behavior (AC: 1, 2, 3)
  - [x] Add service integration tests in `tests/owner-scope-services.integration.test.tsx` for add/update/remove success and owner mismatch/not-found paths.
  - [x] Add route integration tests in `tests/owner-data-scope.integration.test.tsx` (or a new route-focused integration file) for shopping-list create/edit/remove UX flows and validation.
  - [x] Verify removed items disappear from owner snapshot `shoppingList` and are no longer returned by list reads.

- [x] Run required quality gates (AC: 1, 2, 3)
  - [x] `npm run test:gate:integration`
  - [x] `npx tsc --noEmit`
  - [x] `npm run lint`

### Review Follow-ups (AI)

- [x] [AI-Review][High] Enforce one active shopping-list entry per product per owner by adding a DB uniqueness constraint (`owner_id`, `product_id`) plus deterministic conflict handling in create flow. [src/db/schema.ts:139]
- [x] [AI-Review][Medium] Replace unvirtualized `ScrollView` + `.map()` rendering for products/shopping-list rows with virtualized lists to preserve responsiveness as catalog/list size grows. [src/app/(admin)/shopping-list.tsx:443]
- [x] [AI-Review][Medium] Add a post-remove regression asserting `listShoppingListItems()` no longer returns removed rows, not only snapshot aggregation checks. [tests/owner-scope-services.integration.test.tsx:959]

## Dev Notes

### Story Foundation

- Epic 4 objective is owner-scoped published-shopping-list management with pricing and availability control.
- Story 4.1 is the first story in Epic 4 and establishes the baseline shopping-list CRUD contract needed by shopper scanning stories.
- This story must deliver FR18/FR19/FR20/FR21 before optional bundle (4.2) and assorted group (4.3) extensions.
- Source: `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.1).

### Developer Context Section

- Existing code already has baseline shopping-list service operations (`addShoppingListItem`, `listShoppingListItems`, `updateShoppingListItem`) and owner-data wiring.
- Current admin UI has no dedicated shopping-list management route; `owner-data.tsx` only provides simplified smoke-test style actions.
- Build this story as production admin UX, not as test harness controls.
- Preserve established owner-scope architecture:
  - session + active owner context from `admin-session`
  - route orchestration in `src/app/(admin)/*`
  - data writes in `src/domain/services/*`
  - SQL persistence in `src/db/*`

### Technical Requirements

- Keep all money values stored as integer minor units (`unit_price_cents`) and never as floats.
- Keep quantity guardrail as strict positive integer (`quantity > 0`).
- Preserve owner isolation on every shopping-list operation.
- Ensure list reads remain shopper-safe by joining product rows and excluding archived products.
- Implement removal as true shopping-list depublication for the active owner (FR20/FR21).
- Do not implement bundle schema/logic in this story; Story 4.2 will extend pricing model.
- Do not implement assorted group schema/logic in this story; Story 4.3 will extend list model.

### Architecture Compliance

- Respect architecture boundaries from `architecture.md`:
  - no direct DB writes in route components
  - owner-scoped domain services as the only write path
  - stable result envelope `{ ok: true | false, value | error }`
- Maintain owner-scoped behavior across reads/writes/refreshes and error handling.
- Follow existing admin route UX patterns:
  - explicit loading/disabled states on commit buttons
  - submit lock to prevent duplicate writes
  - stale-response protection across owner switches

### Library & Framework Requirements

- Align implementation with repository baseline (`package.json`):
  - Expo `~55.0.4`
  - Expo Router `~55.0.3`
  - React `19.2.0`
  - React Native `0.83.2`
  - expo-sqlite `~55.0.10`
- Keep SQL operations parameterized (`runAsync` placeholders) and avoid string interpolation for user inputs.
- No framework/library upgrade is in scope for this story.

### File Structure Requirements

- Primary change targets:
  - `src/domain/services/shopping-list-service.ts`
  - `src/domain/services/owner-data-service.ts`
  - `src/app/(admin)/shopping-list.tsx` (new)
  - `src/app/(admin)/dashboard.tsx`
- Secondary change targets (only if needed for consistency):
  - `src/app/(admin)/owner-data.tsx`
  - `src/app/(admin)/_layout.tsx`
- Test targets:
  - `tests/owner-scope-services.integration.test.tsx`
  - `tests/owner-data-scope.integration.test.tsx`

### Testing Requirements

- Service-level tests:
  - add shopping-list item success with active owner product
  - update shopping-list item quantity/price success
  - remove shopping-list item success
  - cross-owner add/update/remove protections (`OWNER_SCOPE_MISMATCH`)
  - missing record behavior on update/remove (`OWNER_SCOPE_NOT_FOUND`)
  - archived-product exclusion remains enforced
- Route-level tests:
  - create flow with explicit unit-price and quantity fields
  - edit flow persists updated price/quantity
  - remove flow requires confirmation and removes row from visible list
  - validation messaging for empty/invalid numeric inputs
  - owner switch resets stale selection and ignores stale in-flight responses
- Required gates:
  - `npm run test:gate:integration`
  - `npx tsc --noEmit`
  - `npm run lint`

### Latest Tech Information (Verified 2026-03-03)

- Expo SDK 55 was officially released on **February 25, 2026**, with React Native 0.83 and React 19.2 as the supported baseline. Story implementation should stay on SDK 55-compatible APIs.
  - Source: https://expo.dev/changelog/sdk-55
- Expo public roadmap currently targets SDK 56 in Q2 2026 with React Native 0.85. Avoid speculative upgrade work inside this story.
  - Source: https://expo.dev/changelog
- React Native release matrix currently lists both 0.84 and 0.83 as active release lines; this repo remains on 0.83.x and should keep compatibility there for this story.
  - Source: https://reactnative.dev/docs/releases
- Expo SQLite v55 docs indicate bundled `expo-sqlite` version `~15.0.7` and recommend prepared statements / parameter binding patterns for safer SQL execution.
  - Source: https://docs.expo.dev/versions/v55.0.0/sdk/sqlite/
- SQLite foreign-key enforcement remains runtime-configurable and must stay enabled to preserve owner/product reference integrity.
  - Sources:
    - https://www.sqlite.org/pragma.html#pragma_foreign_keys
    - https://www.sqlite.org/foreignkeys.html

### Project Structure Notes

- Current admin flows are split across dedicated routes (`owners.tsx`, `products.tsx`, `owner-data.tsx`).
- For maintainability and parity with products UX, Story 4.1 should use a dedicated shopping-list route rather than extending only owner-data test controls.
- Preserve styling and interaction conventions already established in admin screens (Direction B visual language and soft UI tokens).

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.1)
- `_bmad-output/planning-artifacts/prd.md` (FR18, FR19, FR20, FR21)
- `_bmad-output/planning-artifacts/architecture.md` (owner-scoped service boundaries, route/data separation)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (admin UX consistency, disabled/loading state requirements)
- `src/domain/services/shopping-list-service.ts`
- `src/domain/services/owner-data-service.ts`
- `src/app/(admin)/dashboard.tsx`
- `src/app/(admin)/owner-data.tsx`
- `src/app/(admin)/products.tsx`
- `src/db/schema.ts`
- `src/db/db.ts`
- `tests/owner-scope-services.integration.test.tsx`
- `tests/owner-data-scope.integration.test.tsx`

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
- Story selected from explicit path: `_bmad-output/implementation-artifacts/4-1-create-shopping-list-items-unit-price-available-qty.md`
- Sprint status updated: `ready-for-dev` -> `in-progress` -> `review` -> `done`
- Red-green cycle executed:
  - Added failing service + route integration tests
  - Implemented service/API/route/dashboard changes
  - Re-ran targeted suites and full quality gates to green
- Review-continuation cycle executed:
  - Added owner/product DB uniqueness index for shopping-list entries and deterministic duplicate conflict mapping
  - Reworked admin shopping-list rendering to a virtualized `SectionList`
  - Added explicit post-remove `listShoppingListItems()` regression assertion
  - Re-ran targeted suites plus full quality gates to green
- Quality gates passed:
  - `npm run test:gate:integration`
  - `npx tsc --noEmit`
  - `npm run lint`

### Completion Notes List

- Added `removeShoppingListItem` owner-scoped lifecycle operation with deterministic `OWNER_SCOPE_NOT_FOUND`/`OWNER_SCOPE_MISMATCH` mapping and guarded delete behavior.
- Exported `removeShoppingListItem` and `listShoppingListItems` through `owner-data-service` while keeping `getOwnerScopedSnapshot` contract stable.
- Implemented dedicated admin route `src/app/(admin)/shopping-list.tsx` with create/edit/remove flows, active-product selector, validated centavos/quantity inputs, explicit destructive confirmation, submit locking, and owner-switch stale-response protection.
- Added dashboard navigation entry to the shopping-list screen.
- Expanded integration coverage:
  - Service-level create/update/remove and mismatch/not-found paths.
  - Route-level shopping-list CRUD validation, confirm-remove behavior, and stale owner-switch response handling.
- ✅ Resolved review finding [High]: Added DB uniqueness boundary for `shopping_list_item(owner_id, product_id)` and deterministic duplicate-create conflict mapping.
- ✅ Resolved review finding [Medium]: Replaced non-virtualized row rendering with `SectionList`-based virtualized list rendering in admin shopping-list screen.
- ✅ Resolved review finding [Medium]: Added regression assertion that `listShoppingListItems()` excludes removed rows after delete.
- Verified full regression gates, type checks, and lint pass.

### File List

- `src/domain/services/shopping-list-service.ts`
- `src/domain/services/owner-data-service.ts`
- `src/db/schema.ts`
- `src/db/migrations/0003_owner_scoped_entities.ts`
- `src/app/(admin)/shopping-list.tsx`
- `src/app/(admin)/dashboard.tsx`
- `tests/owner-scope-services.integration.test.tsx`
- `tests/shopping-list-admin.integration.test.tsx`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `_bmad-output/implementation-artifacts/4-1-create-shopping-list-items-unit-price-available-qty.md`

### Change Log

- 2026-03-04: Implemented Story 4.1 shopping-list CRUD delivery (service remove flow, owner-data exports, dedicated admin route, dashboard navigation, service + route integration regression coverage, and full quality gate verification).
- 2026-03-04: Senior Developer Review (AI) completed. Outcome: Changes Requested. Story moved to `in-progress`; 1 High and 2 Medium follow-up items added; sprint status synced.
- 2026-03-04: Addressed all review follow-up items (DB uniqueness + conflict mapping, virtualized list rendering, post-remove list-read regression assertion) and revalidated quality gates.
- 2026-03-04: Follow-up code review completed. Outcome: Approved. Story status set to `done`; sprint status synced.

## Senior Developer Review (AI)

### Reviewer

- myjmyj

### Date

- 2026-03-04

### Outcome

- Approved (after follow-up remediation)

### Findings

1. **[x][High][Resolved] Duplicate shopping-list entries for the same owner/product are currently allowed.**  
   The service create path inserts rows without deduplicating by `(owner_id, product_id)`, and schema currently defines only a non-unique owner/created-at index for shopping-list items. This allows multiple active rows for the same product, making depublication ambiguous (`remove` may delete one row while another still keeps the product purchasable).  
   Evidence: `src/domain/services/shopping-list-service.ts:155`, `src/db/schema.ts:139`, `src/app/(admin)/shopping-list.tsx:242`.
2. **[x][Medium][Resolved] The shopping-list admin screen is not virtualized and risks list-jank under scale.**  
   The route renders both active products and published shopping-list rows via `ScrollView` and direct `.map()` rendering. For larger owners, this pattern degrades interaction responsiveness and is inconsistent with scale-focused list handling used elsewhere.  
   Evidence: `src/app/(admin)/shopping-list.tsx:443`, `src/app/(admin)/shopping-list.tsx:472`, `src/app/(admin)/shopping-list.tsx:497`.
3. **[x][Medium][Resolved] Remove-flow regression coverage does not directly assert post-delete list-read behavior.**  
   Current tests verify snapshot aggregation after remove, but do not explicitly assert a subsequent `listShoppingListItems()` read omits the deleted item from the returned list. This leaves room for read-path regressions to pass unnoticed.  
   Evidence: `tests/owner-scope-services.integration.test.tsx:959`.

### Validation Notes

- Git vs story file-list discrepancy count: **0**.
- Quality gates rerun during review:
  - `npm run test:gate:integration` (pass)
  - `npx jest --config ./jest.config.cjs --runInBand --watchman=false tests/owner-scope-services.integration.test.tsx` (pass)
  - `npx jest --config ./jest.config.cjs --runInBand --watchman=false tests/shopping-list-admin.integration.test.tsx` (pass)
  - `npx tsc --noEmit` (pass)
  - `npm run lint` (pass)

### Follow-up Validation

- Resolved findings re-verified in code:
  - `idx_shopping_list_item_owner_product_unique` uniqueness + deterministic conflict handling confirmed.
  - Admin shopping-list route now uses virtualized `SectionList` rendering.
  - Service regression now asserts `listShoppingListItems()` omits removed rows.
- Open High/Medium findings: **0**
