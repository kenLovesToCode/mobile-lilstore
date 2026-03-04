#!/usr/bin/env node

import { readFileSync } from "node:fs";

const PREFIX = "[shopping-list-perf]";

function usage() {
  console.error(
    "Usage: node ./scripts/summarize-shopping-list-perf-log.mjs <log-file>",
  );
}

function percentile(sortedValues, p) {
  if (sortedValues.length === 0) {
    return 0;
  }
  const index = Math.max(0, Math.ceil(sortedValues.length * p) - 1);
  return sortedValues[index] ?? 0;
}

function formatMs(value) {
  return `${value.toFixed(2)}ms`;
}

function summarizeDurations(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const sum = values.reduce((total, current) => total + current, 0);
  const min = sorted[0] ?? 0;
  const max = sorted[sorted.length - 1] ?? 0;
  const avg = values.length > 0 ? sum / values.length : 0;
  return {
    count: values.length,
    min,
    p50: percentile(sorted, 0.5),
    p95: percentile(sorted, 0.95),
    max,
    avg,
  };
}

function parseMetricLines(fileContents) {
  const lines = fileContents.split(/\r?\n/);
  const parsed = [];
  for (const line of lines) {
    if (!line.includes(PREFIX)) {
      continue;
    }
    const match = line.match(/\[shopping-list-perf\]\s+(\{.*\})/);
    if (!match?.[1]) {
      continue;
    }
    try {
      parsed.push(JSON.parse(match[1]));
    } catch {
      // Ignore malformed lines from copy/paste noise.
    }
  }
  return parsed;
}

function main() {
  const inputPath = process.argv[2];
  if (!inputPath) {
    usage();
    process.exit(1);
  }

  let fileContents;
  try {
    fileContents = readFileSync(inputPath, "utf8");
  } catch (error) {
    console.error(`Failed to read log file: ${String(error)}`);
    process.exit(1);
  }

  const metrics = parseMetricLines(fileContents);
  if (metrics.length === 0) {
    console.error(`No ${PREFIX} entries found in ${inputPath}`);
    process.exit(2);
  }

  const durationGroups = new Map();
  const scrollLoopGroups = new Map();

  for (const metric of metrics) {
    const durationMs =
      typeof metric.durationMs === "number" && Number.isFinite(metric.durationMs)
        ? metric.durationMs
        : null;
    if (durationMs == null) {
      continue;
    }
    const target = typeof metric.target === "string" ? metric.target : "all";
    const profileLabel =
      typeof metric.profileLabel === "string" && metric.profileLabel.trim().length > 0
        ? metric.profileLabel.trim()
        : "unlabeled";
    const key = `${profileLabel}:${metric.metric}:${target}`;
    if (!durationGroups.has(key)) {
      durationGroups.set(key, []);
    }
    durationGroups.get(key).push(durationMs);

    if (metric.metric === "scroll_loop") {
      if (!scrollLoopGroups.has(key)) {
        scrollLoopGroups.set(key, {
          samples: 0,
          jankEvents: 0,
          totalEvents: 0,
        });
      }
      const group = scrollLoopGroups.get(key);
      const jankEventCount =
        typeof metric.jankEventCount === "number" ? metric.jankEventCount : 0;
      const eventCount = typeof metric.eventCount === "number" ? metric.eventCount : 0;
      group.samples += 1;
      group.jankEvents += jankEventCount;
      group.totalEvents += eventCount;
    }
  }

  console.log(`Parsed ${metrics.length} metric events from ${inputPath}`);
  console.log("");
  console.log("Duration summary:");
  for (const [key, values] of Array.from(durationGroups.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  )) {
    const summary = summarizeDurations(values);
    console.log(
      `- ${key}: count=${summary.count}, min=${formatMs(summary.min)}, p50=${formatMs(summary.p50)}, p95=${formatMs(summary.p95)}, max=${formatMs(summary.max)}, avg=${formatMs(summary.avg)}`,
    );
  }

  if (scrollLoopGroups.size > 0) {
    console.log("");
    console.log("Scroll jank summary:");
    for (const [key, group] of Array.from(scrollLoopGroups.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    )) {
      const jankRate =
        group.totalEvents > 0 ? (group.jankEvents / group.totalEvents) * 100 : 0;
      console.log(
        `- ${key}: samples=${group.samples}, jankEvents=${group.jankEvents}/${group.totalEvents} (${jankRate.toFixed(2)}%)`,
      );
    }
  }
}

main();
