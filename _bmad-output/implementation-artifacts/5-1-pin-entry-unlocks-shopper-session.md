# Story 5.1: PIN Entry Unlocks Shopper Session

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a shopper,
I want to unlock the purchase flow by entering my PIN,
so that only I can buy under my name on a shared device.

## Acceptance Criteria

1. **Given** I am on the home screen  
   **When** I choose "Buy Now"  
   **Then** I see a PIN entry UI (FR6)
2. **Given** I enter a valid PIN  
   **When** I submit the PIN  
   **Then** the system identifies the shopper and starts a purchase session (AC5, FR6)  
   **And** it navigates to the scanner experience (FR22)
3. **Given** I enter an invalid PIN  
   **When** I submit the PIN  
   **Then** I see a clear, non-judgmental error message  
   **And** the scanner remains locked

## Tasks / Subtasks

- [x] Add shopper entry point on home screen (AC: 1)
  - [x] Update [`src/app/index.tsx`] to present explicit `Buy Now` action in addition to Admin path.
  - [x] Keep first-run/admin gating behavior intact for admin routes (no regression to FR1-FR5 behavior).
- [x] Build shopper PIN entry screen and submission flow (AC: 1, 2, 3)
  - [x] Add new route screen [`src/app/(shopper)/pin.tsx`] with numeric keypad-style PIN entry and disabled submit until valid format (`^\d{4,}$`).
  - [x] Use non-judgmental copy for invalid PIN errors; provide immediate retry path.
  - [x] Clear raw PIN input state after each submit attempt (success or failure).
- [x] Reuse existing PIN identity lookup service (AC: 2, 3)
  - [x] Call `resolveShopperEntryByPin` from [`src/domain/services/shopper-service.ts`] instead of creating duplicate lookup logic.
  - [x] Handle `OWNER_SCOPE_NOT_FOUND`, `OWNER_SCOPE_CONFLICT`, and `OWNER_SCOPE_INVALID_INPUT` error outcomes explicitly in UI.
- [x] Introduce shopper-session runtime state for authenticated shopper flow (AC: 2)
  - [x] Create shopper-session runtime module (recommended: [`src/domain/services/shopper-session.ts`]) with subscribe/get/set/clear APIs patterned after admin-session immutability.
  - [x] Store session-safe fields only (`shopperId`, `ownerId`, `displayName`, optional `startedAtMs`); never store plaintext PIN or derived key/hash.
- [x] Add scanner handoff route contract for next story (AC: 2, 3)
  - [x] Add [`src/app/(shopper)/scan.tsx`] placeholder route that requires active shopper session and serves as handoff target for Story 5.2.
  - [x] Ensure invalid/failed PIN attempts do not navigate to scanner.
- [x] Extend automated test coverage and gates (AC: 1, 2, 3)
  - [x] Add route/service integration tests for valid PIN unlock, invalid PIN rejection, and ambiguous PIN handling.
  - [x] Verify PIN submission lock prevents duplicate concurrent lookup calls.
  - [x] Run full quality gates: `npm run test:gate:integration`, `npx tsc --noEmit`, `npm run lint`.
- [x] Review Follow-ups (AI)
  - [x] [AI-Review][High] Implement explicit shopper-flow exit/cancel session clearing to satisfy the story requirement "clear shopper session when flow exits/cancels." Current flow only clears on failed PIN lookup, leaving a stale session when users back out of the scanner flow. [`src/app/(shopper)/scan.tsx:17`]
  - [x] [AI-Review][Medium] Add defensive `catch` handling around `resolveEntryRouteFromAdminCheck` in `onPressAdmin` so thrown promise rejections surface as user-safe errors instead of unhandled runtime failures. [`src/app/index.tsx:42`]
  - [x] [AI-Review][Medium] Add defensive `catch` handling around `resolveShopperEntryByPin` in `onSubmit` so rejected promises map to user-safe copy and do not surface as unhandled runtime failures. [`src/app/(shopper)/pin.tsx:90`]
  - [x] [AI-Review][Low] Sync Dev Agent Record `File List` with current working tree changes; `_bmad-output/implementation-artifacts/epic-4-retro-2026-03-04.md` is currently changed but undocumented in this story artifact. [`_bmad-output/implementation-artifacts/5-1-pin-entry-unlocks-shopper-session.md:218`]

## Dev Notes

### Story Foundation

- Epic 5 starts here; this is the first shopper-facing story after admin + owner + catalog + shopping-list groundwork from Epics 1-4.
- This story is intentionally narrow: unlock + identity resolution + route handoff. Scanner performance and "not available" behavior belong to Story 5.2.
- Business value: enforces shared-device identity boundary before any shopper operation.

### Story Requirements

- Primary requirements source is Epic 5 / Story 5.1 in [`_bmad-output/planning-artifacts/epics.md`].
- PRD alignment:
  - FR6, FR22, AC5 from [`_bmad-output/planning-artifacts/prd.md`]
  - security constraints NFR-S1 and NFR-S2 apply immediately to session and PIN handling.
- UX alignment:
  - PIN screen must feel quick, forgiving, and obvious for low-tech users.
  - Errors must be clear and non-blaming, with fast retry.

### Developer Context Section

- Existing runtime already supports shopper identity lookup by PIN via:
  - `lookupShopperByPin` / `resolveShopperEntryByPin` in [`src/domain/services/shopper-service.ts`]
  - robust fallback behavior for migrated legacy PIN rows + ambiguity detection.
- Existing tests already verify lookup semantics and security constraints in [`tests/owner-scope-services.integration.test.tsx`] (lookup scenarios around lines ~2013-2189).
- Current route status:
  - [`src/app/(shopper)/_layout.tsx`] exists.
  - no shopper screens exist yet.
  - [`src/app/index.tsx`] currently acts as entry-gate redirect and does not yet implement explicit `Buy Now` shopper CTA.
- Existing admin-session module is admin-only; avoid overloading it with shopper state. Keep admin and shopper runtime identity isolated.

### Technical Requirements

- PIN validation rules:
  - enforce minimum 4 digits before submit.
  - preserve existing service-level validation; UI validation is additive for faster feedback.
- Session handling:
  - successful PIN entry starts shopper session with session-safe fields only.
  - failed PIN entry must not create partial session state.
  - clear shopper session when flow exits/cancels (full auto-logout behavior finalized in Story 6.1, but clear-on-failure applies now).
- Navigation:
  - valid PIN routes to shopper scanner path.
  - invalid PIN keeps user on PIN screen.
  - avoid navigation calls before root layout is mounted.
- Security:
  - never log PIN input.
  - never persist plaintext PIN in route params, global stores, or debug logs.

### Architecture Compliance

- Respect architecture boundaries from [`_bmad-output/planning-artifacts/architecture.md`]:
  - UI routes and local interaction in `src/app/**`
  - business logic in `src/domain/services/**`
  - no direct SQLite writes inside route components.
- Reuse service contracts; do not duplicate PIN derivation/lookup logic in UI layer.
- Keep owner scoping explicit through resolved `ownerId` from shopper lookup result.

### Library Framework Requirements

- Project baseline (must remain unchanged in this story):
  - `expo` `~55.0.4`
  - `expo-router` `~55.0.3`
  - `react` `19.2.0`
  - `react-native` `0.83.2`
  - `scrypt-js` `^3.0.1`
- Latest technical checks verified on **2026-03-04**:
  - Expo SDK 55 release line is current for this project branch; no SDK upgrade in this story.
  - Expo Router recommends protected-route patterns for auth-like gating; route guards should keep root navigator mount ordering safe.
  - React Native Pressable accessibility semantics (`accessibilityRole`, labels, press states) should be used for keypad + submit actions.
  - `scrypt-js` remains aligned with current project usage; no PIN KDF dependency change required.

### File Structure Requirements

- Primary expected files:
  - [`src/app/index.tsx`]
  - [`src/app/(shopper)/pin.tsx`] (new)
  - [`src/app/(shopper)/scan.tsx`] (new scaffold target for Story 5.2 handoff)
  - [`src/domain/services/shopper-session.ts`] (new runtime session helper)
  - [`tests/shopper-pin-entry.integration.test.tsx`] (new)
- Potential touched files (only if required by implementation style):
  - [`src/app/(shopper)/_layout.tsx`] (route options/guards)
  - [`tests/entry-gating.integration.test.tsx`] (if entry routing expectations change)
  - [`tests/owner-scope-services.integration.test.tsx`] (if lookup contract surface is refined)
- Avoid touching DB schema/migrations for this story.

### Testing Requirements

- Add/extend integration tests for:
  - `Buy Now` path renders PIN screen from home.
  - valid PIN starts shopper session with safe identity fields and navigates to scanner route.
  - invalid PIN shows friendly error and blocks navigation.
  - ambiguous PIN lookup (`OWNER_SCOPE_CONFLICT`) blocks unlock and shows actionable message.
  - repeated rapid submit attempts trigger single in-flight lookup path (submit lock).
- Regression checks:
  - admin login/gating behavior remains unchanged.
  - shopper PIN lookup service contract remains unchanged.
- Quality gates:
  - `npm run test:gate:integration`
  - `npx tsc --noEmit`
  - `npm run lint`

### Latest Tech Information

- Expo SDK 55 changelog (released Dec 4, 2025): [https://expo.dev/changelog/sdk-55](https://expo.dev/changelog/sdk-55)
- Expo Router auth/protected route guidance: [https://docs.expo.dev/router/advanced/authentication/](https://docs.expo.dev/router/advanced/authentication/)
- Expo Router navigation-mount caveat reference: [https://docs.expo.dev/router/advanced/authentication-rewrites/](https://docs.expo.dev/router/advanced/authentication-rewrites/)
- React Native Pressable reference (accessibility + interaction behavior): [https://reactnative.dev/docs/next/pressable](https://reactnative.dev/docs/next/pressable)
- `scrypt-js` package reference: [https://www.npmjs.com/package/scrypt-js](https://www.npmjs.com/package/scrypt-js)

### Project Context Reference

- No `project-context.md` file found via pattern `**/project-context.md`.

### Story Completion Status

- Story context created and status set to `ready-for-dev`.
- Completion note: Ultimate context engine analysis completed - comprehensive developer guide created.

### References

- [`_bmad-output/planning-artifacts/epics.md`]
- [`_bmad-output/planning-artifacts/prd.md`]
- [`_bmad-output/planning-artifacts/architecture.md`]
- [`_bmad-output/planning-artifacts/ux-design-specification.md`]
- [`src/app/index.tsx`]
- [`src/app/(shopper)/_layout.tsx`]
- [`src/domain/services/shopper-service.ts`]
- [`src/domain/services/admin-session.ts`]
- [`src/db/schema.ts`]
- [`tests/owner-scope-services.integration.test.tsx`]
- [`tests/entry-gating.integration.test.tsx`]
- [`tests/admin-session.integration.test.tsx`]

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Workflow engine loaded: `_bmad/core/tasks/workflow.xml`
- Workflow config loaded: `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`
- Story path provided by user: `_bmad-output/implementation-artifacts/5-1-pin-entry-unlocks-shopper-session.md`
- Sprint status updated for `5-1-pin-entry-unlocks-shopper-session`: `in-progress` → `review` → `done`
- Red phase executed: failing tests added in `tests/entry-gating.integration.test.tsx` and `tests/shopper-pin-entry.integration.test.tsx`
- Green/refactor completed across `src/app/index.tsx`, `src/app/(shopper)/pin.tsx`, and `src/app/(shopper)/scan.tsx`
- Quality gates executed successfully:
  - `npm run test:gate:integration` (17 suites, 211 tests)
  - `npx tsc --noEmit`
  - `npm run lint`

### Completion Notes List

- Added explicit home entry actions (`Buy Now`, `Admin`) and preserved admin routing via existing gate resolver contract.
- Implemented shopper PIN route with keypad UI, submit lock, non-judgmental error handling, explicit `OWNER_SCOPE_NOT_FOUND`/`OWNER_SCOPE_CONFLICT`/`OWNER_SCOPE_INVALID_INPUT` handling, and PIN state clearing after every submit attempt.
- Added runtime shopper session module with immutable session-safe identity state and subscription APIs.
- Added scanner handoff placeholder route guarded by active shopper session; missing session redirects back to PIN.
- Added integration coverage for shopper unlock happy path, not-found/ambiguous/invalid-input outcomes, submit lock behavior, and scanner route guard behavior.
- Updated entry-gating integration tests for new home entry contract while keeping admin gating scenarios green.
- ✅ Resolved review finding [High]: Added explicit shopper-flow session teardown on scanner-flow exit using back/pop remove guards plus cancellation path coverage.
- ✅ Resolved review finding [Medium]: Added defensive `catch` handling for Admin entry route resolution to surface safe retry copy on thrown promise rejections.
- ✅ Resolved review finding [Medium]: Added defensive `catch` handling for shopper PIN lookup submission to surface safe retry copy on thrown promise rejections.
- ✅ Resolved review finding [Low]: Synced Dev Agent Record file list with current changed artifact set.
- ✅ Resolved re-review finding [Medium]: Scoped scanner teardown listener to true exit actions (`GO_BACK`/`POP`/`POP_TO_TOP`) to avoid future shopper-flow session resets on non-exit navigation.
- ✅ Resolved re-review finding [Low]: Reused `DEFAULT_GATE_ERROR_MESSAGE` constant from entry-gate runtime to prevent copy drift between runtime and home-screen fallback handling.
- ✅ Resolved re-review finding [Low]: Tightened PIN error mapping to `OwnerScopeErrorCode` typing and added integration coverage for scanner back-navigation teardown.

### File List

- `_bmad-output/implementation-artifacts/5-1-pin-entry-unlocks-shopper-session.md`
- `_bmad-output/implementation-artifacts/epic-4-retro-2026-03-04.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/app/index.tsx`
- `src/app/(shopper)/pin.tsx`
- `src/app/(shopper)/scan.tsx`
- `src/domain/services/shopper-session.ts`
- `tests/entry-gating.integration.test.tsx`
- `tests/shopper-pin-entry.integration.test.tsx`

### Change Log

- 2026-03-04: Implemented Story 5.1 shopper PIN unlock flow, shopper session runtime, scanner handoff placeholder, and integration test coverage; story moved to `review`.
- 2026-03-04: Senior Developer Review (AI) completed. Outcome: Changes Requested. Story moved to `in-progress`; added 1 High, 2 Medium, and 1 Low follow-up action items.
- 2026-03-04: Addressed code review findings - 4 items resolved (1 High, 2 Medium, 1 Low); reran quality gates and moved story to `review`.
- 2026-03-04: Adversarial re-review completed. Resolved 1 Medium + 2 Low findings, reran quality gates, and moved story to `done`.

## Senior Developer Review (AI)

### Review Date

- 2026-03-04

### Outcome

- Changes Requested

### Findings

- **[High] Missing clear-on-exit/cancel session handling (story requirement gap):** Story technical requirements require shopper session clearing when the flow exits/cancels, but current implementation only clears on failed PIN submit. This leaves stale shopper session state when users leave the scan flow via navigation/back. Evidence: requirement in this story (`clear shopper session when flow exits/cancels`) and `clearShopperSession()` only used in failed PIN path. [`_bmad-output/implementation-artifacts/5-1-pin-entry-unlocks-shopper-session.md:88`] [`src/app/(shopper)/pin.tsx:75`]
- **[Medium] Unhandled async rejection path in home Admin entry:** `onPressAdmin` awaits `resolveEntryRouteFromAdminCheck` without `catch`; thrown rejections are not converted into user-safe state and can bubble as unhandled errors. [`src/app/index.tsx:34`]
- **[Medium] Unhandled async rejection path in shopper PIN submit:** `onSubmit` awaits `resolveShopperEntryByPin` without `catch`; thrown rejections are not mapped to shopper-safe error copy and can bubble as unhandled runtime errors. [`src/app/(shopper)/pin.tsx:73`]
- **[Low] Story file list drift vs git reality:** The working tree currently includes `_bmad-output/implementation-artifacts/epic-4-retro-2026-03-04.md` as changed, but it is missing from the story's Dev Agent Record file list. [`_bmad-output/implementation-artifacts/5-1-pin-entry-unlocks-shopper-session.md:210`]

### Validation Notes

- Re-ran quality gates during review:
  - `npm run test:gate:integration` (17 suites, 207 tests, pass)
  - `npx tsc --noEmit` (pass)
  - `npm run lint` (pass)

### Re-Review (AI)

#### Review Date

- 2026-03-04

#### Outcome

- Approve

#### Findings

- **[Medium][Resolved] Session teardown trigger was too broad for future shopper navigation:** Scanner session clearing on any route removal could clear authenticated shopper context during future non-exit transitions in Epic 5.2+ if a remove-style navigation action is used. Fixed by limiting automatic teardown to exit-class remove actions (`GO_BACK`, `POP`, `POP_TO_TOP`) while keeping explicit cancel path clearing. [`src/app/(shopper)/scan.tsx`]
- **[Low][Resolved] Home fallback copy drift risk:** Home-screen catch path used a local hardcoded fallback string that can diverge from `entry-gate-runtime` canonical messaging. Fixed by reusing `DEFAULT_GATE_ERROR_MESSAGE` and exporting the same constant in route-runtime test mocks. [`src/app/index.tsx`] [`tests/entry-gating.integration.test.tsx`] [`tests/shopper-pin-entry.integration.test.tsx`]
- **[Low][Resolved] PIN error mapping typing gap:** `mapPinEntryErrorMessage` accepted an unbounded `string`, reducing compile-time guarantees for owner-scope error-code handling. Fixed by constraining to `OwnerScopeErrorCode` and using canonical `OWNER_SCOPE_UNAVAILABLE` fallback path in exception handling. [`src/app/(shopper)/pin.tsx`]

#### Validation Notes

- Re-ran quality gates during re-review:
  - `npm run test:gate:integration` (17 suites, 211 tests, pass)
  - `npx tsc --noEmit` (pass)
  - `npm run lint` (pass)
