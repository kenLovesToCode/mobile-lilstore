# Story 1.1 Manual Verification Checklist

Date: 2026-03-02

## Environment Setup

- [x] On a clean checkout, run `npm install`.
- [x] Start app with `npm run start`.
- [x] Confirm app boots without runtime errors.

## First-Run Path (No Admin)

- [x] Clear app data / remove existing local DB for the app install.
- [x] Launch app and confirm the first screen resolves to `Create Master Admin`.
- [x] Confirm no template/demo navigation (such as `Explore` tab/screen) appears in the UI.

## Returning Admin Path (Admin Exists)

- [x] Insert at least one row in `admin` table (via dev tooling or by completing Story 1.2 flow once available).
- [x] Relaunch app and confirm entry resolves to `Admin Login`.
- [x] Confirm master-admin setup UI is no longer available from logged-out routes.

## Responsiveness / Startup

- [x] Test cold starts on low-end device profile/emulator.
- [x] Verify entry decision and screen display remain clear and responsive during loading.
- [x] Capture objective p95 startup timing evidence (<= 2s) using device-level startup benchmarks, or record a benchmark blocker with Product Owner-approved alternate acceptance for the current environment.

## Executed Verification Evidence

- Date: 2026-03-02
- Commands:
  - `npm run test:gate`
  - `npm run test:gate:integration`
  - `npm run lint`
  - `npx tsc --noEmit`
- Results:
  - Entry/no-admin, entry/has-admin, and admin-shell redirects are covered by mounted Expo Router integration tests in `tests/entry-gating.integration.test.tsx`.
  - Demo-route regression remains enforced via route-file scan assertions in `tests/entry-gating.spec.ts` (`/explore` absent).
  - All listed commands passed.

## Objective Timing Evidence

- Date: 2026-03-02
- Command: `npm run benchmark:cold-start:android -- --package <android.package> --activity <launcher.activity> --runs 15`
- Result: Android-scripted benchmark still blocked (`spawnSync adb ENOENT`) and intentionally waived for Story 1.1 because user declined `adb` installation on mac due storage constraints.
- Note: User-reported supplemental observation from Expo Go testing on real Android device is ~250ms after "Loading LilStore"; this is anecdotal and not objective p95 evidence.

## Product Owner Acceptance (Alternate Criterion)

- Date: 2026-03-02
- Owner: myjmyj (Product Owner)
- Decision: Formally revise Story 1.1 AC4 acceptance for this environment to integration-backed startup responsiveness validation (mounted router gate flow + no blocking/loading dead-end + passing quality gates), because objective Android benchmark tooling remains blocked by the `adb` dependency on the current machine.
- Follow-up Requirement: Capture objective cold-start p95 evidence on an `adb`-capable setup before closing the next performance-sensitive auth-entry story.
