export const DEFAULT_ENTRY_GATE_SNAPSHOT_MAX_AGE_MS = 2500;

let latestAdminExistenceSnapshot:
  | {
      adminExists: boolean;
      capturedAtMs: number;
    }
  | null = null;

export function storeEntryGateSnapshot(
  adminExists: boolean,
  capturedAtMs = Date.now(),
) {
  latestAdminExistenceSnapshot = {
    adminExists,
    capturedAtMs,
  };
}

export function readEntryGateSnapshot(maxAgeMs = DEFAULT_ENTRY_GATE_SNAPSHOT_MAX_AGE_MS) {
  if (!latestAdminExistenceSnapshot) {
    return null;
  }

  const snapshotAgeMs = Date.now() - latestAdminExistenceSnapshot.capturedAtMs;
  if (snapshotAgeMs > maxAgeMs) {
    return null;
  }

  return latestAdminExistenceSnapshot.adminExists;
}

export function clearEntryGateSnapshot() {
  latestAdminExistenceSnapshot = null;
}
