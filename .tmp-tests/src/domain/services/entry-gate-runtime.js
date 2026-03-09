"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_GATE_CHECK_TIMEOUT_MS = exports.GATE_TIMEOUT_ERROR_MESSAGE = exports.DEFAULT_GATE_ERROR_MESSAGE = void 0;
exports.resolveEntryRouteFromAdminCheck = resolveEntryRouteFromAdminCheck;
exports.resolveCreateMasterAdminVisibility = resolveCreateMasterAdminVisibility;
exports.resolveAdminLoginVisibility = resolveAdminLoginVisibility;
exports.invalidateEntryGateSnapshot = invalidateEntryGateSnapshot;
exports.updateEntryGateSnapshotAfterAdminChange = updateEntryGateSnapshotAfterAdminChange;
const entry_gate_1 = require("./entry-gate");
const entry_gate_snapshot_1 = require("./entry-gate-snapshot");
exports.DEFAULT_GATE_ERROR_MESSAGE = "We couldn't check local setup right now. Please retry.";
exports.GATE_TIMEOUT_ERROR_MESSAGE = "Checking local setup took too long. Please retry.";
exports.DEFAULT_GATE_CHECK_TIMEOUT_MS = 1900;
const GATE_TIMEOUT_SENTINEL = "ENTRY_GATE_TIMEOUT";
function normalizeGateError(error) {
    if (error instanceof Error && error.message === GATE_TIMEOUT_SENTINEL) {
        return exports.GATE_TIMEOUT_ERROR_MESSAGE;
    }
    return exports.DEFAULT_GATE_ERROR_MESSAGE;
}
function logGateError(error) {
    console.warn("[entry-gate] Admin check failed", error);
}
async function readHasAdminWithTimeout(readHasAdmin, timeoutMs) {
    let timeoutId;
    const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
            reject(new Error(GATE_TIMEOUT_SENTINEL));
        }, timeoutMs);
    });
    try {
        return await Promise.race([readHasAdmin(), timeoutPromise]);
    }
    finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}
async function resolveFromAdminCheck(readHasAdmin, mapWhenKnown, options) {
    if (options?.useRecentSnapshot) {
        const adminExists = (0, entry_gate_snapshot_1.readEntryGateSnapshot)(options.snapshotMaxAgeMs ?? entry_gate_snapshot_1.DEFAULT_ENTRY_GATE_SNAPSHOT_MAX_AGE_MS);
        if (adminExists !== null) {
            if (options.consumeSnapshotOnRead) {
                (0, entry_gate_snapshot_1.clearEntryGateSnapshot)();
            }
            if (options.clearSnapshotAfterSuccess) {
                (0, entry_gate_snapshot_1.clearEntryGateSnapshot)();
            }
            return {
                kind: "success",
                value: mapWhenKnown(adminExists),
                elapsedMs: 0,
            };
        }
    }
    const timeoutMs = options?.timeoutMs ?? exports.DEFAULT_GATE_CHECK_TIMEOUT_MS;
    const start = Date.now();
    try {
        const adminExists = await readHasAdminWithTimeout(readHasAdmin, timeoutMs);
        (0, entry_gate_snapshot_1.storeEntryGateSnapshot)(adminExists);
        if (options?.clearSnapshotAfterSuccess) {
            (0, entry_gate_snapshot_1.clearEntryGateSnapshot)();
        }
        return {
            kind: "success",
            value: mapWhenKnown(adminExists),
            elapsedMs: Date.now() - start,
        };
    }
    catch (error) {
        logGateError(error);
        return {
            kind: "error",
            message: normalizeGateError(error),
            elapsedMs: Date.now() - start,
        };
    }
}
function resolveEntryRouteFromAdminCheck(readHasAdmin, options) {
    return resolveFromAdminCheck(readHasAdmin, (adminExists) => (0, entry_gate_1.determineEntryRoute)(adminExists), options);
}
function resolveCreateMasterAdminVisibility(readHasAdmin, options) {
    return resolveFromAdminCheck(readHasAdmin, (adminExists) => (0, entry_gate_1.shouldExposeMasterAdminSetup)(adminExists), {
        useRecentSnapshot: true,
        consumeSnapshotOnRead: true,
        clearSnapshotAfterSuccess: true,
        ...options,
    });
}
function resolveAdminLoginVisibility(readHasAdmin, options) {
    return resolveFromAdminCheck(readHasAdmin, (adminExists) => adminExists, {
        useRecentSnapshot: true,
        consumeSnapshotOnRead: true,
        clearSnapshotAfterSuccess: true,
        ...options,
    });
}
function invalidateEntryGateSnapshot() {
    (0, entry_gate_snapshot_1.clearEntryGateSnapshot)();
}
function updateEntryGateSnapshotAfterAdminChange(adminExists) {
    (0, entry_gate_snapshot_1.clearEntryGateSnapshot)();
    (0, entry_gate_snapshot_1.storeEntryGateSnapshot)(adminExists);
}
