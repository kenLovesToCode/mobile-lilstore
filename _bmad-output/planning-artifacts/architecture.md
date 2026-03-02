---
stepsCompleted: [1, 2]
inputDocuments:
  - /Users/kenlovestocode/Desktop/Me/ai/LilStore/_bmad-output/planning-artifacts/prd.md
  - /Users/kenlovestocode/Desktop/Me/ai/LilStore/_bmad-output/planning-artifacts/ux-design-specification.md
workflowType: 'architecture'
project_name: 'LilStore'
user_name: 'myjmyj'
date: '2026-03-02T11:45:42+08:00'
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
