---
stepsCompleted: [1, 2, 3, 4, 5, 6, 7, 8]
inputDocuments:
  - /Users/kenlovestocode/Desktop/Me/ai/LilStore/_bmad-output/planning-artifacts/prd.md
  - /Users/kenlovestocode/Desktop/Me/ai/LilStore/_bmad-output/planning-artifacts/ux-design-specification.md
workflowType: 'architecture'
project_name: 'LilStore'
user_name: 'myjmyj'
date: '2026-03-02T11:45:42+08:00'
lastStep: 8
status: 'complete'
completedAt: '2026-03-02T12:21:52+08:00'
---

# Architecture Decision Document

_This document builds collaboratively through step-by-step discovery. Sections are appended as we work through each architectural decision together._

## Project Context Analysis

### Requirements Overview

**Functional Requirements (FR1–FR53):**
- Offline-first mobile app with two primary modes: Admin (owner operations) and Shopper purchase session.
- Shared-device safety:
  - Shopper sessions start only via PIN and end automatically immediately after purchase confirmation.
- Multi-owner isolation (single device, multiple owners):
  - All data (catalog, shopping list, shoppers, ledger, history, settings) is owner-scoped with zero cross-owner leakage.
- Products and purchasability:
  - Product catalog is not directly browsed by shoppers; the published shopping list defines what is purchasable, with price + available quantity.
- Purchase transaction flow:
  - Scan barcode → allowed vs not-available → quantity selection with guardrails → cart preview/edit → confirm purchase.
  - Confirmation writes immutable purchase record with timestamp + line items, decrements availability, and updates shopper balance by the computed cart total.
- Ledger and payments:
  - Running per-shopper balance plus timestamped purchase and payment histories.
- Backup/restore:
  - Export/import the entire local DB via JSON. Restore is replace-all and must be atomic and safely reject invalid/incompatible backups.
- Pricing complexity:
  - Bundle pricing rules (bundles-first computation).
  - Assorted shopping-list items: multiple barcodes share one pricing rule set and one pooled availability, but cart/history labels still reflect underlying product name with “(assorted)”.

**Non-Functional Requirements (NFR-P/R/S/U/M):**
- Performance: fast startup + scanner readiness + responsive lists for 200+ products and growing history.
- Reliability & integrity: atomic purchase confirmation, payment recording, and restore; confirm-time revalidation of availability.
- Security & privacy: hashed PINs only; session ends immediately after confirm; backups via admin-only flows.
- Usability: “Not available” must be unmissable and block cart add; cart always allows correction before confirm.
- Compatibility: backup includes schema metadata; restore rejects unsupported schema versions without modifying current data.

**Scale & Complexity:**
- Primary domain: mobile (offline-first, camera scanning, local persistence)
- Complexity level: medium (multi-tenant scoping + transactional integrity + scan-first UX + backup/restore lifecycle)
- Estimated architectural components: ~10–14 (data layer, domain services for pricing/assorted/ledger, session/auth, UI flows, backup/restore, alerts)

### Technical Constraints & Dependencies

- Expo cross-platform iOS/Android phones (low-end device support is a requirement).
- Offline-first: core flows must not depend on network availability.
- Device capabilities required:
  - Camera access for barcode scanning
  - File/share access for JSON backup export/import
- No external integrations in MVP (no payments, no cloud sync, no push notifications).

### Cross-Cutting Concerns Identified

- Owner scoping enforcement across every query, write, export, and import.
- Transactional integrity for purchase/payment/restore (prevent partial state and double-writes).
- “Source of truth” rules for balance, history immutability, and pricing auditability (store computed totals + pricing inputs used).
- UX-driven performance (scanner-ready loop, low-latency lookup, responsive lists).
- Security boundaries on shared devices (PIN hashing, auto-logout, no lingering identity, safe backup handling).
- Backup/restore versioning and validation (`schemaVersion`, fail-safe restore).

## Starter Template Evaluation

### Primary Technology Domain

Mobile app (Expo / React Native) with offline-first requirements and camera + file/share capabilities.

### Starter Options Considered

1) **Expo `create-expo-app` — `default`**
- Default template designed for multi-screen apps; includes Expo Router and TypeScript.

2) **Expo `create-expo-app` — `tabs`**
- Tabs-first scaffold using Expo Router + TypeScript; viable if we want an explicitly tabbed entry point.

3) **Expo `create-expo-app` — `blank` / `blank-typescript`**
- Minimal dependencies without navigation configured; we’d add routing/navigation structure immediately.

4) **Expo `create-expo-app` — `bare-minimum`**
- Includes native directories (runs `expo prebuild`); good when early native customization is expected, but increases native surface area.

### Selected Starter: Existing repo scaffold (Expo + Expo Router + TypeScript)

We will treat the current repository as the selected starter because it already matches the Expo SDK 55-style default scaffold:
- Expo SDK 55 (`expo: ~55.0.4`)
- Expo Router (`expo-router/entry`) with `/src/app` file-based routing
- Native tabs scaffold via `expo-router/unstable-native-tabs`

**Repro / Initialization Command (if recreating from scratch on SDK 55):**

```bash
npx create-expo-app@latest LilStore --template default@sdk-55
```

**Architectural Decisions Provided by Starter:**

**Language & Runtime:**
- TypeScript + React Native (via Expo)

**Routing / Navigation:**
- Expo Router file-based routing (`/src/app`)
- Tab layout capability via native tabs

**Styling Solution:**
- React Native styling baseline + web support scaffold (project includes `/src/global.css`)

**Build Tooling:**
- Expo CLI workflows (`expo start`, platform targets iOS/Android/web)

**Testing Framework:**
- Not included by default (to be decided later: unit/integration/e2e)

**Linting/Formatting:**
- Expo lint scaffold (`expo lint`) as baseline

**Development Experience:**
- Hot reload/dev server via Expo
- Multi-platform runs (Android/iOS/web) from the same project

**Note:** No re-initialization is required since the repo already matches the selected starter.

## Core Architectural Decisions

### Decision Priority Analysis

**Critical Decisions (Block Implementation):**
- Local database + migration strategy (offline-first source of truth).
- Backup/restore safety model (atomic replace-all, schema versioning).
- PIN hashing + lookup strategy (PIN-only login, hashed-only storage/exports).

**Important Decisions (Shape Architecture):**
- Data model partitioning (multi-owner isolation).
- Ledger correctness model (balance vs transaction history invariants).

### Data Architecture

**Selected database: SQLite (local-first)**
- Use `expo-sqlite` installed via `npx expo install expo-sqlite` (Expo will pick a version compatible with the current SDK). Reference: https://docs.expo.dev/versions/v55.0.0/sdk/sqlite/

**Data access approach**
- Use Drizzle ORM on top of `expo-sqlite` for typed schema + queries.
- Keep domain operations (purchase confirm, payment record, restore) implemented as explicit “transaction scripts” that:
  - open a transaction
  - re-validate constraints (availability, ownership, etc.)
  - write all affected rows
  - commit/rollback as one unit
- Reference: https://orm.drizzle.team/docs/connect-expo-sqlite

**Money representation**
- Store all monetary values as integer minor units (centavos) to avoid floating point issues.
- Persist both:
  - “pricing inputs” (unit price, bundle offer)
  - “computed outputs” (line total, cart total)
  for auditability and to keep history stable even if pricing rules change later.

**Migrations**
- Migrations are bundled into the app (offline-first); on startup, apply pending migrations sequentially.
- Track DB schema via:
  - `db_schema_version` table (or equivalent)
  - backup JSON `schemaVersion` + `exportedAt` metadata (must match NFR-M1/M2).

**Backup / restore model (replace-all, atomic)**
- Export:
  - Serialize all tables needed to reconstruct the DB (including purchase/payment history and current balances).
  - Write JSON using `expo-file-system` installed via `npx expo install expo-file-system`. Reference: https://docs.expo.dev/versions/v55.0.0/sdk/filesystem/
  - Share/export via `expo-sharing` installed via `npx expo install expo-sharing`. Reference: https://docs.expo.dev/versions/v55.0.0/sdk/sharing/
- Restore:
  - Validate file structure + schema version compatibility before applying any changes.
  - Apply restore as a single DB transaction (wipe tables, insert backup data, set schema version); on any error, rollback so no partial state remains.

**Ledger invariants**
- Keep immutable transaction tables:
  - `purchase` and `purchase_line_item`
  - `payment`
- Maintain a denormalized `shopper_balance_minor` field for speed, but update it in the same transaction as purchase/payment inserts.
- Optional repair path: recompute balance from history when needed (admin-only).

### Authentication & Security

**Authentication model**
- Admin: username + password login; manual logout.
- Shopper: PIN-only login to start a purchase session; session ends automatically immediately after purchase confirmation.

**PIN storage / lookup / uniqueness (device-wide)**
- Store shopper PINs as a KDF output only (never plaintext).
- Generate and persist a random `pin_kdf_salt_device` in the local DB (and include it in backups so restore preserves login behavior).
- Derive `pin_kdf = scrypt(pin, pin_kdf_salt_device, params)` and enforce a UNIQUE constraint on `pin_kdf` to guarantee PIN uniqueness across all shoppers on the device.
- PIN lookup: compute `pin_kdf` from entered PIN and query the shopper by `pin_kdf` (O(1), no full-table scan).

**Admin password storage**
- Store `password_kdf` using scrypt with a per-admin random salt.
- Never store or export plaintext passwords.

**KDF implementation**
- Use `scrypt-js` (async) for KDF.
- Use `expo-crypto` to generate cryptographically secure random salts. Reference: https://docs.expo.dev/versions/v55.0.0/sdk/crypto/

**Authorization boundaries**
- Admin screens require an active admin session.
- Shopper screens require an active shopper session, scoped to a single ownerId.
- Enforce ownerId scoping on every query/write (no cross-owner leakage).

**Session safety**
- Shopper session is cleared immediately after confirm purchase (required).
- Optional hardening: clear shopper session when app backgrounds or after inactivity.

### API & Communication Patterns

**MVP stance**
- No network API in MVP; all application behavior is local-first and offline-capable.
- Treat “API” boundaries as in-process domain services to keep UI decoupled from persistence details.

**Service boundaries (in-app)**
- Define typed domain services that encapsulate DB writes and invariants:
  - `ProductService` (catalog CRUD + barcode uniqueness per owner)
  - `ShoppingListService` (publishable availability + pricing rules + assorted groups)
  - `PurchaseService` (scan-to-cart and confirm purchase transaction)
  - `LedgerService` (payments + balance updates)
  - `BackupService` (export + validate + restore replace-all)

**Error contract**
- All service methods return a stable result type:
  - `ok: true` with a value, or
  - `ok: false` with a typed error `{ code, message, details? }`
- Use stable error codes to drive UX states consistently, e.g.:
  - `INVALID_PIN`, `NOT_AVAILABLE`, `INSUFFICIENT_STOCK`, `DUPLICATE_BARCODE`, `DUPLICATE_PIN`
  - `RESTORE_INVALID_FILE`, `RESTORE_SCHEMA_MISMATCH`, `RESTORE_FAILED`
  - `PERMISSION_DENIED_CAMERA`, `PERMISSION_DENIED_FILESYSTEM`

**Eventing / updates**
- After successful writes, emit a lightweight in-app event (or state update) so relevant screens refresh without tight coupling.
- No real-time / multi-client sync concerns in MVP.

### Frontend Architecture

**Routing & navigation structure**
- Use Expo Router file-based routing (`/src/app`).
- Organize routes by role to reinforce security boundaries:
  - `(admin)` route group for authenticated admin screens
  - `(shopper)` route group for PIN-gated shopper purchase session screens
- Keep the shopper “Buy Now” flow stack-like (PIN → scan → qty → cart → recorded) even if tabs exist, to preserve the rapid loop.

**State management**
- Use a lightweight client state store (Zustand) for:
  - session state (`admin` vs `shopper`, active ownerId, active shopperId)
  - cart draft state (scanned items, quantities, computed previews)
  - UI flags (loading, permission prompts, last-scan feedback)
- Treat SQLite as the source of truth for persisted state; UI state is derived/cached.

**Data reads & refresh**
- Prefer explicit data hooks per screen (e.g., `useProducts(ownerId)`, `useShoppingList(ownerId)`).
- Trigger refresh via a simple “db changed” signal (event emitter / store counter) after writes complete, avoiding tight coupling between screens and services.

**Performance**
- Use list virtualization for admin lists expected to hit 200+ items; prefer `@shopify/flash-list` for smoother scrolling on low-end devices.
- Avoid expensive rerenders in scan flow; keep scanner UI minimal and isolate state updates.

**Form strategy**
- Keep forms simple and controlled for MVP; adopt React Hook Form later if admin screens become form-heavy.

### Infrastructure & Deployment

**MVP stance**
- No backend infrastructure required for core MVP functionality (offline-first, local DB is source of truth).

**Build & distribution**
- Use EAS Build for producing installable iOS/Android builds (internal distribution for testing).
- Use a custom Expo dev client if/when native modules beyond Expo Go are required.

**Over-the-air updates**
- Use Expo Updates for shipping JS/asset changes that do not require native rebuilds.
- Treat native dependency changes as rebuild-required releases.

**CI / quality gates**
- Minimal CI pipeline:
  - `npm ci`
  - TypeScript typecheck
  - `expo lint`

**Monitoring & diagnostics**
- Capture runtime errors (e.g., Sentry) to detect crashes and restore/purchase edge cases in the field.
- Add structured local logging around:
  - purchase confirm failures
  - restore validation failures
  - restore transaction failures

**Environment configuration**
- Keep environment config minimal; offline-first means no runtime secrets are required for MVP.
- Use environment variables for non-secret flags (feature toggles, build channels) and keep sensitive values out of the client.

## Implementation Patterns & Consistency Rules

### Pattern Categories Defined

**Critical conflict points identified:** 10+ areas where AI agents could make different choices and cause merge or runtime conflicts (DB naming, service boundaries, error codes, timestamps/money formats, session rules, route structure, file layout, imports, logging, and transaction handling).

### Naming Patterns

**Database naming conventions**
- Tables: `snake_case` singular (e.g., `store_owner`, `shopping_list_item`, `purchase_line_item`).
- Columns: `snake_case` (e.g., `owner_id`, `created_at_ms`, `unit_price_minor`).
- Primary keys: `id` (TEXT uuid) unless there’s a strong reason otherwise.
- Foreign keys: `<entity>_id` (e.g., `owner_id`, `shopper_id`).
- Indices: `idx_<table>__<col1>__<col2>` (e.g., `idx_product__owner_id__barcode`).
- Unique constraints: `uq_<table>__<col1>__<col2>` (e.g., `uq_shopper__pin_kdf`).

**Code naming conventions**
- TypeScript/TSX:
  - Components: `PascalCase` (`PinPad`, `RecordedReceipt`).
  - Hooks: `useX` (`useActiveOwnerId`, `useShoppingList`).
  - Services: `XService` (`PurchaseService`).
  - Types: `PascalCase` (`ShoppingListItem`, `AppError`).
- File names:
  - Components: `kebab-case.tsx` (e.g., `recorded-receipt.tsx`).
  - Non-UI modules: `kebab-case.ts` (e.g., `purchase-service.ts`, `db-schema.ts`).

**Domain naming rules**
- “Owner” means `store_owner` in DB and `StoreOwner` in code.
- “Shopping list item” means purchasable availability entry (not “product”).
- “Product” is catalog-only; shoppers never see the full product list.

### Structure Patterns

**Project organization (authoritative)**
- Routes/screens: `src/app/**` (Expo Router).
  - Role groups: `src/app/(admin)/**` and `src/app/(shopper)/**`.
- Domain services (business rules + transactions): `src/domain/services/**`.
- Domain models + shared types: `src/domain/models/**`.
- DB layer (schema, migrations, connection helpers): `src/db/**`.
- App state (Zustand stores): `src/stores/**`.
- UI components:
  - Reusable primitives: `src/components/ui/**`
  - App-specific composites: `src/components/**`
- Shared utilities: `src/lib/**` (pure helpers, no DB writes).

**Write rules**
- UI components MUST NOT write to SQLite directly.
- All DB writes MUST go through a domain service method.
- All multi-table writes MUST be in a single transaction.

**Imports**
- Prefer absolute imports with the existing `@/` alias (e.g., `@/domain/services/purchase-service`).
- Never import across route groups by relative `../../..` chains.

### Format Patterns

**Result / error format (in-process “API”)**
- All domain service methods return a stable `Result<T, AppError>`:
  - success: `{ ok: true, value: T }`
  - failure: `{ ok: false, error: { code, message, details? } }`
- Error codes MUST be enumerated (single source of truth), e.g. `AppErrorCode`.
- UI maps error codes to UX states; do not branch on error message strings.

**Money**
- Store + compute in integer minor units (`*_minor`) everywhere.
- Persist computed totals on purchase for auditability (`line_total_minor`, `cart_total_minor`).

**Timestamps**
- Store timestamps as integer epoch milliseconds in DB (`*_at_ms`).
- Present in UI as localized display; export/import as ms integers plus top-level `exportedAt` ISO string for readability.

**JSON formats (backup)**
- Backup JSON uses `camelCase` keys.
- Backup metadata includes:
  - `schemaVersion` (integer)
  - `exportedAt` (ISO string)
  - optional `appVersion` / `sdkVersion` (strings)

### Communication Patterns

**In-app events**
- Use a small typed event emitter (or Zustand counter) to signal DB changes.
- Event names are `kebab-case` with namespaces:
  - `db-changed`, `session-changed`, `owner-switched`
- Payloads MUST include `ownerId` when the change is owner-scoped.

**State management**
- Persisted truth is SQLite; Zustand is for session + cart draft + UI state.
- Cart draft is ephemeral:
  - it is cleared after successful purchase confirm (required)
  - it is never exported in backups

### Process Patterns

**Transactions**
- Any operation that affects multiple invariants MUST be done as one transaction:
  - purchase confirm: history + line items + quantity decrement + balance update
  - payment record: payment row + balance update
  - restore: wipe + insert + schema version set
- Re-validate constraints at “commit time” (confirm purchase) even if they were validated earlier in the flow.

**Loading states**
- Service calls expose explicit loading state in UI (disable confirm buttons, prevent double-submit).
- Confirm purchase and restore operations MUST be idempotency-safe in UI (disable while running, prevent repeated submits).

**Logging**
- Use tagged logs:
  - `console.info('[purchase]', ...)`
  - `console.warn('[restore]', ...)`
  - `console.error('[db]', ...)`
- Never log secrets (PIN digits, password inputs).

### Enforcement Guidelines

**All AI agents MUST**
- Add/modify DB schema only in `src/db/**` and update migrations.
- Put all DB writes behind domain services in `src/domain/services/**`.
- Use `*_minor` for money and `*_at_ms` for timestamps in persisted data.
- Return `Result<T, AppError>` from services; use error codes, not strings.
- Respect route-group boundaries: `(admin)` vs `(shopper)` screens are gated by session type.

**Anti-patterns (do not do)**
- Writing to SQLite from a screen/component.
- Using floats for money totals.
- Using locale-dependent timestamp strings as persisted data.
- “Fixing” bugs by bypassing transactions or skipping confirm-time validation.

## Project Structure & Boundaries

### Complete Project Directory Structure

```txt
LilStore/
├─ README.md
├─ app.json
├─ expo-env.d.ts
├─ tsconfig.json
├─ package.json
├─ package-lock.json
├─ assets/
│  ├─ images/
│  │  └─ tabIcons/
│  └─ fonts/
├─ docs/
│  └─ (future project docs)
├─ _bmad-output/
│  └─ planning-artifacts/
│     └─ architecture.md
├─ .github/
│  └─ workflows/
│     └─ ci.yml
└─ src/
   ├─ global.css
   ├─ app/
   │  ├─ _layout.tsx
   │  ├─ index.tsx                          # Home (Admin / Buy Now entry)
   │  ├─ (admin)/
   │  │  ├─ _layout.tsx
   │  │  ├─ login.tsx                       # FR1–FR5, AC1–AC3
   │  │  ├─ dashboard.tsx                   # FR44–FR46
   │  │  ├─ owners/
   │  │  │  ├─ index.tsx                    # FR8–FR10
   │  │  │  └─ edit.tsx
   │  │  ├─ products/
   │  │  │  ├─ index.tsx                    # FR13–FR17
   │  │  │  └─ edit.tsx
   │  │  ├─ shopping-list/
   │  │  │  ├─ index.tsx                    # FR18–FR21, FR47–FR53
   │  │  │  ├─ edit-item.tsx
   │  │  │  └─ edit-assorted.tsx
   │  │  ├─ shoppers/
   │  │  │  ├─ index.tsx                    # FR11–FR12
   │  │  │  └─ edit.tsx
   │  │  ├─ ledger/
   │  │  │  ├─ index.tsx                    # FR32–FR35
   │  │  │  └─ record-payment.tsx
   │  │  ├─ history/
   │  │  │  ├─ purchases.tsx                # FR36, FR31
   │  │  │  └─ payments.tsx                 # FR37
   │  │  └─ data/
   │  │     ├─ export.tsx                   # FR39–FR40
   │  │     └─ restore.tsx                  # FR41–FR43
   │  └─ (shopper)/
   │     ├─ _layout.tsx
   │     ├─ pin.tsx                         # FR6, FR12, NFR-S1
   │     ├─ scan.tsx                        # FR22–FR24 + permissions
   │     ├─ item.tsx                        # FR25–FR26 + assorted logic
   │     ├─ cart.tsx                        # FR27–FR28, FR49
   │     └─ recorded.tsx                    # FR29–FR33, FR7, NFR-S2
   ├─ components/
   │  ├─ ui/
   │  ├─ (shared composites)
   │  └─ (existing themed components)
   ├─ constants/
   │  └─ theme.ts
   ├─ hooks/
   ├─ stores/
   │  ├─ session-store.ts                   # admin vs shopper, active owner/shopper
   │  └─ cart-store.ts                      # cart draft (ephemeral)
   ├─ domain/
   │  ├─ models/
   │  │  ├─ money.ts                        # minor-units helpers
   │  │  ├─ result.ts                       # Result<T, AppError>
   │  │  └─ errors.ts                       # AppErrorCode enum + mapping
   │  └─ services/
   │     ├─ auth-service.ts                 # admin auth + shopper PIN verify
   │     ├─ owner-service.ts                # FR8–FR10 scoping
   │     ├─ product-service.ts              # FR13–FR17
   │     ├─ shopping-list-service.ts        # FR18–FR21 + pricing rules + assorted
   │     ├─ purchase-service.ts             # confirm txn: history + qty + ledger
   │     ├─ ledger-service.ts               # payments + balance updates
   │     └─ backup-service.ts               # export/validate/restore replace-all
   ├─ db/
   │  ├─ db.ts                              # open DB + migrations bootstrap
   │  ├─ schema.ts                          # table/column definitions
   │  ├─ migrations/
   │  │  └─ (timestamped migration files)
   │  └─ queries/
   │     └─ (read helpers only; no writes)
   ├─ lib/
   │  ├─ logger.ts
   │  └─ event-bus.ts                       # db-changed, session-changed
   └─ (existing files...)
```

### Architectural Boundaries

**UI boundary (screens/components)**
- Lives in `src/app/**` and `src/components/**`.
- Must not write to SQLite directly.

**Service boundary (business rules + invariants)**
- Lives in `src/domain/services/**`.
- Owns transactions + confirm-time validation + error codes.

**Data boundary (persistence)**
- Lives in `src/db/**`.
- Owns schema, migrations, DB opening, and low-level query helpers.

**State boundary**
- Lives in `src/stores/**`.
- Holds only ephemeral UI/session/cart state; SQLite remains persisted source of truth.

### Requirements to Structure Mapping (PRD)

- Access/Roles/Sessions (FR1–FR7) → `src/app/(admin)/login.tsx`, `src/domain/services/auth-service.ts`, `src/stores/session-store.ts`
- Multi-owner isolation (FR8–FR12) → `src/app/(admin)/owners/*`, ownerId scoping enforced in `src/domain/services/*` + `src/db/schema.ts`
- Products (FR13–FR17) → `src/app/(admin)/products/*`, `src/domain/services/product-service.ts`
- Shopping list + pricing (FR18–FR21, FR47–FR53) → `src/app/(admin)/shopping-list/*`, `src/domain/services/shopping-list-service.ts`
- Shopper flow (FR22–FR29) → `src/app/(shopper)/*`, `src/stores/cart-store.ts`
- Inventory/ledger/history (FR30–FR38) → `src/domain/services/purchase-service.ts`, `src/domain/services/ledger-service.ts`, admin history screens
- Backup/restore (FR39–FR43) → `src/app/(admin)/data/*`, `src/domain/services/backup-service.ts`
- Alerts/reminders (FR44–FR46) → `src/app/(admin)/dashboard.tsx` + queries in `src/db/queries/**`

### Integration Points

**Internal communication**
- Screens call domain services; services return `Result<T, AppError>`; UI maps `AppErrorCode` to UX.
- DB change notifications flow through `src/lib/event-bus.ts` to trigger list refresh hooks.

**External integrations (MVP)**
- None (offline-first); device capabilities only (camera + file/share).

### Test Organization (when added)

- Unit tests co-located as `*.test.ts` under `src/domain/**` and `src/db/**` for business rules and pricing math.
- E2E tests (optional) in `e2e/**` if we adopt Detox later.

## Architecture Validation Results

### Coherence Validation ✅

**Decision Compatibility:**
- Offline-first MVP is consistent with “no network API” and the local SQLite source-of-truth.
- Role separation (admin vs shopper) is consistent across routing (`(admin)` / `(shopper)`), session state, and service boundaries.
- Transaction-first domain services align with the atomicity requirements for purchase confirm, payment recording, and restore.

**Pattern Consistency:**
- Naming conventions (`snake_case` in DB; typed `Result<T, AppError>` in services; stable error codes) reduce multi-agent implementation drift.
- Money/timestamps formats are defined (`*_minor`, `*_at_ms`) and consistent across persistence, exports, and UI mapping.

**Structure Alignment:**
- The project tree maps requirements into concrete locations and respects UI/service/DB boundaries.
- Integration points are explicit (screens → services → DB; db-changed eventing).

### Requirements Coverage Validation ✅

**Functional Requirements Coverage:**
- Access/Roles/Sessions (FR1–FR7): covered via `auth-service`, admin login screen, shopper PIN flow, and session clearing rules.
- Multi-owner isolation (FR8–FR12): enforced via owner-scoped services/queries and the route structure.
- Products (FR13–FR17): covered via product service + admin screens.
- Shopping list + pricing + assorted (FR18–FR21, FR47–FR53): covered via shopping list service + admin editors; assorted labeling rules defined.
- Shopper purchase flow (FR22–FR29): covered via shopper route group + cart draft store + purchase service transaction.
- Inventory/Ledger/History (FR30–FR38): covered via purchase/ledger services and admin history screens.
- Backup/restore (FR39–FR43): covered via backup service + admin export/restore screens; atomic restore specified.
- Alerts/reminders (FR44–FR46): mapped to admin dashboard + query helpers.

**Non-Functional Requirements Coverage:**
- Performance: list virtualization guidance + scan-flow isolation; DB indexing conventions support fast lookup.
- Reliability/Data integrity: transaction scripts + confirm-time validation + atomic restore.
- Security/privacy: hashed-only PIN storage/exports; shared-device session clearing; no secret logging.
- Maintainability/compatibility: `schemaVersion` + `exportedAt` specified; restore schema mismatch behavior defined.

### Implementation Readiness Validation ✅

**Decision Completeness:**
- Core decisions for DB, backup/restore, auth boundaries, and service/error contracts are specified.
- Remaining “nice to decide later” items (testing framework details, optional lockouts) are explicitly deferred.

**Structure Completeness:**
- Concrete directories and target files are mapped for every FR group (no generic placeholders only).

**Pattern Completeness:**
- Highest-risk multi-agent conflict points are addressed (naming, file layout, service boundaries, transactions, formats).

### Gap Analysis Results

**Important (track before/during implementation):**
- Dependencies referenced by the architecture are not yet installed in `package.json`:
  - `expo-sqlite`, `expo-file-system`, `expo-sharing`, `expo-crypto`
  - `drizzle-orm`, `scrypt-js`, `zustand`, `@shopify/flash-list`
- Admin “forgot password” / recovery behavior is not decided (PRD notes this as an open decision).

### Architecture Completeness Checklist

**✅ Requirements Analysis**
- [x] Project context analyzed
- [x] Constraints identified (offline-first, shared device, no backend)
- [x] Cross-cutting concerns mapped (isolation, integrity, security, backup/restore)

**✅ Architectural Decisions**
- [x] Data architecture defined
- [x] Auth/security boundaries defined
- [x] In-app service/API patterns defined
- [x] Frontend patterns defined
- [x] Infra/deployment stance defined (no backend MVP)

**✅ Implementation Patterns**
- [x] Naming conventions established
- [x] Structure patterns defined
- [x] Error/result contract specified
- [x] Money/time formats standardized

**✅ Project Structure**
- [x] Complete project tree defined
- [x] Boundaries established (UI/service/DB/state)
- [x] Requirements mapped to structure

### Architecture Readiness Assessment

**Overall Status:** READY FOR IMPLEMENTATION

**Confidence Level:** High

**Key Strengths:**
- Offline-first with explicit atomicity model for critical workflows (purchase, payment, restore)
- Strong multi-owner isolation strategy (scoping rules + structure)
- Clear agent-proof conventions (naming, formats, boundaries, error codes)

**Areas for Future Enhancement:**
- PIN retry lockouts and admin recovery flows
- Formal test strategy (unit/e2e) once core domain services are implemented
- Cloud sync architecture (post-MVP) without breaking offline-first guarantees

### Implementation Handoff

**AI Agent Guidelines:**
- Follow all architectural decisions and patterns exactly as documented.
- Place DB schema/migrations only under `src/db/**`.
- Place all DB writes behind domain services under `src/domain/services/**`.
- Use `*_minor` for money and `*_at_ms` for persisted timestamps.
- Use stable `Result<T, AppError>` with enumerated error codes.

**First Implementation Priority:**
- Implement the DB schema + migrations bootstrap + core domain services for:
  - owner scoping
  - product + shopping list
  - purchase confirm transaction (with pricing + assorted pooling)
  - backup export/restore (atomic replace-all)
