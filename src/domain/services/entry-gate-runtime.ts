import {
  type EntryRoute,
  determineEntryRoute,
  shouldExposeMasterAdminSetup,
} from "./entry-gate";
import {
  clearEntryGateSnapshot,
  DEFAULT_ENTRY_GATE_SNAPSHOT_MAX_AGE_MS,
  readEntryGateSnapshot,
  storeEntryGateSnapshot,
} from "./entry-gate-snapshot";

export const DEFAULT_GATE_ERROR_MESSAGE =
  "We couldn't check local setup right now. Please retry.";
export const GATE_TIMEOUT_ERROR_MESSAGE =
  "Checking local setup took too long. Please retry.";
export const DEFAULT_GATE_CHECK_TIMEOUT_MS = 1900;

export type GateResolutionSuccess<T> = {
  kind: "success";
  value: T;
  elapsedMs: number;
};

export type GateResolutionError = {
  kind: "error";
  message: string;
  elapsedMs: number;
};

export type GateResolution<T> = GateResolutionSuccess<T> | GateResolutionError;

type AdminCheck = () => Promise<boolean>;
type GateResolutionOptions = {
  timeoutMs?: number;
  useRecentSnapshot?: boolean;
  snapshotMaxAgeMs?: number;
  consumeSnapshotOnRead?: boolean;
  clearSnapshotAfterSuccess?: boolean;
};

const GATE_TIMEOUT_SENTINEL = "ENTRY_GATE_TIMEOUT";

function normalizeGateError(error: unknown): string {
  if (error instanceof Error && error.message === GATE_TIMEOUT_SENTINEL) {
    return GATE_TIMEOUT_ERROR_MESSAGE;
  }
  return DEFAULT_GATE_ERROR_MESSAGE;
}

function logGateError(error: unknown) {
  console.warn("[entry-gate] Admin check failed", error);
}

async function readHasAdminWithTimeout(
  readHasAdmin: AdminCheck,
  timeoutMs: number,
): Promise<boolean> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<boolean>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(GATE_TIMEOUT_SENTINEL));
    }, timeoutMs);
  });

  try {
    return await Promise.race([readHasAdmin(), timeoutPromise]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

async function resolveFromAdminCheck<T>(
  readHasAdmin: AdminCheck,
  mapWhenKnown: (adminExists: boolean) => T,
  options?: GateResolutionOptions,
): Promise<GateResolution<T>> {
  if (options?.useRecentSnapshot) {
    const adminExists = readEntryGateSnapshot(
      options.snapshotMaxAgeMs ?? DEFAULT_ENTRY_GATE_SNAPSHOT_MAX_AGE_MS,
    );
    if (adminExists !== null) {
      if (options.consumeSnapshotOnRead) {
        clearEntryGateSnapshot();
      }
      if (options.clearSnapshotAfterSuccess) {
        clearEntryGateSnapshot();
      }
      return {
        kind: "success",
        value: mapWhenKnown(adminExists),
        elapsedMs: 0,
      };
    }
  }

  const timeoutMs = options?.timeoutMs ?? DEFAULT_GATE_CHECK_TIMEOUT_MS;
  const start = Date.now();
  try {
    const adminExists = await readHasAdminWithTimeout(readHasAdmin, timeoutMs);
    storeEntryGateSnapshot(adminExists);
    if (options?.clearSnapshotAfterSuccess) {
      clearEntryGateSnapshot();
    }
    return {
      kind: "success",
      value: mapWhenKnown(adminExists),
      elapsedMs: Date.now() - start,
    };
  } catch (error) {
    logGateError(error);
    return {
      kind: "error",
      message: normalizeGateError(error),
      elapsedMs: Date.now() - start,
    };
  }
}

export function resolveEntryRouteFromAdminCheck(
  readHasAdmin: AdminCheck,
  options?: GateResolutionOptions,
): Promise<GateResolution<EntryRoute>> {
  return resolveFromAdminCheck(
    readHasAdmin,
    (adminExists) => determineEntryRoute(adminExists),
    options,
  );
}

export function resolveCreateMasterAdminVisibility(
  readHasAdmin: AdminCheck,
  options?: GateResolutionOptions,
): Promise<GateResolution<boolean>> {
  return resolveFromAdminCheck(
    readHasAdmin,
    (adminExists) => shouldExposeMasterAdminSetup(adminExists),
    {
      useRecentSnapshot: true,
      consumeSnapshotOnRead: true,
      clearSnapshotAfterSuccess: true,
      ...options,
    },
  );
}

export function resolveAdminLoginVisibility(
  readHasAdmin: AdminCheck,
  options?: GateResolutionOptions,
): Promise<GateResolution<boolean>> {
  return resolveFromAdminCheck(readHasAdmin, (adminExists) => adminExists, {
    useRecentSnapshot: true,
    consumeSnapshotOnRead: true,
    clearSnapshotAfterSuccess: true,
    ...options,
  });
}

export function invalidateEntryGateSnapshot() {
  clearEntryGateSnapshot();
}

export function updateEntryGateSnapshotAfterAdminChange(adminExists: boolean) {
  clearEntryGateSnapshot();
  storeEntryGateSnapshot(adminExists);
}
