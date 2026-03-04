# Story 4.4 No-ADB Performance Capture

Date: 2026-03-04

## Goal

Capture objective, reproducible shopping-list performance metrics without installing `adb`, using production-like Expo runtime flags and in-app instrumentation logs.

## Runtime Setup

1. Start Metro in production-like mode with perf logging enabled:
   - Baseline run:
     - `EXPO_PUBLIC_SHOPPING_LIST_PERF=1 EXPO_PUBLIC_SHOPPING_LIST_PERF_LABEL=baseline npx expo start --no-dev --minify`
   - Post-change run:
     - `EXPO_PUBLIC_SHOPPING_LIST_PERF=1 EXPO_PUBLIC_SHOPPING_LIST_PERF_LABEL=post-change npx expo start --no-dev --minify`
2. Open the app on your target device.
3. Go to Admin -> Shopping List.

## Test Scenario (per run)

1. Use an owner with 200+ products and a large published shopping list.
2. Perform 10 loop iterations:
   - Scroll through the list normally (down and up).
   - Select a standard or assorted row.
   - Edit quantity or unit price and press Save.
3. Repeat with similar pace for every iteration.

## Log Collection

1. Copy terminal logs containing prefix `[shopping-list-perf]` to a text file:
   - Example: `./tmp/shopping-list-perf.log`
2. Summarize metrics:
   - `npm run perf:shopping-list:summary -- ./tmp/shopping-list-perf.log`

## Expected Metrics

- `scroll_loop`: duration, event count, jank event count, max frame gap.
- `select_latency`: tap-to-selection render latency.
- `edit_save_latency`: save-to-refreshed-list latency.

## Story Evidence Template

- Baseline summary (from script output):
  - `baseline:scroll_loop:all` p50/p95:
  - `baseline:select_latency:*` p50/p95:
  - `baseline:edit_save_latency:*` p50/p95:
- Post-change summary (from script output):
  - `post-change:scroll_loop:all` p50/p95:
  - `post-change:select_latency:*` p50/p95:
  - `post-change:edit_save_latency:*` p50/p95:
- Observations:
  - Scroll jank rate change:
  - Select latency change:
  - Edit-save latency change:
