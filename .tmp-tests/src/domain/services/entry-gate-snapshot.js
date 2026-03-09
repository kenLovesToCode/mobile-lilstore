"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_ENTRY_GATE_SNAPSHOT_MAX_AGE_MS = void 0;
exports.storeEntryGateSnapshot = storeEntryGateSnapshot;
exports.readEntryGateSnapshot = readEntryGateSnapshot;
exports.clearEntryGateSnapshot = clearEntryGateSnapshot;
exports.DEFAULT_ENTRY_GATE_SNAPSHOT_MAX_AGE_MS = 2500;
let latestAdminExistenceSnapshot = null;
function storeEntryGateSnapshot(adminExists, capturedAtMs = Date.now()) {
    latestAdminExistenceSnapshot = {
        adminExists,
        capturedAtMs,
    };
}
function readEntryGateSnapshot(maxAgeMs = exports.DEFAULT_ENTRY_GATE_SNAPSHOT_MAX_AGE_MS) {
    if (!latestAdminExistenceSnapshot) {
        return null;
    }
    const snapshotAgeMs = Date.now() - latestAdminExistenceSnapshot.capturedAtMs;
    if (snapshotAgeMs > maxAgeMs) {
        return null;
    }
    return latestAdminExistenceSnapshot.adminExists;
}
function clearEntryGateSnapshot() {
    latestAdminExistenceSnapshot = null;
}
