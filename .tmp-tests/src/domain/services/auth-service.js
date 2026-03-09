"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeAdminUsername = normalizeAdminUsername;
exports.getAdminCount = getAdminCount;
exports.hasAnyAdmin = hasAnyAdmin;
exports.createInitialMasterAdmin = createInitialMasterAdmin;
exports.authenticateAdmin = authenticateAdmin;
const db_1 = require("@/db/db");
const schema_1 = require("@/db/schema");
const entry_gate_runtime_1 = require("@/domain/services/entry-gate-runtime");
const password_derivation_1 = require("@/domain/services/password-derivation");
const DEFAULT_CREATE_ADMIN_ERROR_MESSAGE = "We couldn't create the admin account right now. Please retry.";
const ADMIN_ALREADY_EXISTS_MESSAGE = "Admin setup is already complete. Please sign in.";
const INVALID_ADMIN_CREDENTIALS_MESSAGE = "Invalid username or password.";
const DEFAULT_AUTHENTICATE_ADMIN_ERROR_MESSAGE = "We couldn't sign you in right now. Please retry.";
const STORED_CREDENTIAL_VALIDATION_ERRORS = new Set([
    "Invalid stored credential format.",
    "Unsupported scrypt parameters.",
    "Invalid hex value in stored credential.",
    "Stored credential hash length does not match parameters.",
]);
const AUTH_COST_PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
let authCostProfilesCache = null;
function normalizeAdminUsername(username) {
    return username.trim().toLowerCase();
}
function getSafeErrorReason(error) {
    if (error instanceof Error && error.name) {
        return error.name;
    }
    return "UnknownError";
}
function isStoredCredentialValidationError(error) {
    if (!(error instanceof Error)) {
        return false;
    }
    return STORED_CREDENTIAL_VALIDATION_ERRORS.has(error.message);
}
function clearAuthCostProfilesCache() {
    authCostProfilesCache = null;
}
function getDefaultScryptParams() {
    return {
        N: password_derivation_1.DEFAULT_SCRYPT_PARAMS.N,
        r: password_derivation_1.DEFAULT_SCRYPT_PARAMS.r,
        p: password_derivation_1.DEFAULT_SCRYPT_PARAMS.p,
        dkLen: password_derivation_1.DEFAULT_SCRYPT_PARAMS.dkLen,
    };
}
function getScryptParamsKey(params) {
    return `${params.N}:${params.r}:${params.p}:${params.dkLen}`;
}
function createDummyScryptCredential(params) {
    return (0, password_derivation_1.serializeDerivedPasswordCredential)({
        algorithm: "scrypt",
        params,
        saltHex: "00".repeat(password_derivation_1.DEFAULT_SCRYPT_PARAMS.saltLen),
        hashHex: "00".repeat(params.dkLen),
    });
}
function parseStoredScryptParams(storageValue) {
    const match = /^scrypt\$N=(\d+)\$r=(\d+)\$p=(\d+)\$dkLen=(\d+)\$/.exec(storageValue);
    if (!match) {
        return null;
    }
    return {
        N: Number.parseInt(match[1], 10),
        r: Number.parseInt(match[2], 10),
        p: Number.parseInt(match[3], 10),
        dkLen: Number.parseInt(match[4], 10),
    };
}
function estimateScryptCost(params) {
    return {
        cpuCost: params.N * params.r * params.p,
        memoryCost: params.N * params.r,
        dkLen: params.dkLen,
    };
}
function canSafelyRefreshCredential(current, next) {
    const currentCost = estimateScryptCost(current);
    const nextCost = estimateScryptCost(next);
    return (nextCost.cpuCost >= currentCost.cpuCost &&
        nextCost.memoryCost >= currentCost.memoryCost &&
        nextCost.dkLen >= currentCost.dkLen);
}
function shouldRefreshStoredCredential(storageValue) {
    const currentParams = parseStoredScryptParams(storageValue);
    if (!currentParams) {
        return false;
    }
    const nextParams = getDefaultScryptParams();
    const hasParamDiff = currentParams.N !== nextParams.N ||
        currentParams.r !== nextParams.r ||
        currentParams.p !== nextParams.p ||
        currentParams.dkLen !== nextParams.dkLen;
    if (!hasParamDiff) {
        return false;
    }
    return canSafelyRefreshCredential(currentParams, nextParams);
}
function getAuthCostProfiles(passwordHashes) {
    const profiles = new Map();
    const defaultParams = getDefaultScryptParams();
    profiles.set(getScryptParamsKey(defaultParams), defaultParams);
    for (const passwordHash of passwordHashes) {
        const params = parseStoredScryptParams(passwordHash);
        if (!params) {
            continue;
        }
        profiles.set(getScryptParamsKey(params), params);
    }
    return Array.from(profiles.values());
}
async function getAuthCostProfilesForMissingUser(db) {
    const nowMs = Date.now();
    if (authCostProfilesCache &&
        nowMs - authCostProfilesCache.loadedAtMs < AUTH_COST_PROFILE_CACHE_TTL_MS) {
        return authCostProfilesCache.profiles;
    }
    const authCostRows = await db.getAllAsync(`SELECT password_hash FROM ${schema_1.ADMIN_TABLE};`);
    const profiles = getAuthCostProfiles(authCostRows.map((row) => row.password_hash));
    authCostProfilesCache = {
        loadedAtMs: nowMs,
        profiles,
    };
    return profiles;
}
async function runDummyAuthCostChecks(password, profiles, skipProfileKeys) {
    for (const profile of profiles) {
        const profileKey = getScryptParamsKey(profile);
        if (skipProfileKeys.has(profileKey)) {
            continue;
        }
        try {
            await (0, password_derivation_1.verifyPasswordCredentialMaterial)(password, createDummyScryptCredential(profile));
        }
        catch {
            // Intentionally ignore parse/verify failures for timing equalization checks.
        }
    }
}
async function refreshAdminCredentialMaterial(adminId, password) {
    try {
        const nextCredential = await (0, password_derivation_1.derivePasswordCredentialMaterial)(password);
        const db = (0, db_1.getDb)();
        await db.runAsync(`UPDATE ${schema_1.ADMIN_TABLE}
       SET password_hash = ?, updated_at_ms = ?
       WHERE id = ?;`, nextCredential.storageValue, Date.now(), adminId);
        clearAuthCostProfilesCache();
    }
    catch (error) {
        console.warn("[auth-service] authenticateAdmin credential refresh skipped", {
            reason: getSafeErrorReason(error),
        });
    }
}
async function getAdminCount() {
    await (0, db_1.bootstrapDatabase)();
    const db = (0, db_1.getDb)();
    const row = await db.getFirstAsync(`SELECT COUNT(*) as admin_count FROM ${schema_1.ADMIN_TABLE};`);
    return row?.admin_count ?? 0;
}
async function hasAnyAdmin() {
    const adminCount = await getAdminCount();
    return adminCount >= 1;
}
async function createInitialMasterAdmin(input) {
    const normalizedUsername = normalizeAdminUsername(input.username);
    if (!normalizedUsername || !input.password) {
        return {
            kind: "error",
            message: DEFAULT_CREATE_ADMIN_ERROR_MESSAGE,
        };
    }
    const createdAtMs = input.nowMs ?? Date.now();
    await (0, db_1.bootstrapDatabase)();
    const db = (0, db_1.getDb)();
    try {
        const precheckRow = await db.getFirstAsync(`SELECT COUNT(*) as admin_count FROM ${schema_1.ADMIN_TABLE};`);
        if ((precheckRow?.admin_count ?? 0) > 0) {
            (0, entry_gate_runtime_1.updateEntryGateSnapshotAfterAdminChange)(true);
            return {
                kind: "already-exists",
                message: ADMIN_ALREADY_EXISTS_MESSAGE,
            };
        }
        const credential = await (0, password_derivation_1.derivePasswordCredentialMaterial)(input.password);
        let adminWasCreated = false;
        await db.withExclusiveTransactionAsync(async (txn) => {
            const insertResult = await txn.runAsync(`INSERT INTO ${schema_1.ADMIN_TABLE} (username, password_hash, created_at_ms, updated_at_ms)
         SELECT ?, ?, ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM ${schema_1.ADMIN_TABLE} LIMIT 1);`, normalizedUsername, credential.storageValue, createdAtMs, createdAtMs);
            adminWasCreated = insertResult.changes > 0;
        });
        if (!adminWasCreated) {
            (0, entry_gate_runtime_1.updateEntryGateSnapshotAfterAdminChange)(true);
            return {
                kind: "already-exists",
                message: ADMIN_ALREADY_EXISTS_MESSAGE,
            };
        }
        if (adminWasCreated) {
            clearAuthCostProfilesCache();
            (0, entry_gate_runtime_1.updateEntryGateSnapshotAfterAdminChange)(true);
            return {
                kind: "success",
                username: normalizedUsername,
                createdAtMs,
            };
        }
        return {
            kind: "error",
            message: DEFAULT_CREATE_ADMIN_ERROR_MESSAGE,
        };
    }
    catch (error) {
        console.warn("[auth-service] createInitialMasterAdmin failed", {
            reason: getSafeErrorReason(error),
        });
        return {
            kind: "error",
            message: DEFAULT_CREATE_ADMIN_ERROR_MESSAGE,
        };
    }
}
async function authenticateAdmin(input) {
    const normalizedUsername = normalizeAdminUsername(input.username);
    if (!normalizedUsername || !input.password) {
        return {
            kind: "invalid-credentials",
            message: INVALID_ADMIN_CREDENTIALS_MESSAGE,
        };
    }
    await (0, db_1.bootstrapDatabase)();
    const db = (0, db_1.getDb)();
    try {
        const adminRow = await db.getFirstAsync(`SELECT id, username, password_hash
       FROM ${schema_1.ADMIN_TABLE}
       WHERE username = ?
       LIMIT 1;`, normalizedUsername);
        if (!adminRow) {
            const authCostProfiles = await getAuthCostProfilesForMissingUser(db);
            await runDummyAuthCostChecks(input.password, authCostProfiles, new Set());
            return {
                kind: "invalid-credentials",
                message: INVALID_ADMIN_CREDENTIALS_MESSAGE,
            };
        }
        let isValidPassword = false;
        let credentialVerificationFailure = "none";
        try {
            isValidPassword = await (0, password_derivation_1.verifyPasswordCredentialMaterial)(input.password, adminRow.password_hash);
        }
        catch (error) {
            credentialVerificationFailure = isStoredCredentialValidationError(error)
                ? "invalid-material"
                : "runtime";
            console.warn("[auth-service] authenticateAdmin failed", {
                reason: credentialVerificationFailure === "invalid-material"
                    ? "CredentialVerificationError"
                    : "CredentialVerificationRuntimeError",
            });
        }
        if (credentialVerificationFailure === "invalid-material") {
            return {
                kind: "invalid-credentials",
                message: INVALID_ADMIN_CREDENTIALS_MESSAGE,
            };
        }
        if (credentialVerificationFailure === "runtime") {
            return {
                kind: "error",
                message: DEFAULT_AUTHENTICATE_ADMIN_ERROR_MESSAGE,
            };
        }
        if (!isValidPassword) {
            return {
                kind: "invalid-credentials",
                message: INVALID_ADMIN_CREDENTIALS_MESSAGE,
            };
        }
        if (shouldRefreshStoredCredential(adminRow.password_hash)) {
            void refreshAdminCredentialMaterial(adminRow.id, input.password);
        }
        return {
            kind: "success",
            admin: {
                id: adminRow.id,
                username: adminRow.username,
            },
        };
    }
    catch (error) {
        console.warn("[auth-service] authenticateAdmin failed", {
            reason: getSafeErrorReason(error),
        });
        return {
            kind: "error",
            message: DEFAULT_AUTHENTICATE_ADMIN_ERROR_MESSAGE,
        };
    }
}
