# Story 2.3: Manage Shoppers (Per Owner) with Unique PINs

Status: in-progress

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As an admin,
I want to create and manage shoppers with a 4+ digit PIN,
so that only enrolled shoppers can buy on credit for the active owner.

## Acceptance Criteria

1. **Given** I am logged in as admin and an owner is active
   **When** I create a shopper with a name and a PIN of at least 4 digits
   **Then** the shopper is created under the active owner (FR11)
   **And** the PIN is not stored in plaintext (stored as a secure derived value).
2. **Given** a shopper PIN is already in use on the device (any owner)
   **When** I attempt to create or update a shopper using the duplicate PIN
   **Then** the system blocks the save and prompts for a different PIN (FR12).
3. **Given** an existing shopper
   **When** I update the shopper's name
   **Then** the updated name is reflected in the admin shopper list.

## Tasks / Subtasks

- [x] Upgrade shopper PIN persistence to secure derived storage (AC: 1, 2)
  - [x] Replace direct shopper `pin` storage with derived payload format in `src/db/schema.ts` (for example `pin_hash`), and add a migration in `src/db/migrations/*`.
  - [x] Ensure create/update shopper flows derive PIN through existing `src/domain/services/password-derivation.ts` utilities; never persist raw PIN digits.
  - [x] Keep migration backward-safe for local devices that already have shoppers.

- [x] Enforce device-wide PIN uniqueness at write-time (AC: 2)
  - [x] Add DB-level uniqueness that enforces PIN uniqueness across all owners on the device (not owner-scoped uniqueness).
  - [x] Update `src/domain/services/shopper-service.ts` duplicate handling so DB uniqueness failures map to a stable user-facing error.
  - [x] Verify update flows cannot silently keep conflicting PINs.

- [x] Maintain owner scoping for shopper identity management (AC: 1, 3)
  - [x] Keep shopper reads and name updates owner-scoped via `requireActiveOwnerContext`.
  - [x] Reject cross-owner updates with existing owner-scope error contracts.
  - [x] Ensure shopper lists in admin surfaces show only active-owner shoppers.

- [x] Apply admin UX and validation guardrails for shopper create/update (AC: 1, 2, 3)
  - [x] Validate PIN format (`^\d{4,}$`) before write attempts and show clear recovery copy.
  - [x] Ensure shopper create/edit UI never echoes stored PIN material and never logs PINs.
  - [x] Keep shared-device friendly feedback for duplicate PIN conflicts and successful save.

- [x] Add/extend automated tests for secure PIN + uniqueness behavior (AC: 1, 2, 3)
  - [x] `tests/owner-scope-services.integration.test.tsx`: add coverage for duplicate PIN conflict across different owners.
  - [x] Add or extend shopper-service tests to assert persisted data is derived value, not plaintext.
  - [x] Add update-path tests that verify name-only updates work and PIN uniqueness still blocks duplicates.

- [x] Validate quality gates before handoff
  - [x] Run `npm run test:gate:all`.
  - [x] Run `npx tsc --noEmit`.
  - [x] Run `npm run lint`.

- [x] Review Follow-ups (AI)
  - [x] [AI-Review][HIGH] Fix migration SQL: `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` is invalid in SQLite and can break bootstrap on migrated devices. [src/db/migrations/0004_shopper_pin_hash_global_uniqueness.ts:4]
  - [x] [AI-Review][HIGH] Prevent name-only shopper edits from clearing existing PIN hash when PIN input is left blank. [src/app/(admin)/owner-data.tsx:208]
  - [x] [AI-Review][HIGH] Enforce required PIN on shopper creation (4+ digits) instead of allowing null PIN. [src/app/(admin)/owner-data.tsx:117]
  - [x] [AI-Review][MEDIUM] Replace fixed shopper PIN salt with a device-scoped random salt strategy to avoid deterministic cross-install hashes. [src/domain/services/password-derivation.ts:41]
  - [x] [AI-Review][MEDIUM] Add regression tests for required-create PIN, name-only update preserving PIN hash, and migration SQL compatibility. [tests/owner-data-scope.integration.test.tsx:117]

- [ ] Review Follow-ups (AI) - Pass 2
  - [ ] [AI-Review][HIGH] Backfill existing legacy shopper `pin` rows into `pin_hash` and clear plaintext `pin` so migrated devices no longer retain plaintext PINs. [src/db/migrations/0004_shopper_pin_hash_global_uniqueness.ts:3]
  - [ ] [AI-Review][HIGH] Reject explicit PIN clearing on shopper updates (`pin: null` / empty) to keep shopper records compliant with required 4+ digit PIN rules. [src/domain/services/shopper-service.ts:328]
  - [ ] [AI-Review][MEDIUM] Decouple device-wide uniqueness from serialized scrypt params (indexing full `storageValue`) so future KDF param changes cannot permit duplicate raw PINs. [src/db/schema.ts:101]
  - [ ] [AI-Review][LOW] Remove React `act(...)` warnings in owner-data integration tests to keep CI logs clean and prevent warning fatigue. [tests/owner-data-scope.integration.test.tsx:109]

## Dev Notes

### Story Foundation

- Epic 2 objective is strict multi-owner operation while preventing identity ambiguity on a shared device.
- Story 2.3 introduces shopper lifecycle management and secure PIN handling before Story 2.4 formalizes unambiguous PIN lookup behavior.
- Source story requirements come from Epic 2, Story 2.3 in `_bmad-output/planning-artifacts/epics.md`.

### Technical Requirements

- PIN must be numeric with minimum 4 digits.
- PIN must never be stored in plaintext.
- PIN uniqueness is device-wide (global across owners), not owner-local.
- Shopper record must remain owner-associated (FR11) and owner-scoped for read/update operations.
- Existing result contract patterns must stay intact (`OwnerScopeResult` style outcomes and typed scope errors).

### Architecture Compliance

- Keep all schema and migration changes in `src/db/**`.
- Keep write logic in domain services (`src/domain/services/**`); no direct DB writes from screens.
- Follow existing persistence naming conventions (`snake_case`, `*_at_ms`).
- Maintain owner-scope checks through `src/domain/services/owner-scope.ts` for all shopper reads/updates.
- Preserve offline-first behavior with no network dependency.

### Library & Framework Requirements

- Continue on Expo SDK 55 stack in this repo.
- Use existing `scrypt-js`-based derivation utilities in `src/domain/services/password-derivation.ts`.
- Keep Expo Router admin route protections and existing admin session model.
- SQLite remains persistence source via `expo-sqlite`; do not introduce alternative storage.

### File Structure Requirements

- Primary implementation targets:
  - `src/db/schema.ts`
  - `src/db/migrations/*`
  - `src/domain/services/shopper-service.ts`
  - `src/domain/services/password-derivation.ts` (reuse helpers; extend only if strictly needed)
  - `src/domain/services/owner-data-service.ts`
  - `src/app/(admin)/owner-data.tsx`
  - `tests/owner-scope-services.integration.test.tsx`
  - additional shopper-focused tests under `tests/*shopper*` if introduced

### Testing Requirements

- Positive:
  - Create shopper with valid 4+ digit PIN and confirm active-owner association.
  - Rename shopper and verify list reflects updated name.
- Security:
  - Assert persisted shopper PIN material is derived/hash payload and not raw digits.
- Negative:
  - Attempt duplicate PIN in same owner and different owner; both must fail with safe message.
  - Attempt cross-owner shopper update; must fail with owner-scope mismatch error.
- Regression:
  - Existing owner switching, owner data snapshot, and Story 2.2 isolation behavior remain passing.

### Previous Story Intelligence

- Story 2.2 established critical patterns to keep:
  - Shared owner-scope guardrails in `owner-scope.ts`.
  - Service-layer write ownership checks before DB mutation.
  - Integration tests validating cross-owner rejections.
- Story 2.2 changelog also tightened DB constraint handling and safe error mapping. Reuse that approach for new global PIN uniqueness constraint mapping.

### Git Intelligence Summary

- Recent sequence:
  - `f1c6553` Story 2.2 done (owner isolation hardening)
  - `0716a3b` Story 2.1 done (owner create/switch baseline)
- This means shopper PIN work should extend current owner-scope services rather than introduce a new shopper/session subsystem.
- Existing tests already mock/verify owner context; extend those patterns for duplicate PIN and derived PIN assertions.

### Latest Tech Information (verified 2026-03-03)

- Expo SDK 55 is documented as the active SDK line in Expo changelog and this repo already pins SDK 55-compatible packages.
  - Source: https://expo.dev/changelog/sdk-55
- Expo SQLite SDK 55 docs confirm local SQLite usage patterns for this architecture direction.
  - Source: https://docs.expo.dev/versions/v55.0.0/sdk/sqlite/
- Expo Crypto SDK 55 docs cover cryptographic utilities used alongside KDF workflows.
  - Source: https://docs.expo.dev/versions/v55.0.0/sdk/crypto/
- Drizzle’s Expo SQLite guide remains the reference if typed schema/query expansion is needed in follow-up stories.
  - Source: https://orm.drizzle.team/docs/connect-expo-sqlite

### Project Structure Notes

- Current code already includes `shopper-service` and owner-data admin route; this story should harden existing paths, not fork new flows.
- Schema currently contains shopper PIN-related columns/indexes; update them carefully to avoid migration regressions.
- Keep owner context visible in admin surfaces to avoid wrong-owner shopper operations.

### References

- `_bmad-output/planning-artifacts/epics.md` (Epic 2, Story 2.3)
- `_bmad-output/planning-artifacts/prd.md` (FR11, FR12, NFR-S1)
- `_bmad-output/planning-artifacts/architecture.md` (owner scoping, service boundaries, security)
- `_bmad-output/planning-artifacts/ux-design-specification.md` (shared-device safety and clear recovery messaging)
- `_bmad-output/implementation-artifacts/2-2-owner-data-isolation-enforcement.md` (prior-story implementation learnings)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (story tracking source)

### Project Context Reference

- No `project-context.md` file was discovered in repository scan.

### Story Completion Status

- Story implementation reviewed by Senior Developer Review (AI).
- Status set to `in-progress` pending follow-up fixes.
- Completion note: High/Medium review findings recorded with action items.

## Dev Agent Record

### Agent Model Used

GPT-5 (Codex)

### Debug Log References

- Workflow engine loaded: `_bmad/core/tasks/workflow.xml`
- Workflow config loaded: `_bmad/bmm/workflows/4-implementation/dev-story/workflow.yaml`
- Story instructions loaded: `_bmad/bmm/workflows/4-implementation/dev-story/instructions.xml`
- Targeted test validation: `npx jest --config ./jest.config.cjs tests/owner-data-scope.integration.test.tsx tests/owner-scope-services.integration.test.tsx tests/password-derivation.integration.test.tsx tests/shopper-pin-migration.integration.test.tsx --runInBand --watchman=false`
- Quality gates: `npm run test:gate:all`, `npx tsc --noEmit`, `npm run lint`

### Implementation Plan

- Harden shopper PIN persistence to derived/hash-only storage.
- Enforce device-wide uniqueness at DB and service error-mapping layers.
- Keep owner-scoped shopper CRUD behavior aligned with Story 2.2 guardrails.
- Expand integration tests for duplicate PIN conflicts across owners and non-plaintext persistence assertions.

### Completion Notes List

- Added `pin_hash`-based shopper persistence plus migration `0004_shopper_pin_hash_global_uniqueness.ts` for backward-safe schema evolution.
- Updated shopper create/update flows to derive PIN credentials via `password-derivation.ts` and to avoid storing raw PIN digits.
- Enforced device-wide duplicate PIN handling with stable conflict messaging for create and update paths.
- Preserved owner-scoped shopper reads/updates and cross-owner mismatch protections.
- Added admin UI PIN inputs and pre-submit PIN format validation (`^\d{4,}$`) with clear recovery copy.
- Extended integration tests for derived PIN storage, cross-owner duplicate PIN conflicts, update conflict handling, and UI PIN validation.
- ✅ Resolved review finding [HIGH]: Replaced invalid SQLite `ADD COLUMN IF NOT EXISTS` migration with compatibility-safe `ensureShopperPinHashColumn` + standard SQL migration flow.
- ✅ Resolved review finding [HIGH]: Name-only shopper edits no longer send `pin` updates from admin UI when PIN input is blank.
- ✅ Resolved review finding [HIGH]: Shopper creation now requires a 4+ digit PIN at both UI and service validation layers.
- ✅ Resolved review finding [MEDIUM]: Replaced fixed shopper PIN salt with a device-scoped random salt persisted via `app_secret` migration.
- ✅ Resolved review finding [MEDIUM]: Added regression coverage for required create PIN, name-only update behavior, password-derivation device salt behavior, and migration compatibility.
- All required quality gates passed: `test:gate:all`, `tsc --noEmit`, and `lint`.

### File List

- `_bmad-output/implementation-artifacts/2-3-manage-shoppers-per-owner-with-unique-pins.md`
- `_bmad-output/implementation-artifacts/sprint-status.yaml`
- `src/app/(admin)/owner-data.tsx`
- `src/db/db.ts`
- `src/db/migrations/0004_shopper_pin_hash_global_uniqueness.ts`
- `src/db/migrations/0005_device_secret_salt.ts`
- `src/db/schema.ts`
- `src/domain/services/password-derivation.ts`
- `src/domain/services/shopper-service.ts`
- `tests/owner-data-scope.integration.test.tsx`
- `tests/owner-scope-services.integration.test.tsx`
- `tests/password-derivation.integration.test.tsx`
- `tests/shopper-pin-migration.integration.test.tsx`

### Change Log

- 2026-03-03: Implemented Story 2.3 secure shopper PIN derivation (`pin_hash`), device-wide uniqueness enforcement, admin PIN validation UX, and integration test coverage updates.
- 2026-03-03: Senior Developer Review (AI) found unresolved High/Medium defects; story moved to `in-progress` and follow-up tasks added.
- 2026-03-03: Addressed code review findings - 5 items resolved; migration SQL compatibility fixed, required PIN enforced, name-only update safeguarded, device-scoped salt added, and regressions covered by tests.
- 2026-03-03: Senior Developer Review (AI) pass 2 found additional unresolved High/Medium issues; new follow-up tasks added and story remains `in-progress`.

### Senior Developer Review (AI)

- Review outcome: **Changes Requested**
- Story status recommendation: **in-progress**
- Git vs Story File List discrepancies: **0**
- Issues found: **3 High, 2 Medium, 0 Low**

#### Acceptance Criteria Validation

- AC1 (create shopper with 4+ digit PIN, secure storage): **PARTIAL**
  - Derived storage is used when PIN is provided.
  - Creation currently allows empty/null PIN, which violates the “4+ digit PIN” requirement.
- AC2 (device-wide duplicate PIN blocking): **PARTIAL**
  - Duplicate handling exists in service and DB uniqueness mapping.
  - Migration SQL has a SQLite syntax defect that can block rollout on existing DBs.
- AC3 (update shopper name reflected in admin list): **PARTIAL**
  - Name update path exists.
  - Current UI wiring can clear shopper PIN when doing a name-only edit, causing behavioral regression.

#### Evidence

- `npx jest --config ./jest.config.cjs tests/owner-scope-services.integration.test.tsx tests/owner-data-scope.integration.test.tsx --runInBand --watchman=false` ✅
- `npm run test:gate:all` ✅
- `npx tsc --noEmit` ✅
- `npm run lint` ✅

#### Findings

- **HIGH**: Invalid SQLite migration syntax in Story 2.3 migration.
  - `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` is not valid SQLite syntax and can fail bootstrap on upgraded databases.
  - Reference: `src/db/migrations/0004_shopper_pin_hash_global_uniqueness.ts:4`
- **HIGH**: Name-only shopper update clears existing PIN.
  - UI always passes a `pin` key; blank optional PIN is normalized to `null`, and service interprets that as explicit PIN clear.
  - References: `src/app/(admin)/owner-data.tsx:208`, `src/domain/services/shopper-service.ts:296`, `src/domain/services/shopper-service.ts:340`
- **HIGH**: Shopper creation does not require a PIN.
  - UI/service currently permit `null` PIN, conflicting with AC wording (“create shopper with ... PIN of at least 4 digits”).
  - References: `src/app/(admin)/owner-data.tsx:96`, `src/app/(admin)/owner-data.tsx:117`, `src/domain/services/shopper-service.ts:117`
- **MEDIUM**: Shopper PIN derivation uses fixed hardcoded salt.
  - Deterministic global salt produces identical derived values for same PIN across installs and weakens privacy/security.
  - References: `src/domain/services/password-derivation.ts:41`, `src/domain/services/password-derivation.ts:237`
- **MEDIUM**: Tests do not cover critical regression paths.
  - Missing tests for name-only update preserving PIN and required PIN on create; migration SQL compatibility is also untested.
  - References: `tests/owner-data-scope.integration.test.tsx:117`, `tests/owner-scope-services.integration.test.tsx:224`

### Senior Developer Review (AI) - Pass 2

- Review outcome: **Changes Requested**
- Story status recommendation: **in-progress**
- Git vs Story File List discrepancies: **0**
- Issues found: **2 High, 1 Medium, 1 Low**

#### Acceptance Criteria Validation (Pass 2)

- AC1 (create shopper with 4+ digit PIN, secure storage): **PARTIAL**
  - New shopper create path requires valid PIN and stores `pin_hash`.
  - Migrated devices can still retain legacy plaintext `shopper.pin` rows because migration does not backfill/clear existing records.
- AC2 (device-wide duplicate PIN blocking): **PARTIAL**
  - Current uniqueness relies on `pin_hash` serialized payload value.
  - If KDF params change in future releases, same raw PIN can hash to a different serialized payload and bypass uniqueness intent.
- AC3 (update shopper name reflected in admin list): **IMPLEMENTED**
  - Name-only update path is owner-scoped and no longer forces PIN updates from admin UI.

#### Evidence (Pass 2)

- `npx jest --config ./jest.config.cjs tests/owner-data-scope.integration.test.tsx tests/owner-scope-services.integration.test.tsx tests/password-derivation.integration.test.tsx tests/shopper-pin-migration.integration.test.tsx --runInBand --watchman=false` ✅ (all passing, with React `act(...)` warnings in owner-data test logs)

#### Findings (Pass 2)

- **HIGH**: Migration leaves legacy plaintext shopper PINs on upgraded devices.
  - Migration adds `pin_hash`/indexes but does not backfill existing `shopper.pin` values into derived storage or clear plaintext remnants.
  - References: `src/db/migrations/0004_shopper_pin_hash_global_uniqueness.ts:3`, `src/db/schema.ts:83`
- **HIGH**: Service still allows explicit PIN removal on shopper updates.
  - `updateShopper` accepts `pin: null` when `pin` key is present, then writes `pin_hash = NULL`, which can leave a shopper without a valid PIN.
  - References: `src/domain/services/shopper-service.ts:328`, `src/domain/services/shopper-service.ts:366`
- **MEDIUM**: Device-wide uniqueness is coupled to serialized KDF parameter payload.
  - Unique index is on full `pin_hash` storage string, which includes scrypt params and salt; future param changes can produce different storage values for the same raw PIN.
  - References: `src/db/schema.ts:101`, `src/domain/services/password-derivation.ts:153`, `src/domain/services/password-derivation.ts:232`
- **LOW**: Owner-data integration tests emit repeated React `act(...)` warnings.
  - Tests pass but noisy warnings reduce signal quality and can mask real regressions in CI logs.
  - References: `tests/owner-data-scope.integration.test.tsx:109`, `src/app/(admin)/owner-data.tsx:52`
