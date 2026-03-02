---
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - /Users/kenlovestocode/Desktop/Me/ai/LilStore/_bmad-output/planning-artifacts/prd.md
  - /Users/kenlovestocode/Desktop/Me/ai/LilStore/_bmad-output/planning-artifacts/architecture.md
  - /Users/kenlovestocode/Desktop/Me/ai/LilStore/_bmad-output/planning-artifacts/ux-design-specification.md
  - /Users/kenlovestocode/Desktop/Me/ai/LilStore/_bmad-output/planning-artifacts/ux-design-directions.html
  - /Users/kenlovestocode/Desktop/Me/ai/LilStore/_bmad-output/planning-artifacts/prd.validation-report.md
  - /Users/kenlovestocode/Desktop/Me/ai/LilStore/_bmad-output/planning-artifacts/validation-report-2026-03-02-101940.md
---

# LilStore - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for LilStore, decomposing the requirements from the PRD, UX Design if it exists, and Architecture requirements into implementable stories.

## Requirements Inventory

### Functional Requirements

FR1: System can determine whether any admin account exists on first launch.
FR2: If no admin account exists, System can allow creation of an initial master admin (username + password).
FR3: If one or more admin accounts exist, System can prevent any “public registration” or account creation outside an authenticated admin session.
FR4: Admin can authenticate using username and password.
FR5: Admin can manually log out of the admin session.
FR6: Shopper can start a purchase session only by providing a valid shopper PIN.
FR7: System can automatically end (log out) the shopper purchase session immediately after purchase confirmation.
FR8: Admin can create one or more store owner profiles on the same device.
FR9: Admin can switch the active store owner context.
FR10: System can isolate each store owner’s data (products, shopping list, shoppers, ledger, history, settings) from other owners on the same device.
FR11: System can associate each shopper with exactly one store owner.
FR12: System can enforce shopper PIN uniqueness across all shoppers on the device (so PIN-only lookup is unambiguous).
FR13: Admin can create a product with a name and a barcode.
FR14: Admin can update a product’s name and barcode.
FR15: Admin can delete or archive a product.
FR16: System can prevent duplicate product barcodes within the same store owner’s product catalog.
FR17: System can allow the same barcode to exist in different store owners’ catalogs without cross-impact.
FR18: Admin can create shopping list items that reference a product/barcode and define pricing (unit price, optional bundle offer) and available quantity.
FR19: Admin can update shopping list items (pricing and available quantity) at any time (weekly refresh + ad-hoc adjustments).
FR20: Admin can remove items from the published shopping list.
FR21: System can ensure shoppers can only purchase items that are currently present on the published shopping list for that shopper’s store owner.
FR22: After valid PIN entry, Shopper can access a barcode scanning experience for the associated store owner.
FR23: When a barcode is scanned, System can identify whether the scanned item is purchasable (present on the published shopping list).
FR24: If scanned item is not purchasable, System can inform the shopper and prevent adding it to the cart.
FR25: If scanned item is purchasable, Shopper can select a quantity (including a quick range 1–10 and a custom quantity).
FR26: System can prevent adding quantities that exceed the item’s available quantity.
FR27: Shopper can view a cart containing scanned items, quantities, unit prices, computed line totals, and computed cart total before confirming.
FR28: Shopper can modify the cart before confirming (change quantities, remove items).
FR29: Shopper can confirm a purchase to finalize the cart as an immutable purchase transaction.
FR30: On purchase confirmation, System can decrement available quantities for the purchased shopping list items.
FR31: On purchase confirmation, System can create a purchase record containing timestamp, shopper, store owner, and line items.
FR32: System can maintain a per-shopper running balance owed to the store owner.
FR33: On purchase confirmation, System can increase the shopper’s balance by the computed purchase total (including bundle pricing rules).
FR34: Admin can record a payment (repayment) from a shopper with a timestamp.
FR35: On recording a payment, System can decrease the shopper’s balance accordingly.
FR36: Admin can view purchase history with timestamps.
FR37: Admin can view payment history with timestamps.
FR38: System can preserve purchase history and payment history per store owner (no cross-owner visibility).
FR39: Admin can export the entire local database for all store owners to a JSON backup file.
FR40: Backup export can include purchase history, payment history, and current balances.
FR41: Admin can restore the entire local database from a JSON backup file.
FR42: Restore can replace all existing local data with the contents of the backup.
FR43: System can reject an invalid or incompatible backup file without leaving local data in a partially restored state.
FR44: Admin can view a dashboard that surfaces local alerts/reminders.
FR45: System can surface low/zero stock items from the published shopping list.
FR46: System can surface backup freshness reminders (e.g., last backup age).
FR47: Shopping list item pricing supports both unit price per piece and an optional bundle offer `{bundleQty, bundlePrice}`.
FR48: When a bundle offer exists and quantity meets the bundleQty threshold, System computes line totals by applying bundles first, then charging remaining quantity at unit price.
FR49: System computes cart total as the sum of computed line totals and displays it in cart preview.
FR50: Purchase records store computed totals (line totals and cart total) and the pricing inputs used (unit price and bundle offer) for auditability.
FR51: Admin can create an assorted shopping list item displayed as a single "Assorted" entry that groups multiple barcodes/products under one shared pricing rule set and a single shared available quantity pool.
FR52: When a shopper scans a barcode that belongs to an assorted shopping list item, System treats it as purchasable via the assorted entry and enforces/decrements the shared available quantity pool using the summed quantity across assorted members.
FR53: For assorted-member scans, cart display and purchase history label each line item as "{ProductName} (assorted)" while still applying the shared assorted pricing rules.

### NonFunctional Requirements

NFR1 (NFR-P1): App cold start to home screen completes within 2 seconds at the 95th percentile on low-end target devices.
NFR2 (NFR-P2): After valid shopper PIN entry, scanner view is ready to scan within 1 second at the 95th percentile.
NFR3 (NFR-P3): Scanning an in-list barcode results in an “available” add-to-cart screen within 300ms average (excluding camera focus time).
NFR4 (NFR-P4): Admin lists (products, shopping list, shoppers, history) remain responsive for 200+ products and daily transaction growth (no visible jank during normal scrolling).
NFR5 (NFR-R1): All critical write operations (purchase confirmation, payment recording, restore) are atomic: either fully applied or not applied.
NFR6 (NFR-R2): Restore from JSON never leaves the local database in a partially restored state.
NFR7 (NFR-R3): Purchase confirmation validates available quantities at confirm time and rejects confirmations that would exceed availability.
NFR8 (NFR-R4): Purchase records and payment records are immutable once created (corrections are recorded as new adjustment/void records if supported).
NFR9 (NFR-S1): Shopper PINs are stored only as salted hashes and are never exported or stored in plaintext.
NFR10 (NFR-S2): Shopper purchase session ends automatically immediately after purchase confirmation; shopper identity is not displayed or accessible from the home screen without a new PIN entry.
NFR11 (NFR-S3): Backup files contain only the minimum necessary personal data (names, balances, histories) and are only accessible via admin UI flows.
NFR12 (NFR-S4): Owner data isolation is enforced consistently across all views and exports/imports (no cross-owner leakage).
NFR13 (NFR-U1): “Not available” state is unmissable and blocks cart addition when scanned item is not in the published shopping list.
NFR14 (NFR-U2): Cart preview always allows correction before confirm (remove item, adjust quantity within availability).
NFR15 (NFR-U3): Admin workflows (create shopper, create product, add to shopping list, record payment, export backup, restore backup) can be completed without internet connectivity.
NFR16 (NFR-M1): Backup JSON includes `schemaVersion` and `exportedAt` to support forward migration and restore validation.
NFR17 (NFR-M2): Restore rejects unsupported schema versions with a clear error message and without modifying existing data.

### Additional Requirements

- Selected starter scaffold is the existing Expo SDK 55 + Expo Router + TypeScript repo; no re-initialization is required.
- MVP is offline-first with no network API/backend dependency.
- Use SQLite via `expo-sqlite` with Drizzle ORM; implement purchase confirm / payment record / restore as explicit DB transactions with confirm-time revalidation.
- Persist money as integer minor units and store both pricing inputs and computed totals for auditability.
- Backup/export uses `expo-file-system` + `expo-sharing`; backup JSON includes `schemaVersion` and `exportedAt`.
- Restore validates schema/file structure before changes and applies a replace-all restore atomically (rollback on any error).
- Shopper PINs are stored/queried via KDF output only (no plaintext); enforce device-wide PIN uniqueness with a UNIQUE constraint on derived PIN hash.
- Admin passwords stored as KDF output; never store/export plaintext credentials; do not log secrets.
- Use `expo-crypto` (or equivalent) for cryptographically secure random salts.
- Owner scoping must be enforced across every query, write, export, and import (no cross-owner leakage).
- UX: short, consistent transitions for PIN → Scan → Cart → Recorded; support reduced-motion mode.
- UX: clear loading + disabled “commit” buttons to prevent double submit; preserve cart on transient errors.
- UX: accessibility guardrails (large tap targets, minimum contrast) and unmistakable disabled/error states; portrait-first phones.

### FR Coverage Map

FR1: Epic 1 - Determine whether admin exists (first-run gating)
FR2: Epic 1 - Create initial master admin (username + password)
FR3: Epic 1 - Block public registration when admin exists
FR4: Epic 1 - Admin authenticate (username + password)
FR5: Epic 1 - Admin logout
FR6: Epic 5 - Shopper session starts via valid PIN
FR7: Epic 5 - Auto-end shopper session after purchase confirmation
FR8: Epic 2 - Create store owner profiles
FR9: Epic 2 - Switch active owner context
FR10: Epic 2 - Enforce owner data isolation across all domains
FR11: Epic 2 - Associate shopper to exactly one owner
FR12: Epic 2 - Enforce device-wide PIN uniqueness
FR13: Epic 3 - Create product (name + barcode)
FR14: Epic 3 - Update product (name + barcode)
FR15: Epic 3 - Delete/archive product
FR16: Epic 3 - Prevent duplicate barcodes within an owner
FR17: Epic 3 - Allow same barcode across different owners
FR18: Epic 4 - Create shopping list items with pricing + available quantity
FR19: Epic 4 - Update shopping list item pricing/quantity
FR20: Epic 4 - Remove items from published shopping list
FR21: Epic 4 - Ensure shoppers can buy only published items for their owner
FR22: Epic 5 - After PIN, access scanner experience for owner
FR23: Epic 5 - On scan, identify purchasable vs not (in published list)
FR24: Epic 5 - Not purchasable: inform + prevent cart add
FR25: Epic 5 - Purchasable: quantity selection (1–10 + custom)
FR26: Epic 5 - Prevent adding quantity over available
FR27: Epic 5 - Cart preview with computed totals
FR28: Epic 5 - Cart modifications (qty change/remove)
FR29: Epic 6 - Confirm purchase to finalize immutable transaction
FR30: Epic 6 - On confirm, decrement available quantities
FR31: Epic 6 - On confirm, create purchase record with timestamp + line items
FR32: Epic 6 - Maintain per-shopper running balance
FR33: Epic 6 - On confirm, increase shopper balance by computed total
FR34: Epic 6 - Admin record payment with timestamp
FR35: Epic 6 - Decrease shopper balance on payment record
FR36: Epic 6 - Admin view purchase history with timestamps
FR37: Epic 6 - Admin view payment history with timestamps
FR38: Epic 6 - Preserve history per owner (no cross-owner visibility)
FR39: Epic 7 - Export full local DB (all owners) to JSON backup file
FR40: Epic 7 - Backup includes history and current balances
FR41: Epic 7 - Restore full local DB from JSON
FR42: Epic 7 - Restore replace-all existing local data
FR43: Epic 7 - Reject invalid/incompatible backup safely (no partial restore)
FR44: Epic 7 - Admin dashboard surfaces local alerts/reminders
FR45: Epic 7 - Dashboard surfaces low/zero stock items
FR46: Epic 7 - Dashboard surfaces backup freshness reminders
FR47: Epic 4 - Pricing supports unit price + optional bundle offer
FR48: Epic 6 - Bundle totals: apply bundles-first then unit remainder
FR49: Epic 6 - Cart total as sum of computed line totals
FR50: Epic 6 - Purchase records store computed totals + pricing inputs
FR51: Epic 4 - Admin can create assorted shopping list item (shared rules + pool)
FR52: Epic 6 - Assorted-member scan: purchasable via assorted entry; enforce pooled availability
FR53: Epic 6 - Assorted-member labeling in cart/history with “(assorted)”

## Epic List

### Epic 1: Foundation (Template Cleanup) + Secure Admin Access & Sessions
Deliver a clean, production-lean app shell that supports first-run master admin setup, secure admin login/logout, and blocks any public signup/registration. Includes template cleanup only as needed to implement FR1–FR5 cleanly.
**FRs covered:** FR1, FR2, FR3, FR4, FR5

### Epic 2: Multi-Owner Setup (Store Owners) & Data Isolation
Enable admin to create and switch between store owners on one device and enforce strict data isolation and scoping so each owner’s data never leaks to another owner.
**FRs covered:** FR8, FR9, FR10, FR11, FR12

### Epic 3: Product Catalog Management
Enable admin to manage a per-owner product catalog with barcode rules that prevent duplicates within an owner while allowing the same barcode across different owners.
**FRs covered:** FR13, FR14, FR15, FR16, FR17

### Epic 4: Published Shopping List (For-Sale) Management + Pricing Setup
Enable admin to publish what shoppers can buy with pricing (unit + optional bundle offers) and availability controls, including creation of assorted groups sharing pricing rules and a pooled available quantity.
**FRs covered:** FR18, FR19, FR20, FR21, FR47, FR51

### Epic 5: Shopper “Buy Now” Flow (PIN → Scan → Qty → Cart → Confirm)
Deliver the fast, shared-device shopper experience: PIN unlock, scan items, block “not available” items, select quantities with guardrails, and preview/edit cart before confirming.
**FRs covered:** FR6, FR7, FR22, FR23, FR24, FR25, FR26, FR27, FR28

### Epic 6: Transactions, Inventory, Ledger & History (Correctness First)
Finalize purchases as immutable transactions with correct totals and strict integrity: decrement stock, write purchase history, update balances, support payments, and implement bundle + assorted pooled-availability behavior and labeling.
**FRs covered:** FR29, FR30, FR31, FR32, FR33, FR34, FR35, FR36, FR37, FR38, FR48, FR49, FR50, FR52, FR53

### Epic 7: Backup/Restore + Admin Alerts Dashboard
Enable admin to export/restore the entire local database via JSON with safe atomic replace-all restore, and provide local alerts for low/zero stock items and backup freshness.
**FRs covered:** FR39, FR40, FR41, FR42, FR43, FR44, FR45, FR46

## Epic 1: Foundation (Template Cleanup) + Secure Admin Access & Sessions

Deliver a clean, production-lean app shell that supports first-run master admin setup, secure admin login/logout, and blocks any public signup/registration. Includes template cleanup only as needed to implement FR1–FR5 cleanly.

### Story 1.1: Set up initial project from starter template + First-Run Gating Shell

As an admin,
I want the app entry flow to be clean and correctly gated on first run,
So that setup and login are always clear and consistent.

**Acceptance Criteria:**

**Given** the repository is checked out on a new machine
**When** dependencies are installed and the app is started
**Then** the app boots successfully to the LilStore entry flow (starter baseline)

**Given** the app is launched on a fresh install with no admin in the local database
**When** the entry route loads
**Then** the system determines no admin exists (FR1)
**And** the app shows a “Create Master Admin” flow (not an admin login screen) (FR2)
**And** no other template/demo screens are reachable from the app UI (template cleanup)

**Given** at least one admin exists in the local database
**When** the entry route loads
**Then** the system determines an admin exists (FR1)
**And** the app shows an “Admin Login” flow (FR4)
**And** no “public registration” UI is shown anywhere while logged out (FR3)

**Given** the app is cold-started on low-end target devices
**When** loading the home/entry screen
**Then** it completes within 2 seconds at the 95th percentile (NFR-P1)

### Story 1.2: Create Initial Master Admin (Username + Password)

As an admin,
I want to create the initial master admin account,
So that I can unlock admin features on the device.

**Acceptance Criteria:**

**Given** no admin exists
**When** I submit a valid username and password
**Then** the system creates the master admin and persists it locally (FR2)
**And** the password is not stored in plaintext (stored as a secure derived value)

**Given** one or more admins already exist
**When** I attempt to access any admin creation flow while not authenticated
**Then** the system prevents it (no public registration) (FR3)
**And** I am directed to admin login instead

**Given** master admin creation succeeded
**When** I close and relaunch the app
**Then** I am not prompted to create a master admin again

### Story 1.3: Admin Login + Protected Admin Session (Non-Persistent)

As an admin,
I want to log in with my username and password,
So that I can access admin-only features until I log out.

**Acceptance Criteria:**

**Given** valid admin credentials
**When** I log in
**Then** I am authenticated successfully (FR4)
**And** admin-only screens and actions are accessible
**And** unauthenticated users cannot access admin-only screens

**Given** invalid admin credentials
**When** I attempt to log in
**Then** I see a clear error message (FR4)
**And** I remain logged out

**Given** I am logged in as admin
**When** I force close the app and reopen it (app restart)
**Then** I am logged out automatically
**And** I must log in again to access admin-only screens

### Story 1.4: Admin Logout

As an admin,
I want to log out,
So that admin features are no longer accessible.

**Acceptance Criteria:**

**Given** I am logged in as admin
**When** I choose Log Out
**Then** I am returned to the admin login screen (FR5)
**And** admin-only screens are no longer accessible

## Epic 2: Multi-Owner Setup (Store Owners) & Data Isolation

Enable admin to create and switch between store owners on one device and enforce strict data isolation and scoping so each owner’s data never leaks to another owner.

### Story 2.1: Create and Switch Store Owners

As an admin,
I want to create and switch between store owners on the same device,
So that I can operate multiple independent stores without mixing data.

**Acceptance Criteria:**

**Given** I am logged in as admin
**When** I create a new store owner with a name
**Then** the owner is persisted locally and appears in the owner list (FR8)

**Given** two or more owners exist
**When** I switch the active owner from Owner A to Owner B
**Then** the app’s admin views operate in the context of Owner B (FR9)
**And** Owner A remains available to switch back to

### Story 2.2: Owner Data Isolation Enforcement

As an admin,
I want each owner’s data to be strictly isolated,
So that I never see or modify the wrong owner’s products, shoppers, shopping list, or history.

**Acceptance Criteria:**

**Given** Owner A and Owner B exist and both have data
**When** Owner A is the active owner
**Then** Owner B’s products, shoppers, shopping list, ledger, and history are not visible and cannot be used (AC4, FR10)

**Given** Owner A is active
**When** I create or edit an entity (product, shopper, shopping list item, payment, purchase)
**Then** it is associated only with Owner A
**And** it does not appear under Owner B after switching owners (FR10)

### Story 2.3: Manage Shoppers (Per Owner) with Unique PINs

As an admin,
I want to create and manage shoppers with a 4+ digit PIN,
So that only enrolled shoppers can buy on credit for the active owner.

**Acceptance Criteria:**

**Given** I am logged in as admin and an owner is active
**When** I create a shopper with a name and a PIN of at least 4 digits
**Then** the shopper is created under the active owner (FR11)
**And** the PIN is not stored in plaintext (stored as a secure derived value)

**Given** a shopper PIN is already in use on the device (any owner)
**When** I attempt to create or update a shopper using the duplicate PIN
**Then** the system blocks the save and prompts for a different PIN (required) (FR12)

**Given** an existing shopper
**When** I update the shopper’s name
**Then** the updated name is reflected in the admin shopper list

### Story 2.4: Shopper PIN Lookup Is Unambiguous (Device-Wide Uniqueness)

As an admin,
I want device-wide PIN uniqueness enforced,
So that PIN-only shopper lookup is always unambiguous.

**Acceptance Criteria:**

**Given** two shoppers exist on the device across any owners
**When** their PINs would otherwise collide
**Then** the system prevents the collision at write time (cannot save duplicates) (FR12)
**And** shopper PIN entry can identify exactly one shopper (no ambiguity)

## Epic 3: Product Catalog Management

Enable admin to manage a per-owner product catalog with barcode rules that prevent duplicates within an owner while allowing the same barcode across different owners.

### Story 3.1: Create and Edit Products (Name + Barcode)

As an admin,
I want to create and edit products with a name and barcode,
So that my store’s catalog is accurate for shopping list publishing.

**Acceptance Criteria:**

**Given** I am logged in as admin and an owner is active
**When** I create a product with a name and barcode
**Then** the product appears in the active owner’s product list (FR13)

**Given** a product exists
**When** I update its name or barcode
**Then** the changes are saved and reflected in the product list (FR14)

### Story 3.2: Prevent Duplicate Barcodes Within an Owner

As an admin,
I want duplicate product barcodes blocked within the same owner,
So that scanning can identify a single product reliably.

**Acceptance Criteria:**

**Given** Owner A already has a product with barcode X
**When** I attempt to create or update another Owner A product to barcode X
**Then** the system blocks the save and shows a clear error (FR16)

**Given** Owner A and Owner B exist
**When** Owner B creates a product using barcode X
**Then** it is allowed and does not affect Owner A’s product (FR17)

### Story 3.3: Archive or Delete Products

As an admin,
I want to archive or delete products,
So that my catalog stays current without clutter.

**Acceptance Criteria:**

**Given** a product exists for the active owner
**When** I archive or delete the product
**Then** it is removed from the active product list (or clearly marked archived) (FR15)
**And** it is no longer offered as an active product choice in admin product pickers

## Epic 4: Published Shopping List (For-Sale) Management + Pricing Setup

Enable admin to publish what shoppers can buy with pricing (unit + optional bundle offers) and availability controls, including creation of assorted groups sharing pricing rules and a pooled available quantity.

### Story 4.1: Create Shopping List Items (Unit Price + Available Qty)

As an admin,
I want to publish a shopping list with price and available quantity,
So that shoppers only see what is for sale (and stock constraints are enforced).

**Acceptance Criteria:**

**Given** I am logged in as admin and an owner is active
**When** I create a shopping list item referencing a product/barcode with a unit price and available quantity
**Then** the item appears in the published shopping list for that owner (FR18)

**Given** a shopping list item exists
**When** I update its unit price or available quantity
**Then** the updated values are saved and used for shopper purchase sessions (FR19)

**Given** a shopping list item exists
**When** I remove it from the shopping list
**Then** it is no longer purchasable by shoppers (FR20, FR21)

### Story 4.2: Configure Optional Bundle Offers

As an admin,
I want to configure bundle offers on shopping list items,
So that pricing rules like “3 for ₱5” are supported.

**Acceptance Criteria:**

**Given** I am creating or editing a shopping list item
**When** I define a bundle offer with bundle quantity and bundle price
**Then** the offer is saved with the shopping list item (FR47)
**And** the system validates the offer fields are present and sensible (no missing qty/price)

### Story 4.3: Create and Manage Assorted Shopping List Groups

As an admin,
I want to create an “Assorted” shopping list entry that groups multiple barcodes,
So that multiple products can share pricing rules and a pooled available quantity.

**Acceptance Criteria:**

**Given** multiple products exist for the active owner
**When** I create an assorted shopping list item and add multiple barcodes as members
**Then** the shopping list shows a single “Assorted” entry for the group (FR51)
**And** the group has one shared available quantity pool and one shared pricing rule set

**Given** an assorted group exists
**When** I edit its member barcodes, pricing, or available quantity
**Then** the changes are saved and reflected in shopper sessions

### Story 4.4: Admin Shopping List Management Remains Responsive at Scale

As an admin,
I want shopping list management to stay fast as data grows,
So that weekly refresh and ad-hoc adjustments remain practical.

**Acceptance Criteria:**

**Given** the active owner has 200+ products and a large shopping list
**When** I browse and edit the shopping list
**Then** I can continue to manage and update shopping list items effectively (FR19)
**And** the UI remains responsive without visible jank during normal scrolling (NFR-P4)

## Epic 5: Shopper “Buy Now” Flow (PIN → Scan → Qty → Cart → Confirm)

Deliver the fast, shared-device shopper experience: PIN unlock, scan items, block “not available” items, select quantities with guardrails, and preview/edit cart before confirming.

### Story 5.1: PIN Entry Unlocks Shopper Session

As a shopper,
I want to unlock the purchase flow by entering my PIN,
So that only I can buy under my name on a shared device.

**Acceptance Criteria:**

**Given** I am on the home screen
**When** I choose “Buy Now”
**Then** I see a PIN entry UI (FR6)

**Given** I enter a valid PIN
**When** I submit the PIN
**Then** the system identifies the shopper and starts a purchase session (AC5, FR6)
**And** it navigates to the scanner experience (FR22)

**Given** I enter an invalid PIN
**When** I submit the PIN
**Then** I see a clear, non-judgmental error message
**And** the scanner remains locked

### Story 5.2: Scanner Ready Fast + “Not Available” Blocking

As a shopper,
I want scanning to be fast and to clearly block unavailable items,
So that checkout is quick and I don’t accidentally buy non-listed products.

**Acceptance Criteria:**

**Given** I have started a purchase session successfully
**When** the scanner screen loads
**Then** it is ready to scan within 1 second at the 95th percentile on low-end devices (NFR-P2)

**Given** I scan a barcode that is on the published shopping list for my owner
**When** the scan is processed
**Then** the system identifies the item as purchasable (FR23)
**And** the app presents an “available” add-to-cart screen within 300ms average (excluding camera focus time) (NFR-P3)

**Given** I scan a barcode that is not on the published shopping list for my owner
**When** the scan is processed
**Then** the system identifies the item as not purchasable (FR23)
**And** informs me and prevents adding it to the cart (FR24)
**And** I see an unmissable “Product not available” state (AC6)
**And** I cannot add the item to my cart

### Story 5.3: Quantity Selection with Guardrails (Draft Cart)

As a shopper,
I want to set a quantity for a scanned item (quick 1–10 and custom),
So that I can purchase the correct amount quickly.

**Acceptance Criteria:**

**Given** I scan an item that is on the published shopping list
**When** I choose a quantity using a quick 1–10 control or a custom input
**Then** the selected quantity is captured for the draft cart (FR25)

**Given** the item has available quantity N
**When** I try to set a quantity greater than N
**Then** the app blocks the action and guides me to the maximum allowed (AC7, FR26)

### Story 5.4: Cart Preview and Editing Before Confirm

As a shopper,
I want to preview and edit my cart before confirming,
So that I can correct mistakes and understand what I owe.

**Acceptance Criteria:**

**Given** I have items in my cart
**When** I open cart preview
**Then** I see the items, quantities, unit prices, computed line totals, and computed cart total (FR27)
**And** the computed cart total equals the sum of computed line totals (FR49)

**Given** I am viewing cart preview
**When** I remove an item or adjust quantities within availability
**Then** the cart updates accordingly (AC8, FR28)

## Epic 6: Transactions, Inventory, Ledger & History (Correctness First)

Finalize purchases as immutable transactions with correct totals and strict integrity: decrement stock, write purchase history, update balances, support payments, and implement bundle + assorted pooled-availability behavior and labeling.

### Story 6.1: Confirm Purchase (Atomic) with Unit Pricing

As a shopper,
I want to confirm my purchase and know it was recorded,
So that my credit balance and the store’s inventory are updated correctly.

**Acceptance Criteria:**

**Given** I have a valid cart with only purchasable items and allowed quantities
**When** I confirm the purchase
**Then** the system finalizes the cart as an immutable purchase transaction (FR29)
**And** revalidates availability at confirm time and rejects if constraints are violated (NFR-R3)
**And** on success it writes an immutable purchase record with a timestamp (FR31)

**Given** a purchase is confirmed successfully
**When** the confirmation completes
**Then** shopping list available quantities decrement for the purchased items (FR30)
**And** the shopper’s running balance increases by the computed total (FR33)
**And** the shopper session ends automatically and returns to home (FR7, NFR-S2)

**Given** a failure occurs during confirm (write error or validation failure)
**When** confirmation finishes
**Then** the system applies the operation atomically (all changes applied or none) (NFR-R1)

### Story 6.2: Bundle Pricing Computation (Bundles First) + Auditability

As a shopper,
I want bundle pricing to be applied correctly,
So that my totals match posted offers.

**Acceptance Criteria:**

**Given** a cart line item has unit price and a bundle offer `{bundleQty, bundlePrice}`
**When** the cart totals are computed and the purchase is confirmed
**Then** the line total is computed as bundles first, then remainder at unit price (FR48, AC13)

**Given** a purchase is recorded
**When** the purchase record is stored
**Then** it stores both the pricing inputs (unit price and bundle offer) and the computed totals for auditability (FR50)

### Story 6.3: Assorted Items (Pooled Availability) + Labeling

As a shopper,
I want assorted group items to share stock and pricing correctly,
So that I can buy any member barcode while the store enforces the shared limit.

**Acceptance Criteria:**

**Given** barcodes belong to a single assorted shopping list group with pooled available quantity N
**When** I scan assorted member barcodes and set quantities across them
**Then** the system enforces that the summed quantity across assorted members does not exceed N (AC14)

**Given** I confirm a purchase containing assorted members
**When** the purchase is recorded
**Then** the shared assorted availability pool decrements by the summed quantity (FR52)

**Given** an assorted member is displayed in cart and purchase history
**When** its line item is shown
**Then** the label includes the underlying product name with suffix “(assorted)” (FR53, AC15)

### Story 6.4: Per-Shopper Balance and Ledger Invariants

As an admin,
I want each shopper’s running balance to be correct and fast to view,
So that I can track what each shopper owes.

**Acceptance Criteria:**

**Given** purchases and payments exist for a shopper
**When** I view the shopper in admin mode
**Then** the system maintains and shows a per-shopper running balance (FR32)
**And** I can see the current balance owed
**And** the balance reflects the sum of recorded purchases minus recorded payments

### Story 6.5: Record Shopper Payments (Reduce Balance)

As an admin,
I want to record a payment from a shopper,
So that balances stay accurate and auditable.

**Acceptance Criteria:**

**Given** a shopper has a balance greater than 0
**When** I record a payment amount X
**Then** a payment record with timestamp is created (FR34, AC10)
**And** the shopper balance decreases by X (FR35)
**And** the write is atomic (NFR-R1)

### Story 6.6: Purchase and Payment History Views (Owner-Scoped)

As an admin,
I want to view purchase and payment history with timestamps,
So that I can audit activity and resolve disputes.

**Acceptance Criteria:**

**Given** purchases exist for the active owner
**When** I view purchase history
**Then** I can see purchase entries with timestamps (FR36)

**Given** payments exist for the active owner
**When** I view payment history
**Then** I can see payment entries with timestamps (FR37)

**Given** Owner A and Owner B exist
**When** Owner A is active
**Then** Owner B’s purchase/payment histories are not visible (FR38)

## Epic 7: Backup/Restore + Admin Alerts Dashboard

Enable admin to export/restore the entire local database via JSON with safe atomic replace-all restore, and provide local alerts for low/zero stock items and backup freshness.

### Story 7.1: Export Full Backup to JSON (All Owners)

As an admin,
I want to export a full backup of all data to a JSON file,
So that I can recover from device loss or reinstall.

**Acceptance Criteria:**

**Given** data exists across owners (products, shoppers, shopping list, purchases, payments, balances)
**When** I export a backup
**Then** the JSON contains the entire database (FR39, FR40, AC11)
**And** the JSON includes `schemaVersion` and `exportedAt` metadata (NFR-M1)

**Given** I am not logged in as an admin
**When** I attempt to export a backup
**Then** the export is not accessible (admin-only flow)

**Given** the backup is created
**When** I inspect the backup content
**Then** shopper PINs are not present in plaintext (NFR-S1)

### Story 7.2: Restore Backup (Replace-All, Atomic, Validated)

As an admin,
I want to restore from a JSON backup safely,
So that I can recover everything without risking partial or corrupted state.

**Acceptance Criteria:**

**Given** existing local data is present
**When** I restore from a valid backup
**Then** the system restores the entire local database from the backup (FR41)
**And** all local data is replaced by backup contents (FR42, AC12)
**And** the restore is atomic (either fully applied or not applied) (NFR-R1, NFR-R2)

**Given** I attempt to restore from an invalid or incompatible backup
**When** validation fails (missing fields or unsupported schema version)
**Then** restore is rejected with a clear error (FR43, NFR-M2)
**And** existing local data remains unchanged

### Story 7.3: Admin Dashboard Alerts (Low Stock + Backup Freshness)

As an admin,
I want a dashboard that surfaces low stock and backup reminders,
So that I can keep the store running smoothly without push notifications.

**Acceptance Criteria:**

**Given** the shopping list has items at low/zero available quantity
**When** I open the admin dashboard
**Then** I see alerts for low/zero stock items (FR45)

**Given** a backup has not been exported recently
**When** I open the admin dashboard
**Then** I see a backup freshness reminder based on last backup age (FR46)

**Given** I am logged in as an admin
**When** I open the admin dashboard
**Then** I can see a dashboard view that surfaces local alerts/reminders (FR44)

### Story 7.4: Dashboard Accessible and Useful in Offline Mode

As an admin,
I want the dashboard and core admin workflows to work offline,
So that I can operate the app without internet connectivity.

**Acceptance Criteria:**

**Given** the device has no internet connectivity
**When** I perform core admin workflows (manage owners/shoppers/products/shopping list, record payment, export backup, restore backup)
**Then** the workflows remain usable and complete successfully (NFR-U3)
**And** I can export and restore backups while offline via admin-only flows (FR39, FR40, FR41, FR42, FR43)
**And** I can still view the admin dashboard alerts while offline (FR44)
