# Story 4.4: Admin Shopping List Management Remains Responsive at Scale

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want shopping list management to stay fast as data grows,
so that weekly refresh and ad-hoc adjustments remain practical.

## Acceptance Criteria

1. **Given** the active owner has 200+ products and a large shopping list  
   **When** I browse and edit the shopping list  
   **Then** I can continue to manage and update shopping list items effectively (FR19)  
   **And** the UI remains responsive without visible jank during normal scrolling (NFR-P4)

## Tasks / Subtasks

- [x] Establish measurable performance baseline for admin shopping-list flow (AC: 1)
  - [x] Create a deterministic owner-scoped fixture path for 200+ products plus a large published shopping list (standard + assorted rows).
  - [x] Capture baseline interaction timings in release-mode profile for list scroll + select + edit save loops.
  - [x] Document baseline vs. post-change observations in story completion notes (developer-facing evidence, no vague "feels faster" claims).

- [x] Refactor list rendering to reduce re-render pressure in `shopping-list.tsx` (AC: 1)
  - [x] Extract heavy row rendering into memoized item components for product rows, standard shopping rows, and assorted rows.
  - [x] Move expensive inline render logic/callback creation out of hot render paths (`renderItem`, section transforms, selection handlers).
  - [x] Ensure form input edits do not trigger avoidable full-list row re-renders.

- [x] Apply virtualization and list-tuning guardrails for large datasets (AC: 1)
  - [x] Keep virtualized list primitives (`SectionList`/`VirtualizedList`) tuned for 200+ datasets (`initialNumToRender`, batching/window props, clipping) with justified values.
  - [x] If introducing `@shopify/flash-list`, use v2.x-only patterns and keep compatibility with Expo SDK 55 / RN 0.83 new-architecture expectations.
  - [x] Preserve item-key stability and ordering guarantees (createdAt/id sort behavior remains deterministic).

- [x] Add admin usability upgrades that reduce operational friction at scale (AC: 1)
  - [x] Add fast filtering/search for large product and published-list sets (name/barcode/name+metadata where applicable).
  - [x] Keep existing owner-switch stale-response protections and submit locking intact while introducing search/filter state.
  - [x] Preserve current create/edit/remove capabilities for standard and assorted entries without behavior regressions.

- [x] Protect owner-scope and assorted behavior regressions while optimizing (AC: 1)
  - [x] Maintain owner isolation for reads/writes (no cross-owner leaks in visible list items or edits).
  - [x] Keep assorted-group visibility behavior fixed (including recoverable states where active member count can temporarily drop below 2).
  - [x] Preserve deterministic conflict/error messaging contracts already used by owner-scoped services.

- [x] Extend automated coverage and quality gates for scale behavior (AC: 1)
  - [x] Add/extend route integration tests for large-list rendering interactions and no-extra-fetch behavior under repeated selection/filter actions.
  - [x] Add/extend service-level tests only if query/data-shaping logic changes.
  - [x] Run full quality gates before review: `npm run test:gate:integration`, `npx tsc --noEmit`, `npm run lint`.

- [x] Review Follow-ups (AI)
  - [x] [AI-Review][Medium] Reduce avoidable large-owner render cost by rendering edit assorted-member chips only when an assorted row is selected. [`src/app/(admin)/shopping-list.tsx`]
  - [x] [AI-Review][Medium] Add regression coverage for repeated selection of published shopping rows under large filtered datasets to prove no-extra-fetch behavior. [`tests/shopping-list-admin.integration.test.tsx`]
  - [x] [AI-Review][Medium] Synchronize Dev Agent Record File List with actual changed files in this working set (DB schema/migration and schema-order test updates). [`_bmad-output/implementation-artifacts/4-4-admin-shopping-list-management-remains-responsive-at-scale.md`]
  - [x] [AI-Review][Medium] Resolve stale "Remaining Work" review blockers to align with the Product Owner waiver decision dated 2026-03-04. [`_bmad-output/implementation-artifacts/4-4-admin-shopping-list-management-remains-responsive-at-scale.md`]

## Dev Notes

### Story Foundation

- This story completes Epic 4 by hardening admin shopping-list operations for realistic weekly usage scale.
- Story 4.1 established standard shopping-list CRUD; Story 4.2 added bundle pricing; Story 4.3 added assorted group management.
- Story 4.4 must improve scale responsiveness without changing business semantics already implemented by Stories 4.1-4.3.

### Developer Context Section

- Current admin UI (`src/app/(admin)/shopping-list.tsx`) renders products and published rows together in a single `SectionList` with substantial inline render/control logic and large `ListFooterComponent` forms.
- At 200+ products and a large list, form-state changes and selection updates can amplify re-render cost.
- Existing safeguards already in place and must be preserved:
  - owner-context versioning and stale refresh response rejection
  - submit-lock guard to prevent duplicate writes
  - deterministic selection reset when owner/items change
- Existing service layer (`shopping-list-service.ts`) already merges standard + assorted entries and enforces owner scope; performance work should avoid unnecessary service/API shape churn unless required.

### Technical Requirements

- Keep FR19 behavior intact while meeting NFR-P4 responsiveness expectations for large admin datasets.
- Any list-performance changes must preserve:
  - standard-item edit/remove flows
  - assorted create/edit flows and member handling
  - current sort semantics (`createdAtMs`, then `id` descending)
- Prevent avoidable full refresh storms:
  - selection-only interactions should not trigger network/DB refresh calls
  - refresh remains explicit or post-write as designed
- Prefer incremental performance fixes with measurable impact over broad architecture rewrites.

### Architecture Compliance

- Respect boundaries from architecture.md:
  - UI logic in `src/app/**`
  - business rules and DB writes in `src/domain/services/**`
  - schema/migration changes in `src/db/**` only if absolutely required
- Do not move DB writes into route components.
- Maintain owner-scoped enforcement on every read/write path.
- Preserve Direction B UX intent from UX artifacts: tactile but clear controls, readable high-contrast states, and no confusing degraded interactions.

### Library & Framework Requirements

- Current project baseline (`package.json`) to preserve:
  - `expo` `~55.0.4`
  - `expo-router` `~55.0.3`
  - `react` `19.2.0`
  - `react-native` `0.83.2`
- Latest references verified on **2026-03-04**:
  - Expo SDK 55 release notes confirm SDK 55 and RN 0.83/React 19.2 alignment.
  - React Native releases overview shows 0.83.x as active in the current schedule.
  - RN SectionList docs emphasize virtualization caveats and render-window tradeoffs for large lists.
  - FlashList v2 migration/docs indicate v2 requires new architecture; do not use v1 patterns when adopting FlashList.
- Story scope excludes upgrading Expo/RN versions.

### File Structure Requirements

- Primary files expected to change:
  - `src/app/(admin)/shopping-list.tsx`
  - `tests/shopping-list-admin.integration.test.tsx`
- Potential secondary files (only if needed by implementation approach):
  - `src/components/**` (new memoized row/search components)
  - `src/domain/services/owner-data-service.ts` (only if client-facing service contract adaptation is required)
  - `src/domain/services/shopping-list-service.ts` (only if query/path optimization is required)
  - `tests/owner-scope-services.integration.test.tsx` (if service behavior changes)
- Avoid unnecessary schema/migration changes for a UI responsiveness story.

### Testing Requirements

- Route integration coverage for scale-oriented behavior:
  - large dataset render remains interactive; selection and edits still function correctly
  - selection-only interactions do not trigger extra list refetches
  - owner switch with in-flight refresh still ignores stale responses
  - assorted and standard rows remain editable with existing guardrail copy
- Regression coverage:
  - create/update/remove standard list item behavior unchanged
  - assorted create/update behavior unchanged
  - existing error messages and submit-lock semantics preserved
- Quality gates:
  - `npm run test:gate:integration`
  - `npx tsc --noEmit`
  - `npm run lint`

### Previous Story Intelligence

From Story 4.3 (`_bmad-output/implementation-artifacts/4-3-create-and-manage-assorted-shopping-list-groups.md`):

- Keep the post-review fix that treats `listShoppingListItems()` as the single refresh source of truth (avoid redundant list calls).
- Preserve visibility of assorted groups even when active member counts temporarily drop below two (for repair/edit continuity).
- Preserve owner-data edit targeting rules that distinguish standard list items from assorted entries.
- Reuse established stale-response + submit-lock patterns; do not regress these while optimizing render performance.

### Git Intelligence Summary

Recent commits relevant to this story (`git log -5`):

- `265894d story(4.3):done`
- `1e7128c story(4.2):done`
- `47f22a4 story(4.1):done create shopping list items unit price availability`
- `cb54dfd story(3.4):done`
- `992e3bf story(3.3):done:archive or delete products`

Observed implementation pattern to follow:

- Shopping-list work concentrates in:
  - `src/app/(admin)/shopping-list.tsx`
  - `src/domain/services/shopping-list-service.ts`
  - integration tests under `tests/`
- Recent stories consistently emphasize regression-first changes and deterministic error contracts.
- Maintain incremental evolution rather than introducing unrelated refactors across admin domains.

### Latest Tech Information (Verified 2026-03-04)

- Expo SDK 55 changelog (stable release line, RN 0.83 alignment): https://expo.dev/changelog/sdk-55
- React Native releases overview (current support matrix): https://reactnative.dev/docs/releases
- React Native SectionList docs (virtualization caveats and performance behavior): https://reactnative.dev/docs/sectionlist
- FlashList v2 migration guide (new-architecture requirement): https://shopify.github.io/flash-list/docs/v2-migration/
- npm package details for `@shopify/flash-list` v2 line: https://www.npmjs.com/package/%40shopify/flash-list

### Project Context Reference

- No `project-context.md` file found via repository scan pattern `**/project-context.md`.

### Story Completion Status

- Story context created and status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 4, Story 4.4)
- `_bmad-output/planning-artifacts/prd.md` (FR19, NFR-P4)
- `_bmad-output/planning-artifacts/architecture.md` (frontend performance and boundary rules)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (admin list scalability, shopping-list interaction expectations)
- `_bmad-output/implementation-artifacts/4-3-create-and-manage-assorted-shopping-list-groups.md`
- `_bmad-output/implementation-artifacts/4-2-configure-optional-bundle-offers.md`
- `src/app/(admin)/shopping-list.tsx`
- `src/domain/services/shopping-list-service.ts`
- `src/domain/services/owner-data-service.ts`
- `tests/shopping-list-admin.integration.test.tsx`
- `tests/owner-scope-services.integration.test.tsx`

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Workflow engine loaded: `_bmad/core/tasks/workflow.xml`
- Workflow config loaded: `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`
- Story selected: `_bmad-output/implementation-artifacts/4-4-admin-shopping-list-management-remains-responsive-at-scale.md`
- Sprint tracking updated: `ready-for-dev` -> `in-progress` -> `review` -> `in-progress` -> `review`
- Added deterministic large-owner fixture and route integration coverage for 200+ product behavior
- Executed quality gates: `npm run test:gate:integration`, `npx tsc --noEmit`, `npm run lint`
- Attempted release-profile environment checks: `adb devices` (`command not found`) and `xcrun simctl list devices` (CoreSimulatorService unavailable in current environment)
- Added no-ADB perf instrumentation path: `EXPO_PUBLIC_SHOPPING_LIST_PERF=1` + `expo start --no-dev --minify` with metric logs tagged by `EXPO_PUBLIC_SHOPPING_LIST_PERF_LABEL`
- Added metric summarizer command: `npm run perf:shopping-list:summary -- <log-file>`
- Re-validated quality gates in current dev-story run: `npm run test:gate:integration`, `npx tsc --noEmit`, `npm run lint`

### Completion Notes List

- Refactored `src/app/(admin)/shopping-list.tsx` to reduce re-render pressure with memoized row/chip components and stable callbacks for item selection/member toggles.
- Added local search/filter UX for both active products and published shopping rows (name/barcode/metadata), including clear controls and visible result counts.
- Tuned `SectionList` virtualization for large datasets (`initialNumToRender=16`, `maxToRenderPerBatch=20`, `windowSize=11`, `updateCellsBatchingPeriod=40`, `removeClippedSubviews=true`) while preserving key stability and createdAt/id order.
- Preserved owner-scope/stale-response/submit-lock protections and expanded remove support to include assorted rows via owner-scoped service path.
- Added deterministic owner-scoped large fixture at `tests/fixtures/admin-shopping-list-large-owner.fixture.ts` (240 products, 210 standard rows, assorted rows) and extended integration tests for repeated filter/selection interactions with no extra fetches.
- Added integration assertion for large-list scroll interaction (with subsequent search/select/edit checks) without triggering extra fetches.
- Decoupled assorted member pickers from active product search so selected members remain visible/editable even when search filters are active.
- Re-opened baseline profiling subtasks: release-mode scroll/select/edit timing capture still requires device/emulator profiling evidence artifact.
- Re-ran full quality gates while re-attempting baseline capture; all suites/checks pass but release-mode timing capture remains blocked by missing/disabled device tooling in this environment.
- Product Owner decision (2026-03-04): declined `adb` installation in current environment, so objective Android release-mode timing capture remains an explicit blocker for story completion.
- Implemented opt-in shopping-list perf metrics for no-ADB capture: `scroll_loop`, `select_latency`, and `edit_save_latency` emitted under `[shopping-list-perf]` in production-like Expo mode.
- Added manual runbook at `docs/manual-checklists/story-4-4-shopping-list-performance-no-adb.md` for baseline/post-change capture loops and evidence summarization.
- Re-ran quality gates in this continuation (`16/16` integration suites pass, `198/198` tests pass, typecheck and lint pass); release-mode baseline evidence remains blocked pending device-captured perf logs.
- Product Owner decision (2026-03-04): accepted skipping manual baseline capture for this story cycle; release-mode perf evidence requirement waived and story advanced with automated coverage + quality-gate evidence.
- Follow-up fix: edit assorted-member chip grid now renders only when an assorted item is selected, reducing avoidable footer render cost at 200+ product scale.
- Follow-up fix: added large-dataset regression coverage for repeated published-row selection with stable no-extra-fetch assertions.
- Re-ran full quality gates after review follow-up fixes (`16/16` suites, `199/199` tests, typecheck and lint pass).

### File List

- `_bmad-output/implementation-artifacts/4-4-admin-shopping-list-management-remains-responsive-at-scale.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/app/(admin)/shopping-list.tsx`
- `package.json`
- `src/domain/services/owner-data-service.ts`
- `src/domain/services/shopping-list-service.ts`
- `src/db/db.ts`
- `src/db/migrations/0007_shopping_list_bundle_offer.ts`
- `src/db/migrations/0008_shopping_list_assorted_groups.ts`
- `src/db/schema.ts`
- `scripts/summarize-shopping-list-perf-log.mjs`
- `tests/fixtures/admin-shopping-list-large-owner.fixture.ts`
- `tests/owner-scope-services.integration.test.tsx`
- `tests/shopping-list-admin.integration.test.tsx`
- `tests/shopping-list-schema-order.integration.test.tsx`
- `docs/manual-checklists/story-4-4-shopping-list-performance-no-adb.md`
- `tmp/`

### Change Log

- 2026-03-04: Implemented Story 4.4 scalability optimizations for admin shopping-list management, added deterministic large-owner integration fixture/tests, passed integration + typecheck + lint gates, and moved story to `review`.
- 2026-03-04: Applied code-review fixes for assorted removal parity, large-list scroll interaction coverage, and assorted-member edit visibility; moved story back to `in-progress` pending release-mode profiling evidence.
- 2026-03-04: Re-attempted release-mode profiling evidence capture; `adb` not available and CoreSimulator service unavailable, so story remains `in-progress` with profiling subtasks still open.
- 2026-03-04: Recorded Product Owner decision to not install `adb`; release-mode baseline evidence remains blocked and story stays `in-progress`.
- 2026-03-04: Added no-ADB perf instrumentation + log summarizer/runbook for production-like Expo capture (`--no-dev --minify`); quality gates pass, awaiting baseline/post-change timing evidence from device run.
- 2026-03-04: Re-validated full quality gates during dev-story continuation; story remains `in-progress` because release-mode baseline/post-change perf evidence is still missing.
- 2026-03-04: Product Owner waived manual release-profile baseline capture for this cycle; remaining baseline subtasks marked complete and story moved to `review` after full gate re-run.
- 2026-03-04: Adversarial code review reopened story to `in-progress`; added AI review follow-up items for render-cost cleanup, no-extra-fetch regression coverage, and story record consistency updates.
- 2026-03-04: Completed AI review follow-ups (conditional edit-member rendering, repeated published-row selection no-extra-fetch regression test, file-list/review consistency updates), re-ran quality gates, and moved story back to `review`.
- 2026-03-04: Final adversarial code-review pass found no remaining HIGH/MEDIUM issues; story status advanced from `review` to `done`.

## Senior Developer Review (AI)

### Review Date

- 2026-03-04

### Findings Addressed

- Added missing assorted-item remove behavior in UI + owner-scoped service layer and validated with route + service integration tests.
- Extended large-dataset test coverage to include explicit scroll interaction while preserving no-extra-fetch guarantees.
- Removed member-picker coupling to active product search to prevent hidden selected members during assorted edits.
- Corrected false-complete baseline profiling claims by reopening the release-mode evidence subtasks.

### Action Items

- [x] [Medium] Render edit assorted-member chips only when editing an assorted row to avoid unnecessary large-owner footer render pressure. [`src/app/(admin)/shopping-list.tsx`]
- [x] [Medium] Add repeated published-row selection assertions in large-owner route integration coverage with stable fetch-call counts. [`tests/shopping-list-admin.integration.test.tsx`]
- [x] [Medium] Update story File List to include all changed files currently in scope (DB + schema-order artifacts). [`_bmad-output/implementation-artifacts/4-4-admin-shopping-list-management-remains-responsive-at-scale.md`]
- [x] [Medium] Replace stale remaining-work blocker language with resolved/waived notes matching Product Owner decision from 2026-03-04. [`_bmad-output/implementation-artifacts/4-4-admin-shopping-list-management-remains-responsive-at-scale.md`]

### Remaining Work

- None for this story cycle. Product Owner waived manual release-mode baseline evidence on 2026-03-04; follow-up action items are resolved and verified by full quality-gate reruns.
