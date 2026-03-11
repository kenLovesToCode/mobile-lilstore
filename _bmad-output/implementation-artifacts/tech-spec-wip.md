---
title: 'Admin CRUD Workspace Compaction and Bottom Drawer Redesign'
slug: 'admin-crud-workspace-compaction-and-bottom-drawer-redesign'
created: '2026-03-11T11:35:15+08:00'
status: 'in-progress'
stepsCompleted: [1, 2]
tech_stack:
  - 'Expo Router'
  - 'React Native'
  - 'Tamagui'
  - 'TypeScript'
  - 'expo-symbols'
  - 'react-native-safe-area-context'
  - 'react-native-reanimated'
  - 'Jest'
  - 'expo-router/testing-library'
files_to_modify:
  - 'src/components/ui/admin-shell.tsx'
  - 'src/components/ui/contextual-editor-surface.tsx'
  - 'src/components/ui/admin-tab-bar.tsx'
  - 'src/components/ui/selection-list-card.tsx'
  - 'src/components/ui/segmented-mode-toggle.tsx'
  - 'src/components/ui/motion-pressable.tsx'
  - 'src/components/ui/status-chip.tsx'
  - 'src/app/(admin)/(tabs)/_screens/dashboard-screen.tsx'
  - 'src/app/(admin)/(tabs)/_screens/products-screen.tsx'
  - 'src/app/(admin)/(tabs)/_screens/shopping-list-screen.tsx'
  - 'src/app/(admin)/(tabs)/_screens/owners-screen.tsx'
  - 'src/app/(admin)/(tabs)/_screens/owner-data-screen.tsx'
  - 'src/app/(admin)/(tabs)/_screens/history-screen.tsx'
  - 'src/app/(admin)/(tabs)/_screens/export-screen.tsx'
  - 'src/app/(admin)/(tabs)/_screens/restore-screen.tsx'
  - 'src/app/(admin)/(tabs)/_screens/more-screen.tsx'
  - 'src/app/(admin)/(tabs)/_layout.tsx'
  - 'src/features/admin/navigation/admin-navigation.ts'
  - 'tests/admin-tab-state.integration.test.tsx'
  - 'tests/shopping-list-admin.integration.test.tsx'
  - 'tests/owner-data-scope.integration.test.tsx'
  - 'tests/owner-management.integration.test.tsx'
  - 'tests/admin-history.integration.test.tsx'
  - 'tests/backup-export.integration.test.tsx'
  - 'tests/backup-restore.integration.test.tsx'
  - 'tests/admin-offline-workflows.integration.test.tsx'
code_patterns:
  - 'Admin routes orchestrate UI while domain rules stay in src/domain/services/**'
  - 'Shared admin presentation primitives live in src/components/ui'
  - 'Owner/admin session context comes from admin-session via useSyncExternalStore'
  - 'AdminShell is a FlatList-based shell with a large hero header and owner/admin chip row'
  - 'Products and shopping already use contextual workspace primitives and segmented modes'
  - 'Wide admin layouts are width-gated split workspaces using useWindowDimensions breakpoints'
  - 'CRUD submissions use local submit-lock refs and owner-context version refs to prevent stale writes'
  - 'Integration-safe selectors rely heavily on accessibility labels and a small set of testIDs'
  - 'Epic 9 stories preserve path stability and offline-first behavior while redesigning presentation'
test_patterns:
  - 'Integration-first coverage for admin workflows and regressions'
  - 'Existing tests preserve owner-scope, stale-response, and offline behavior'
  - 'UI selector stability matters unless tests are intentionally updated in the same change'
  - 'Tab-state tests assert unsaved draft persistence across tab switches'
  - 'CRUD tests assert create/edit/remove flows through current button labels and conditional surface visibility'
---

# Tech-Spec: Admin CRUD Workspace Compaction and Bottom Drawer Redesign

**Created:** 2026-03-11T11:35:15+08:00

## Overview

### Problem Statement

The admin application still shows too much non-essential detail in high-frequency workspaces, especially after entering Products from the bottom navigation. Several admin screens also stack too many cards and action forms vertically, which reduces usable space and keeps create, edit, and delete controls visible all at once. That makes the admin experience feel dense, repetitive, and less efficient than it should be for frequent CRUD tasks.

### Solution

Apply a consistent admin-wide workspace refinement across all admin tabs and admin screens. The redesign should keep owner and signed-in admin context visible in a compact header, remove long helper/detail copy where it is not needed, reduce vertically stacked card density, and move CRUD-style create/edit/delete interactions into bottom drawer surfaces that open only when the user chooses an action.

### Scope

**In Scope:**
- All admin tabs and admin screens under the current admin shell
- Compact owner and signed-in admin display that remains visible but small
- Removal or reduction of long descriptive text that does not materially help task completion
- Fewer vertically stacked cards and better use of horizontal space when available
- Bottom drawer interactions for CRUD-style create, edit, and delete flows
- Reuse of shared admin UI primitives and patterns so the redesign feels consistent across the admin app

**Out of Scope:**
- Shopper-facing routes and workflows
- Service-layer or database-rule rewrites
- Authentication/session behavior changes beyond how owner/admin context is displayed
- New product features unrelated to workspace density and CRUD interaction design
- Navigation/path changes that alter existing admin route stability

## Context for Development

### Codebase Patterns

- Admin routes live under `src/app/(admin)/(tabs)/_screens/**` and route wrappers simply re-export those screen modules, so the redesign can stay within screen files and shared UI without changing route paths.
- `AdminShell` is the central admin container. It renders a large hero card with `eyebrow`, `title`, `subtitle`, optional `heroVisual`, optional `headerActions`, and a persistent chip row for signed-in admin and active owner. That means compact-header work should start in `src/components/ui/admin-shell.tsx` rather than repeating per screen.
- Most Epic 9 screens still pass fairly long `subtitle` strings into `AdminShell`, and some high-frequency screens add a second owner-context card below the shell hero. The current density problem is therefore partly a shell issue and partly duplicated local screen copy.
- Shared admin presentation primitives already exist in `src/components/ui`, especially `SelectionListCard`, `ContextualEditorSurface`, `SegmentedModeToggle`, `DashboardStatCard`, `IllustratedStateCard`, `SoftCard`, `MotionPressable`, and `StatusChip`.
- There is no existing shared bottom sheet or drawer implementation in `src/components/ui`, and repo search did not find current `Sheet` usage inside `src/**`. A new shared admin bottom-drawer primitive will likely be required.
- Current screen orchestration consistently pulls active owner and signed-in admin context from `src/domain/services/admin-session` using `useSyncExternalStore`, so owner/admin display changes are a presentation concern only.
- Products, Shopping, History, Owner Data, and Dashboard all use width-based split layouts or card grids via `useWindowDimensions`, with breakpoints around `720`, `920`, `980`, and `1080`. Any compaction pass should unify this rather than adding more one-off thresholds.
- CRUD-heavy screens guard async actions with local submit-lock refs plus owner-context version refs to prevent stale results from an old owner rendering or writing after context changes.
- Existing implementation artifacts and services show a strong rule to preserve service contracts, owner-scoped behavior, offline safety, and route stability while evolving presentation.
- Hidden text and stable accessibility labels are intentionally used for integration tests, especially in Owner Data, Products, Shopping, History, Export, and Restore.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/components/ui/admin-shell.tsx` | Shared admin hero/header shell that currently owns the verbose subtitle and owner/admin chip presentation |
| `src/components/ui/contextual-editor-surface.tsx` | Current inline editing card primitive that will likely be replaced or wrapped by a bottom drawer flow |
| `src/components/ui/admin-tab-bar.tsx` | Bottom navigation shell to keep stable while the admin screens are compacted |
| `src/components/ui/selection-list-card.tsx` | Shared list card used across Products, Shopping, Owner Data, and History |
| `src/components/ui/segmented-mode-toggle.tsx` | Shared mode/lane switcher used for active-vs-archived and standard-vs-assorted style toggles |
| `src/components/ui/motion-pressable.tsx` | Shared interactive button primitive with reduced-motion handling |
| `src/components/ui/status-chip.tsx` | Shared compact metadata chip used for owner/admin and state labels |
| `src/app/(admin)/(tabs)/_screens/dashboard-screen.tsx` | Admin home screen; not CRUD-heavy, but in scope for compact header/layout consistency |
| `src/app/(admin)/(tabs)/_screens/products-screen.tsx` | Current catalog workspace with split columns plus inline create/edit/archive/delete/restore surfaces |
| `src/app/(admin)/(tabs)/_screens/shopping-list-screen.tsx` | Highest-density admin CRUD screen; still mounts multiple create/edit/remove surfaces inline |
| `src/app/(admin)/(tabs)/_screens/owners-screen.tsx` | Owner creation/switching screen that currently keeps creation inline and should move create flow into drawer |
| `src/app/(admin)/(tabs)/_screens/owner-data-screen.tsx` | Dense owner-ops utility screen with many CRUD helpers that can benefit from drawer-based task focusing |
| `src/app/(admin)/(tabs)/_screens/history-screen.tsx` | Read-only screen in scope for compact header and layout simplification, but not drawer CRUD |
| `src/app/(admin)/(tabs)/_screens/export-screen.tsx` | Task screen in scope for compact header and reduced explanatory copy |
| `src/app/(admin)/(tabs)/_screens/restore-screen.tsx` | Destructive task screen in scope for compact header while preserving explicit confirmation semantics |
| `src/app/(admin)/(tabs)/_screens/more-screen.tsx` | Secondary hub that may need copy compaction and tile density adjustments |
| `src/app/(admin)/(tabs)/_layout.tsx` | Tab shell wrapper that must preserve current hidden-secondary-route structure |
| `src/features/admin/navigation/admin-navigation.ts` | Stable route metadata for primary and secondary admin destinations |
| `src/domain/services/admin-session.ts` | Owner/admin identity source used by every admin screen |
| `src/domain/services/owner-service.ts` | Owners CRUD service boundary that must remain untouched by presentation refactors |
| `src/domain/services/owner-data-service.ts` | Aggregated owner-scoped service surface used by Products, Shopping, History, and Owner Data |
| `src/domain/services/backup-service.ts` | Export/restore contract that must remain stable while UI changes |
| `tests/admin-tab-state.integration.test.tsx` | Locks draft persistence and route-shell behavior for Products and Shopping |
| `tests/shopping-list-admin.integration.test.tsx` | Locks shopping CRUD, search, assorted, remove-confirm, and performance-adjacent UI behaviors |
| `tests/owner-data-scope.integration.test.tsx` | Locks product CRUD and owner-data selectors/guards across owner contexts |
| `tests/owner-management.integration.test.tsx` | Locks owner creation and switching flow |
| `tests/admin-history.integration.test.tsx` | Locks history filters, drill-down, and stale-owner protection |
| `tests/backup-export.integration.test.tsx` | Locks backup export labels, single-flight behavior, and success state |
| `tests/backup-restore.integration.test.tsx` | Locks restore picker, preview, confirmation, and restore execution constraints |
| `tests/admin-offline-workflows.integration.test.tsx` | Locks offline-capable admin flows and several stable test selectors |
| `_bmad-output/implementation-artifacts/9-4-products-and-shopping-flows-redesign.md` | Existing redesign story for primary CRUD-heavy admin modules |
| `_bmad-output/implementation-artifacts/9-5-remaining-admin-modules-visual-alignment.md` | Existing redesign story for remaining admin modules |

### Technical Decisions

- Preserve current admin route structure and service boundaries. This remains a presentation and interaction redesign only.
- Treat compact owner/admin display as a shared shell-level pattern. `AdminShell` should likely absorb most of the “make owner and signed-in smaller but visible” requirement.
- Remove or sharply reduce screen-level duplicate owner info cards where the shell already carries the same information, especially in Products and Shopping.
- Introduce one shared admin bottom-drawer primitive for CRUD-heavy interactions instead of continuing to expand `ContextualEditorSurface` as an always-mounted inline form.
- Target drawer-based CRUD primarily for `Products`, `Shopping`, `Owners`, and CRUD/helper sections inside `Owner Data`. Apply compact-layout treatment, but not forced drawer CRUD, to `Dashboard`, `History`, `More`, `Export`, and `Restore`.
- Preserve current accessibility labels and test IDs where feasible. If labels must change because buttons move into drawers, tests must be updated intentionally in the same implementation.
- Preserve current async safety patterns:
  - owner change resets local drafts where current screens already do so
  - stale async results must still be ignored via owner-context version refs and request IDs
  - destructive actions must still require explicit confirmation
- Preserve current route and tab-state behavior. The tab shell must continue to keep in-progress local draft state through normal tab switches.
- Keep current no-owner empty states and route affordances, but compact their copy where it is verbose.
- Because there is no existing sheet implementation in the admin UI layer, Step 3 should plan for a new reusable drawer component rather than ad hoc per-screen modals.

## Implementation Plan

### Tasks

- Define the affected admin screens and shared primitives that need a compact-header and bottom-drawer pass.
- Map current CRUD interactions screen by screen and decide which should move into shared bottom-drawer patterns versus remain inline or confirmation-only.
- Refactor shared admin shell/header behavior so owner/admin context stays visible in a compact format.
- Rework screen layouts to reduce unnecessary card stacking and improve use of available width.
- Update or extend regression coverage for any changed interaction labels, drawers, and screen-state behavior.

### Acceptance Criteria

- All admin tabs and admin screens use a more compact workspace style with visible but minimal owner/admin context.
- Long descriptive copy that does not help task completion is removed or reduced across the affected admin screens.
- CRUD-style create, edit, and delete flows open in bottom drawer surfaces instead of remaining exposed inline by default.
- Workspace layouts use available screen width more effectively and reduce unnecessary vertical stacks.
- Existing owner-scoped behavior, offline behavior, route stability, and destructive safeguards remain intact.

## Additional Context

### Dependencies

- Existing admin UI primitives under `src/components/ui`
- `src/domain/services/admin-session`
- Owner-scoped service contracts already used by current admin screens
- Tamagui-based component stack already present in the project

### Testing Strategy

- Start from current integration coverage for products, shopping, owners, owner-data, history, backup export/restore, and admin tab state.
- Preserve stable selectors where possible; if interaction models move to drawers, update tests intentionally in the same change.
- Revalidate owner-switch resets, stale async guard behavior, destructive confirmations, and offline-first admin workflows after the UI changes.

### Notes

- The request overlaps and extends Epic 9 redesign work rather than introducing a separate visual direction.
- Products is the immediate trigger for this request, but the confirmed scope is the full admin app.
- Deep investigation confirmed that History is read-only and Export/Restore are task surfaces rather than CRUD forms, so they should receive compact-header/layout treatment but not forced create/edit/delete drawers.
- Deep investigation confirmed that the largest current density regressions are `src/app/(admin)/(tabs)/_screens/products-screen.tsx`, `src/app/(admin)/(tabs)/_screens/shopping-list-screen.tsx`, and `src/app/(admin)/(tabs)/_screens/owner-data-screen.tsx`.
