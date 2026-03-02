#!/usr/bin/env node

import { execFileSync } from "node:child_process";

const DEFAULT_RUNS = 15;
const NFR_TARGET_MS = 2000;

function parseArgs(argv) {
  const parsed = {
    packageName: "",
    activityName: "",
    runs: DEFAULT_RUNS,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--package") {
      parsed.packageName = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (token === "--activity") {
      parsed.activityName = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (token === "--runs") {
      const parsedRuns = Number(argv[i + 1] ?? "");
      if (!Number.isFinite(parsedRuns) || parsedRuns <= 0) {
        throw new Error("`--runs` must be a positive number.");
      }
      parsed.runs = Math.floor(parsedRuns);
      i += 1;
    }
  }

  return parsed;
}

function usage() {
  console.error(
    "Usage: npm run benchmark:cold-start:android -- --package <android.package> --activity <activity> [--runs <n>]",
  );
}

function extractTotalTimeMs(amStartOutput) {
  const match = amStartOutput.match(/TotalTime:\s+(\d+)/);
  if (!match?.[1]) {
    throw new Error("Could not find `TotalTime` in adb output.");
  }
  return Number(match[1]);
}

function calculateP95(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return sorted[index] ?? 0;
}

function runSample(component) {
  const output = execFileSync(
    "adb",
    ["shell", "am", "start", "-S", "-W", component],
    { encoding: "utf8" },
  );
  return extractTotalTimeMs(output);
}

function main() {
  let args;
  try {
    args = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    usage();
    process.exit(1);
  }

  if (!args.packageName || !args.activityName) {
    usage();
    process.exit(1);
  }

  const component = `${args.packageName}/${args.activityName}`;
  const totalTimes = [];

  try {
    for (let i = 0; i < args.runs; i += 1) {
      const totalTimeMs = runSample(component);
      totalTimes.push(totalTimeMs);
      console.log(`run ${String(i + 1).padStart(2, "0")}/${args.runs}: ${totalTimeMs}ms`);
    }
  } catch (error) {
    console.error("Cold-start benchmark failed.");
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }

  const p95Ms = calculateP95(totalTimes);
  console.log(`cold-start p95 TotalTime: ${p95Ms}ms over ${args.runs} runs`);
  console.log(`NFR-P1 target: <= ${NFR_TARGET_MS}ms`);

  if (p95Ms > NFR_TARGET_MS) {
    process.exitCode = 2;
  }
}

main();
