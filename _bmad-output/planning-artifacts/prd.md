---
stepsCompleted:
  - step-01-init
  - step-01b-continue
  - step-02-discovery
  - step-02b-vision
  - step-02c-executive-summary
  - step-03-success
  - step-04-journeys
  - step-05-domain
  - step-07-project-type
  - step-08-scoping
  - step-09-functional
  - step-10-nonfunctional
  - step-11-polish
  - step-12-complete
  - step-e-01-discovery
  - step-e-02-review
  - step-e-03-edit
inputDocuments: []
documentCounts:
  productBrief: 0
  research: 0
  brainstorming: 0
  projectDocs: 0
classification:
  projectType: mobile_app
  domain: general
  complexity: medium
  projectContext: greenfield
vision:
  vision: "Offline-first, PIN-gated credit shopping app for small-office groceries."
  differentiator: "Owner-curated sale list + scan-only shopper flow; no public signup; PIN required to unlock scanner; auto logout after purchase."
  coreInsight: "Speed and accountability: constrain the flow to reduce mistakes and accelerate checkout for daily credit transactions."
workflowType: 'prd'
workflow: 'edit'
lastEdited: '2026-03-02T07:28:41+08:00'
editHistory:
  - date: '2026-03-02T07:28:41+08:00'
    changes: 'Add assorted shopping-list items (shared price + shared availability) and bundle pricing rules (unit + bundle offer; computed cart total used for ledger/history).'
---

# Product Requirements Document - LilStore

**Author:** myjmyj
**Date:** 2026-03-01 12:58 PST

## Executive Summary

LilStore is an offline-first iOS/Android shopping app designed for small-office grocery selling on credit. Store owners curate a product catalog and explicitly publish a “shopping list” (the only items shoppers can buy/see). Shoppers do not browse a catalog or remain logged in; they must enter a 4+ digit PIN to unlock a barcode-scanning purchase session, then the app auto-logs out immediately after purchase confirmation to prevent unauthorized purchases under someone else’s name.

The MVP optimizes for repeated daily transactions: faster checkout, fewer mistakes, and minimal admin overhead. The app includes full local database backup and restore using a JSON export; restore replaces all local data and restores the entire database (including purchase history).

### What Makes This Special

- Purpose-built for “credit shopping” in small offices: accountability and speed matter more than general POS feature breadth.
- Strict flow constraints reduce errors: owner-curated for-sale list, scan-only shopping, PIN-gated session entry, and forced logout on completion.
- No public signup/registration UI: admin-only creation of owners and shoppers, starting from a default master admin user.

## Constraints & Assumptions

- Platform: Expo cross-platform iOS + Android, phones only; must run well on low-end devices.
- Offline-first MVP: all core flows work with zero network connectivity.
- Multi-owner on one device: each owner’s data is isolated (products, shopping list, shoppers, ledger, history, settings).
- Product model: product = {name, barcode}. Published shopping list defines purchasability, pricing rules, and available quantity.
- Shopping list pricing: unit price per piece with optional bundle offer `{bundleQty, bundlePrice}`; bundles apply first, remainder uses unit price.
- Assorted shopping list item (optional): a single shopping-list entry representing multiple barcodes/products that share the same pricing rules and a shared available quantity pool; member scans contribute to one shared assorted quantity for availability and pricing.
- Shopper access: PIN-only entry; PIN must be unique across all shoppers on the device; PIN stored/exported hashed only.
- Shopper session: scanner locked until valid PIN; auto logout immediately after purchase confirm.
- Backup/restore: JSON export/import of entire local database; restore is replace-all and must be atomic (no partial state).
- Notifications: no push in MVP; alerts/reminders are in-app dashboard only.
- Out of scope for MVP: payments, external POS integrations, cloud sync, biometrics.

## Project Classification

- Project type: Mobile app (iOS/Android)
- Domain: General / small retail credit shopping
- Complexity: Medium (multi-role access, PIN security boundaries, offline-first data lifecycle with backup/restore)
- Context: Greenfield

## Success Criteria

### User Success

**Store owner (admin)**
- Can create/update/archive products (200+ products) with name and barcode.
- Can publish and maintain a weekly “shopping list” (for-sale availability) with ad-hoc adjustments at any time.
- Can create/manage shoppers (name + 4+ digit PIN) and additional store owners; each owner’s data is isolated to that owner.
- Can export a daily backup and restore the entire database from JSON inside the admin panel.

**Shopper**
- Cannot access scanner or shopping without entering a valid PIN.
- Can complete a 5-item purchase end-to-end (PIN entry -> scan -> quantity -> confirm) in ~30 seconds when familiar, with a cart preview to reduce wrong-item mistakes.
- Cannot purchase quantities exceeding available quantity for an item as defined by the owner’s for-sale availability.
- Is automatically logged out immediately after confirming a purchase (no lingering identity on shared devices).

### Business Success

- Reduces “wrong person” purchases via PIN gating + auto logout (target: near-zero wrong-person incidents).
- Supports daily credit transactions with accountability:
  - Per-shopper running balance/ledger is maintained.
  - Purchase history includes timestamps and is easily reviewable by the owner.

### Technical Success

- Offline-first operation: all core flows work without network connectivity.
- Performance targets (on mid-range devices):
  - App cold start to home: <= 2s (95th percentile).
  - After PIN unlock, scanner ready: <= 1s (95th percentile).
  - Scan to item recognition (barcode lookup) when item exists: <= 300ms average.
- Data integrity:
  - No purchase can exceed available quantity at confirm time.
  - Every purchase writes an immutable purchase record with timestamp and line items.
  - Ledger updates are consistent with purchases (no double-decrement, no partial writes).
- Security baseline:
  - Shopper PINs are never stored or exported in plaintext (stored and exported as hashes).
  - Restore is “replace all”: wipe local DB then import; validate schema version before import; fail safely without corrupting existing data.

### Measurable Outcomes

- Checkout speed: 5 items in <= 30 seconds (median for trained shoppers).
- Error prevention:
  - Wrong-person purchases: target <= 1 per 1,000 purchases (stretch: 0).
  - Wrong-item purchases: reduced by cart preview/edit (track % of carts edited before confirm as leading indicator).
- Reliability:
  - 0 data-loss incidents from restore attempts (either completes successfully or leaves prior DB intact).
  - Backup export succeeds >= 99% of attempts.

## Product Scope

### MVP - Minimum Viable Product

- Home UI with `Admin` and `Buy Now`.
- Admin authentication:
  - No public registration UI.
  - First deployment includes a default master admin user (configurable default password requirement).
- Multi-owner data isolation:
  - Owner can create additional store owners.
  - Each owner has separate products, shoppers, shopping list, and history.
- Products:
  - CRUD product: name, barcode.
- Shopping list (for sale):
  - Owner can CRUD the “shopping list”/availability (controls what shoppers can buy/see).
- Shoppers:
  - Owner can CRUD shoppers: name + PIN (min 4 digits).
- Shopper purchase flow:
  - Buy Now -> PIN prompt -> barcode scanner.
  - Scan item -> show item + price + available qty -> quantity picker (1–10 + custom).
  - Cart preview screen: edit quantity, remove items, prevent exceeding available quantity.
  - Confirm purchase:
    - Decrement quantities.
    - Write purchase history with timestamp.
    - Update per-shopper ledger/balance.
    - Auto logout back to home.
- Credit ledger + history:
  - Per-shopper running balance.
  - Purchase history list with timestamps (viewable in admin).
- Backup/restore:
  - Export full local database to JSON.
  - Restore full local database from JSON (replace all, includes purchase history); accessible in admin panel.

### Growth Features (Post-MVP)

- Receipt/print/share purchase summary.
- Search/type-ahead product lookup (fallback when barcode missing).
- Bulk product import/export (CSV) and barcode assignment tools.
- Analytics (top items, spend per shopper, weekly totals).
- PIN retry limits / lockouts and optional admin re-approval.
- Multiple devices per store owner via sync/back-end.

### Vision (Future)

- Multi-device and multi-location support with cloud sync.
- Optional shopper self-service browsing (still PIN-gated) and richer product info.
- Integrations with POS/inventory systems, payment support (if ever needed).

## User Journeys

### Journey 1: First-Time Setup (Master Admin)

**Opening scene**
A master admin installs LilStore on a single shared device used in a small office. On first launch, the app detects there are no admin accounts in the local database.

**Rising action**
The app prompts for initial master admin setup (username + password). After creating the master admin, the admin logs into the Admin area and sets up the first "store owner" profile (owner-scoped data container).

The admin begins initial catalog setup:
- Creates products (name + barcode only).
- Creates shoppers (name + unique 4+ digit PIN).
- Builds the published shopping list for the week, assigning price and available quantity per item.

**Climax**
The admin exits Admin mode and validates the shopper flow: Buy Now -> shopper enters PIN -> scanner unlocks -> scanning works only for items in the shopping list -> cart review -> confirm -> auto logout to the home screen.

**Resolution**
The app is ready for daily use. The admin exports a daily JSON backup from the Admin panel to ensure the entire local database can be restored if needed.

**What could go wrong / recovery**
- Admin forgets password: needs defined recovery approach (MVP decision).
- Duplicate shopper PIN: app must block and prompt for a different PIN.
- Barcode conflicts in product creation: app must block duplicates within the same owner.

---

### Journey 2: Weekly Operations (Store Owner / Admin)

**Opening scene**
At the start of the week, the store owner wants to refresh what is for sale and ensure quantities/prices are correct for the office.

**Rising action**
Inside Admin (authenticated session with manual logout), the owner:
- Adds new shoppers and issues PINs.
- Updates the shopping list (weekly refresh + ad-hoc adjustments during the week).
- Adjusts shopping-list quantities and prices as inventory changes.
- Optionally configures special pricing rules for shopping list items (bundle offer + per-piece price) and can publish an "Assorted" shopping list item that groups multiple barcodes under the same shared price and shared availability pool.

The owner monitors credit activity:
- Reviews purchase history with timestamps.
- Checks each shopper's running balance.

**Climax**
A shopper comes to pay down their balance. The owner records a payment transaction in Admin, reducing the shopper's balance, and the payment itself is stored in history for auditability.

**Resolution**
The owner ends the admin session (manual logout), confident that the published shopping list matches what's available for sale and that the credit ledger is up to date.

**What could go wrong / recovery**
- Owner tries to remove a product that is still referenced by the shopping list: app must enforce dependency rules.
- Owner records a payment incorrectly: app should support void/reversal or adjustment with history (MVP decision; at minimum an adjustment record).

---

### Journey 3: Fast Credit Purchase (Shopper Happy Path)

**Opening scene**
A shopper walks up to the shared device in a rush and sees the home screen with two clear actions: Admin and Buy Now.

**Rising action**
The shopper taps Buy Now and enters their PIN (PIN-only, no username selection). The app identifies the shopper by PIN, unlocks the scanner, and starts the purchase session.

The shopper scans an item. The app immediately shows:
- Product name (from owner's product). If the scanned barcode belongs to an assorted shopping list item, the display name is "{ProductName} (assorted)" and pricing/availability come from the shared assorted entry.
- Price, special pricing rules (if any), and available quantity (from the shopping list / assorted entry),
- Quantity selector (1-10 keypad + custom input).

The shopper repeats for several items, then opens the cart preview to confirm items, quantities, computed line totals, and the computed cart total.
If multiple scanned items belong to the same assorted entry, their quantities contribute to the same shared availability pool and the same pricing-rule computation for totals.

**Climax**
The shopper confirms purchase. The app validates stock constraints (cannot exceed shopping-list available quantity), computes totals using bundle rules (bundles first, remainder per piece), writes a purchase record with timestamp and line items, updates inventory quantities, updates the shopper's running balance by the computed total, and shows a confirmation.

**Resolution**
The app automatically logs out and returns to the home screen so the next user cannot buy under the previous shopper identity.

**What could go wrong / recovery**
- Shopper changes mind: cart preview must allow removing items and editing quantities before confirm.
- Shopper enters the wrong PIN: app must show clear error and allow retry (rate limiting is a post-MVP hardening item unless you want it in MVP).

---

### Journey 4: "Not Available" + Quantity Guardrails (Shopper Edge Cases)

**Opening scene**
A shopper enters a valid PIN and begins scanning, but the item is not part of the currently published shopping list.

**Rising action**
The shopper scans a barcode that either:
- does not exist in the owner's product catalog, or
- exists as a product but is not currently in the published shopping list.

**Climax**
The app displays an eye-catching "Product not available" state and does not allow adding the item to cart. The shopper continues scanning other items.

In another case, the shopper tries to set quantity above the available quantity. The app blocks confirmation of that quantity and forces the shopper to reduce quantity to the allowed maximum.

**Resolution**
The shopper successfully completes a purchase only with allowed items and quantities, and the app auto logs out.

**What could go wrong / recovery**
- Shopper repeatedly scans unavailable items: app should remain responsive and keep the session intact.
- Shopping list item reaches 0 quantity mid-session: app must re-check at confirm time and block if insufficient.

---

### Journey 5: Device Recovery (Admin Backup/Restore)

**Opening scene**
The device is replaced or the app data is lost. The owner needs to restore everything (products, shopping list, shoppers/PINs, purchase history, ledger, payment history).

**Rising action**
The owner logs into Admin. In Data Management, they select Restore from JSON backup.

The app previews backup metadata (export timestamp, record counts) and warns: "Restoring will replace ALL data on this device."

**Climax**
On confirm, the app wipes local data and imports the JSON backup. It validates schema version and referential integrity. PINs are restored as hashes (never plaintext).

**Resolution**
The app returns to normal operation with the same owners, shoppers, shopping list, purchase history, and balances as before.

**What could go wrong / recovery**
- Invalid or corrupted JSON: restore must fail safely without partially overwriting the existing DB.
- Schema mismatch: app must block restore with a clear message.

### Journey Requirements Summary

Journeys above imply required capabilities for MVP:
- Admin lifecycle: first-run master admin creation only when zero admins exist; no public registration otherwise
- Admin auth: username/password session with manual logout
- Owner partitioning: per-owner isolation for products, shopping list, shoppers, history, ledger
- Product model: product = {name, barcode}; barcode uniqueness enforced per owner
- Shopping list model: shopping list item = {type: single|assorted, productRefs/barcodes, pricing: {unitPrice, bundleOffer?}, availableQty(shared), published/active}
- Shopper model: shopper = {name, unique PIN (hashed), balance, history}
- Shopper access: PIN-only unlock to scanner; identify shopper by PIN; auto logout after purchase
- Scanning: barcode scanner + immediate lookup; strong "not available" UX if not in published shopping list
- Cart: preview/edit/remove; quantity keypad (1-10 + custom); shows computed line totals + computed cart total
- Validation: cannot add/confirm quantity above availableQty; enforce at confirm time
- Transactions: immutable purchase records with timestamps + line items; computed totals use bundle rules; assorted member lines are recorded as "{ProductName} (assorted)" for audit clarity; updates ledger and quantities
- Payments: admin can record repayments with timestamped history; updates balances
- Backup/restore: export entire local database to JSON; restore-all replace-all with validation and safe failure

## Domain-Specific Requirements

### Compliance & Regulatory

- No explicit regulated-domain compliance assumed (e.g., HIPAA/PCI) for MVP.
- Data handling must still follow basic privacy expectations for stored names and credit balances (local-only on device; backup/restore under admin control).

### Technical Constraints

- Shared-device safety: shopper identity must not persist outside an active shopping session (PIN unlock required; auto logout after confirm).
- Offline-first: all CRUD, shopping, ledger, and history must function without network connectivity.
- Backup/restore replace-all:
  - Restore must wipe local data and import the full JSON database atomically (no partial/half state).
  - Restore must validate `schemaVersion` and referential integrity.
- PIN security:
  - Shopper PINs must never be stored or exported in plaintext (hash only).
  - PIN uniqueness must be enforced across all shoppers on the device (required for PIN-only lookup).

### Integration Requirements

- None for MVP (no external POS, no payments, no cloud sync in MVP).

### Risk Mitigations

- Wrong-person purchases: enforced by PIN gating + forced auto logout + no catalog browsing outside session.
- Data loss: daily export + safe restore that either succeeds completely or leaves existing DB intact.
- Inventory integrity: prevent cart quantities exceeding shopping-list availability; re-check at confirm time.
- Ledger correctness: every purchase/payment must write an immutable record with timestamp; balance is derived from transaction history (or at minimum always consistent with it).

## Mobile App Specific Requirements

### Project-Type Overview

LilStore is a cross-platform mobile app built with Expo (single codebase) targeting iOS and Android phones, including low-end devices. The product is offline-first and must fully function without network connectivity. Future cloud sync may be added post-MVP.

### Technical Architecture Considerations

- Local-first persistence is the source of truth in MVP (no backend dependency).
- Data model is owner-scoped (each owner has an isolated dataset on the same device).
- Purchase + payment records must be written atomically to avoid partial state (history/ledger/quantities remain consistent).

### Platform Requirements

- Platforms: iOS + Android.
- Form factor: phones only (no tablet-specific UI requirements in MVP).
- Performance: must remain responsive on low-end devices (optimize list rendering and scanning flow).
- Offline: all core flows work offline; network availability must not block normal operation.

### Device Permissions

- Camera permission required for barcode scanning.
- File access / share support required to export and import JSON backups.
- No photo/media-library permission required.
- Biometrics: explicitly out of scope for MVP (future enhancement only).

### Offline Mode

- All admin and shopper operations must work without internet:
  - Product CRUD (name + barcode)
  - Shopping list management (price + available quantity)
  - Shopper management (PIN creation/validation)
  - Purchases (scan, cart, confirm, decrement quantities, write history)
  - Ledger and payments (balance updates + transaction history)
  - Backup export and restore-all replace-all
- Future cloud sync (post-MVP):
  - Must be additive and must not break offline-first guarantees.

### Alerts & Reminders (In-App Dashboard)

- No push notifications in MVP.
- Admin dashboard must surface local “alerts/reminders” such as:
  - Low/zero stock items on the published shopping list
  - Shoppers with high balance or overdue reminders (rules TBD)
  - Backup freshness (e.g., “last backup was X days ago”)

### Implementation Considerations

- Scanning UX must minimize steps: PIN unlock -> scanner ready quickly -> immediate “available/not available” feedback.
- Backups must be portable across devices and versions:
  - JSON export includes `schemaVersion` and timestamp.
  - Restore validates schema and imports safely (wipe-then-import, fail safely).

## Project Scoping & Phased Development

### MVP Strategy & Philosophy

**MVP Approach:** Experience + Operations MVP  
Ship a complete, reliable offline-first loop for credit shopping on a shared device: owner publishes what’s for sale; shopper PIN unlocks scanning; cart review; confirm purchase; quantities + ledger + history update; auto logout; daily backup/restore.

**Resource Requirements:** 1 mobile dev (Expo/React Native) + 1 QA-minded tester (part-time)  
Optional support: UI/UX polish pass for home + scanner + cart + admin dashboard.

### MVP Feature Set (Phase 1)

**Core User Journeys Supported:**
- First-time setup (master admin) and owner provisioning
- Weekly owner operations (shopping list refresh + ad-hoc adjustments)
- Shopper fast purchase (PIN -> scan -> quantity -> cart -> confirm -> auto logout)
- Shopper edge cases (not available, quantity guardrails, cart edits)
- Device recovery (export backup + restore-all replace-all)

**Must-Have Capabilities:**
- Admin auth:
  - First-run master admin creation only when no admins exist
  - Admin username/password login, manual logout
  - No public registration UI once an admin exists
- Owner partitioning:
  - Multiple owners on one device; strict per-owner isolation of all data
- Product setup:
  - Product = name + barcode (owner-scoped uniqueness)
- Published shopping list:
  - Shopping list item = product/barcode (or assorted group) + pricing (unit + optional bundle) + shared available quantity
  - Only shopping-list items are purchasable/visible to shoppers
- Shopper management:
  - Shopper = name + unique PIN (hashed), owner-scoped
- Shopper purchase flow:
  - Buy Now requires PIN-only (no name selection)
  - Scanner unlocks only after valid PIN
  - “Not available” state if scanned barcode not in shopping list (even if in product list)
  - Quantity keypad (1–10 + custom) with hard cap at available quantity
  - Cart preview with edit/remove before confirm
  - Confirm purchase writes immutable purchase record w/ timestamp + line items
  - Confirm purchase decrements shopping list quantities and updates shopper balance
  - Auto logout immediately after confirm back to home
- Credit ledger + payments:
  - Per-shopper running balance
  - Admin can record payments (repayments) with timestamped history
  - Purchase history + payment history visible in admin
- Backup/restore:
  - Export entire local database to JSON (daily expected)
  - Restore entire local database from JSON (replace all)
  - Restore validates schema and fails safely without partial overwrite
- In-app alerts/reminders dashboard (no push):
  - Low/zero stock on shopping list
  - Backup freshness reminders
  - (Optional in MVP if time allows) high-balance shoppers / overdue reminders

### Post-MVP Features

**Phase 2 (Post-MVP):**
- PIN retry limits / temporary lockouts
- Payment corrections (void/reversal) with immutable audit trail
- Bulk import/export (CSV) for products and shopping list
- Enhanced reporting/analytics (weekly totals, spend per shopper, top items)
- Faster admin tooling (search, filters, barcode helper)
- Optional biometrics for admin unlock (device-supported)

**Phase 3 (Expansion):**
- Cloud sync / multi-device per owner (while preserving offline-first behavior)
- Multi-location support per owner
- Optional richer shopper experience (browse within session, product photos)
- Integrations with external inventory/POS (if ever needed)
- Push notifications (if later desired)

### Risk Mitigation Strategy

**Technical Risks:**
- Data corruption from partial writes (purchase/payment/restore):
  - Mitigation: atomic transactions, idempotent writes, restore validation + wipe-then-import.
- Owner partition leakage:
  - Mitigation: explicit ownerId scoping in every query and export/import; tests around cross-owner access.
- Performance on low-end phones:
  - Mitigation: minimize renders, optimize lists, keep scanner flow lightweight.

**Market Risks:**
- Flow is too restrictive for real usage:
  - Mitigation: ship the constrained flow first; validate checkout time + error reduction; iterate via admin UX improvements.

**Resource Risks:**
- Scope creep around analytics/sync/lockouts:
  - Mitigation: enforce Phase 1 boundaries; treat sync and push as Phase 3.

## User Stories (MVP)

### Master Admin / Store Owner

- US1: As a master admin, I can create the initial admin account only when no admin exists, so first-run setup is controlled.
- US2: As an admin, I can log in and log out manually, so I can secure admin access on a shared device.
- US3: As an admin, I can create multiple store owners and switch context, so one device can serve multiple owners.
- US4: As an admin, I can create/update/archive products with name + barcode, so I can maintain a catalog.
- US5: As an admin, I can publish a shopping list with price + available quantity, so shoppers only see what’s for sale.
- US6: As an admin, I can add/update/remove shopping list items any time, so I can adjust availability during the week.
- US7: As an admin, I can create shoppers with unique PINs, so only enrolled shoppers can buy on credit.
- US8: As an admin, I can view purchase history and payment history with timestamps, so I can audit credit activity.
- US9: As an admin, I can record shopper payments, so balances stay accurate.
- US10: As an admin, I can export a full JSON backup daily, so I can recover from device loss.
- US11: As an admin, I can restore from a JSON backup (replace all), so the entire database can be recovered.
- US17: As an admin, I can publish an optional "Assorted" shopping list item (displayed as a single "Assorted" entry) that groups multiple barcodes/products under a shared price and shared available-quantity pool, so similar items with the same price are managed as one entry.
- US18: As an admin, I can configure a per-piece unit price and an optional bundle offer `{bundleQty, bundlePrice}` on a shopping list item, so bundle discounts apply automatically when criteria are met.

### Shopper

- US12: As a shopper, I can unlock shopping by entering my PIN, so only I can buy under my name.
- US13: As a shopper, I can scan a barcode to add an item with quantity to my cart, so checkout is fast.
- US14: As a shopper, I can see “Product not available” when scanned items aren’t in the shopping list, so I don’t buy unavailable items.
- US15: As a shopper, I can review/edit my cart before confirming, so I can correct wrong items/quantities.
- US16: As a shopper, I am logged out automatically after confirming purchase, so the next user can’t shop as me.
- US19: As a shopper, I can see computed line totals and computed cart total (including bundle pricing) before confirming, so I know what I owe.

## Acceptance Criteria (MVP)

- AC1 First Run: Given no admin exists, when the app opens, then it prompts to create the initial master admin; after creation, the prompt never appears again unless the DB is wiped.
- AC2 No Public Signup: Given an admin exists, when the app opens, then it never shows any registration UI outside an authenticated admin session.
- AC3 Admin Session: Given valid admin credentials, when admin logs in, then admin features are accessible until manual logout.
- AC4 Owner Isolation: Given two owners exist, when owner A is active, then owner B’s products/shoppers/shopping list/history are not visible and cannot be used.
- AC5 PIN Unlock: Given a valid shopper PIN, when the shopper enters the PIN, then the system identifies the shopper and unlocks the scanner; given an invalid PIN, scanner remains locked.
- AC6 Not Available: Given a scanned barcode not present on the active owner’s published shopping list, when scanned, then the system shows an unmissable “Product not available” state and prevents cart add.
- AC7 Quantity Guardrail: Given an item has available quantity N, when shopper selects quantity > N, then the system prevents adding/confirming that quantity.
- AC8 Cart Edit: Given items are in the cart, when shopper opens cart preview, then shopper can remove items and adjust quantities within availability.
- AC9 Confirm Purchase Effects: Given a valid cart, when shopper confirms purchase, then (a) purchase history entry with timestamp is created, (b) shopping list quantities decrement, (c) shopper balance increases by computed total (including bundle pricing rules), and (d) shopper is auto-logged out to home.
- AC13 Bundle Pricing: Given an item has unitPrice ₱2 and bundleOffer `{bundleQty: 3, bundlePrice: ₱5}`, when the shopper sets quantity Q, then line total = `floor(Q/3) * ₱5 + (Q mod 3) * ₱2` (examples: Q=1→₱2, Q=2→₱4, Q=3→₱5, Q=4→₱7).
- AC14 Assorted Group: Given barcodes B1, B2, B3 are members of a single assorted shopping list item displayed as "Assorted" in the shopping list and with shared `availableQty = N` and shared pricing rules, when the shopper scans any member barcode, then the app treats it as purchasable via the assorted entry, enforces that the summed quantity across assorted members <= N, and decrements the shared availableQty pool by the summed quantity on confirm.
- AC15 Assorted Labeling: Given a scanned barcode belongs to an assorted group, when displayed in cart and stored in purchase history, then the line item label includes the underlying product name with suffix "(assorted)" (e.g., "Item 1 (assorted)").
- AC10 Record Payment: Given a shopper has balance > 0, when admin records a payment with amount X, then the payment is recorded with timestamp and the shopper balance decreases by X.
- AC11 Backup Export: Given any amount of data (owners/products/shoppers/shopping list/history/ledger), when admin exports backup, then the JSON contains the entire database.
- AC12 Restore Replace-All: Given existing local data, when admin restores from a valid backup, then all local data is replaced by backup contents; given an invalid/incompatible backup, then restore fails safely and existing data remains intact.

## Functional Requirements

### Access, Roles, and Sessions

- FR1: System can determine whether any admin account exists on first launch.
- FR2: If no admin account exists, System can allow creation of an initial master admin (username + password).
- FR3: If one or more admin accounts exist, System can prevent any “public registration” or account creation outside an authenticated admin session.
- FR4: Admin can authenticate using username and password.
- FR5: Admin can manually log out of the admin session.
- FR6: Shopper can start a purchase session only by providing a valid shopper PIN.
- FR7: System can automatically end (log out) the shopper purchase session immediately after purchase confirmation.

### Multi-Owner (Tenant) Management

- FR8: Admin can create one or more store owner profiles on the same device.
- FR9: Admin can switch the active store owner context.
- FR10: System can isolate each store owner’s data (products, shopping list, shoppers, ledger, history, settings) from other owners on the same device.
- FR11: System can associate each shopper with exactly one store owner.
- FR12: System can enforce shopper PIN uniqueness across all shoppers on the device (so PIN-only lookup is unambiguous).

### Product Catalog Management

- FR13: Admin can create a product with a name and a barcode.
- FR14: Admin can update a product’s name and barcode.
- FR15: Admin can delete or archive a product.
- FR16: System can prevent duplicate product barcodes within the same store owner’s product catalog.
- FR17: System can allow the same barcode to exist in different store owners’ catalogs without cross-impact.

### Published Shopping List (For-Sale Availability)

- FR18: Admin can create shopping list items that reference a product/barcode and define pricing (unit price, optional bundle offer) and available quantity.
- FR19: Admin can update shopping list items (pricing and available quantity) at any time (weekly refresh + ad-hoc adjustments).
- FR20: Admin can remove items from the published shopping list.
- FR21: System can ensure shoppers can only purchase items that are currently present on the published shopping list for that shopper’s store owner.

### Shopper Purchase Flow (Scan, Cart, Confirm)

- FR22: After valid PIN entry, Shopper can access a barcode scanning experience for the associated store owner.
- FR23: When a barcode is scanned, System can identify whether the scanned item is purchasable (present on the published shopping list).
- FR24: If scanned item is not purchasable, System can inform the shopper and prevent adding it to the cart.
- FR25: If scanned item is purchasable, Shopper can select a quantity (including a quick range 1–10 and a custom quantity).
- FR26: System can prevent adding quantities that exceed the item’s available quantity.
- FR27: Shopper can view a cart containing scanned items, quantities, unit prices, computed line totals, and computed cart total before confirming.
- FR28: Shopper can modify the cart before confirming (change quantities, remove items).
- FR29: Shopper can confirm a purchase to finalize the cart as an immutable purchase transaction.

### Inventory, Ledger, and History

- FR30: On purchase confirmation, System can decrement available quantities for the purchased shopping list items.
- FR31: On purchase confirmation, System can create a purchase record containing timestamp, shopper, store owner, and line items.
- FR32: System can maintain a per-shopper running balance owed to the store owner.
- FR33: On purchase confirmation, System can increase the shopper’s balance by the computed purchase total (including bundle pricing rules).
- FR34: Admin can record a payment (repayment) from a shopper with a timestamp.
- FR35: On recording a payment, System can decrease the shopper’s balance accordingly.
- FR36: Admin can view purchase history with timestamps.
- FR37: Admin can view payment history with timestamps.
- FR38: System can preserve purchase history and payment history per store owner (no cross-owner visibility).

### Backup and Restore (Entire Database)

- FR39: Admin can export the entire local database for all store owners to a JSON backup file.
- FR40: Backup export can include purchase history, payment history, and current balances.
- FR41: Admin can restore the entire local database from a JSON backup file.
- FR42: Restore can replace all existing local data with the contents of the backup.
- FR43: System can reject an invalid or incompatible backup file without leaving local data in a partially restored state.

### Admin Dashboard Alerts (No Push)

- FR44: Admin can view a dashboard that surfaces local alerts/reminders.
- FR45: System can surface low/zero stock items from the published shopping list.
- FR46: System can surface backup freshness reminders (e.g., last backup age).

### Pricing Rules, Totals, and Assorted Items

- FR47: Shopping list item pricing supports both unit price per piece and an optional bundle offer `{bundleQty, bundlePrice}`.
- FR48: When a bundle offer exists and quantity meets the bundleQty threshold, System computes line totals by applying bundles first, then charging remaining quantity at unit price.
- FR49: System computes cart total as the sum of computed line totals and displays it in cart preview.
- FR50: Purchase records store computed totals (line totals and cart total) and the pricing inputs used (unit price and bundle offer) for auditability.
- FR51: Admin can create an assorted shopping list item displayed as a single "Assorted" entry that groups multiple barcodes/products under one shared pricing rule set and a single shared available quantity pool.
- FR52: When a shopper scans a barcode that belongs to an assorted shopping list item, System treats it as purchasable via the assorted entry and enforces/decrements the shared available quantity pool using the summed quantity across assorted members.
- FR53: For assorted-member scans, cart display and purchase history label each line item as "{ProductName} (assorted)" while still applying the shared assorted pricing rules.

## Non-Functional Requirements

### Performance (Low-End Phones)

- NFR-P1: App cold start to home screen completes within 2 seconds at the 95th percentile on low-end target devices.
- NFR-P2: After valid shopper PIN entry, scanner view is ready to scan within 1 second at the 95th percentile.
- NFR-P3: Scanning an in-list barcode results in an “available” add-to-cart screen within 300ms average (excluding camera focus time).
- NFR-P4: Admin lists (products, shopping list, shoppers, history) remain responsive for 200+ products and daily transaction growth (no visible jank during normal scrolling).

### Reliability & Data Integrity

- NFR-R1: All critical write operations (purchase confirmation, payment recording, restore) are atomic: either fully applied or not applied.
- NFR-R2: Restore from JSON never leaves the local database in a partially restored state.
- NFR-R3: Purchase confirmation validates available quantities at confirm time and rejects confirmations that would exceed availability.
- NFR-R4: Purchase records and payment records are immutable once created (corrections are recorded as new adjustment/void records if supported).

### Security & Privacy (Shared Device + Credit Data)

- NFR-S1: Shopper PINs are stored only as salted hashes and are never exported or stored in plaintext.
- NFR-S2: Shopper purchase session ends automatically immediately after purchase confirmation; shopper identity is not displayed or accessible from the home screen without a new PIN entry.
- NFR-S3: Backup files contain only the minimum necessary personal data (names, balances, histories) and are only accessible via admin UI flows.
- NFR-S4: Owner data isolation is enforced consistently across all views and exports/imports (no cross-owner leakage).

### Usability

- NFR-U1: “Not available” state is unmissable and blocks cart addition when scanned item is not in the published shopping list.
- NFR-U2: Cart preview always allows correction before confirm (remove item, adjust quantity within availability).
- NFR-U3: Admin workflows (create shopper, create product, add to shopping list, record payment, export backup, restore backup) can be completed without internet connectivity.

### Maintainability / Compatibility

- NFR-M1: Backup JSON includes `schemaVersion` and `exportedAt` to support forward migration and restore validation.
- NFR-M2: Restore rejects unsupported schema versions with a clear error message and without modifying existing data.
