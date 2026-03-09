"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createShopper = createShopper;
exports.listShoppers = listShoppers;
exports.getShopperById = getShopperById;
exports.updateShopper = updateShopper;
const db_1 = require("@/db/db");
const schema_1 = require("@/db/schema");
const password_derivation_1 = require("@/domain/services/password-derivation");
const owner_scope_1 = require("@/domain/services/owner-scope");
function mapShopper(row) {
    return {
        id: row.id,
        ownerId: row.owner_id,
        name: row.name,
        createdAtMs: row.created_at_ms,
        updatedAtMs: row.updated_at_ms,
    };
}
function normalize(value) {
    return value.trim();
}
function normalizePin(pin) {
    if (pin == null) {
        return null;
    }
    const normalized = pin.trim();
    return normalized.length > 0 ? normalized : null;
}
const SHOPPER_NAME_INVALID_MESSAGE = "Shopper name is required.";
const SHOPPER_PIN_INVALID_MESSAGE = "Shopper PIN must be at least 4 digits.";
const SHOPPER_PIN_CONFLICT_MESSAGE = "A shopper with this PIN already exists on this device.";
const SHOPPER_PIN_SALT_SECRET_KEY = "shopper_pin_salt_hex";
async function findShopperById(shopperId) {
    const db = (0, db_1.getDb)();
    return db.getFirstAsync(`SELECT id, owner_id, name, created_at_ms, updated_at_ms
     FROM ${schema_1.SHOPPER_TABLE}
     WHERE id = ?
     LIMIT 1;`, shopperId);
}
async function findShopperWithLegacyPin(pin, excludeShopperId) {
    const db = (0, db_1.getDb)();
    if (typeof excludeShopperId === "number") {
        return db.getFirstAsync(`SELECT id
       FROM ${schema_1.SHOPPER_TABLE}
       WHERE pin = ?
         AND id != ?
       LIMIT 1;`, pin, excludeShopperId);
    }
    return db.getFirstAsync(`SELECT id
     FROM ${schema_1.SHOPPER_TABLE}
     WHERE pin = ?
     LIMIT 1;`, pin);
}
function validateShopperName(name) {
    if (!name) {
        return (0, owner_scope_1.invalidInputError)(SHOPPER_NAME_INVALID_MESSAGE);
    }
    return null;
}
function validatePin(pin, options) {
    if (pin == null) {
        if (options?.required) {
            return (0, owner_scope_1.invalidInputError)(SHOPPER_PIN_INVALID_MESSAGE);
        }
        return null;
    }
    if (!/^\d{4,}$/.test(pin)) {
        return (0, owner_scope_1.invalidInputError)(SHOPPER_PIN_INVALID_MESSAGE);
    }
    return null;
}
async function getDeviceShopperPinSalt() {
    const db = (0, db_1.getDb)();
    const row = await db.getFirstAsync(`SELECT value
     FROM ${schema_1.APP_SECRET_TABLE}
     WHERE key = ?
     LIMIT 1;`, SHOPPER_PIN_SALT_SECRET_KEY);
    if (!row?.value) {
        throw new Error("Device shopper PIN salt is unavailable.");
    }
    return row.value;
}
async function createShopper(input) {
    const ownerContext = (0, owner_scope_1.requireActiveOwnerContext)();
    if (!ownerContext.ok) {
        return ownerContext;
    }
    await (0, db_1.bootstrapDatabase)();
    const db = (0, db_1.getDb)();
    const nowMs = input.nowMs ?? Date.now();
    const normalizedName = normalize(input.name);
    const normalizedPin = normalizePin(input.pin);
    const nameError = validateShopperName(normalizedName);
    if (nameError) {
        return nameError;
    }
    const pinError = validatePin(normalizedPin, { required: true });
    if (pinError) {
        return pinError;
    }
    try {
        if (normalizedPin == null) {
            return (0, owner_scope_1.invalidInputError)(SHOPPER_PIN_INVALID_MESSAGE);
        }
        const deviceSalt = await getDeviceShopperPinSalt();
        const [derivedPinMaterial, pinKey] = await Promise.all([
            (0, password_derivation_1.deriveShopperPinCredentialMaterial)(normalizedPin, deviceSalt),
            (0, password_derivation_1.deriveShopperPinUniquenessKey)(normalizedPin, deviceSalt),
        ]);
        const conflictingLegacyPin = await findShopperWithLegacyPin(normalizedPin);
        if (conflictingLegacyPin) {
            return (0, owner_scope_1.conflictError)(SHOPPER_PIN_CONFLICT_MESSAGE);
        }
        const insertResult = await db.runAsync(`INSERT INTO ${schema_1.SHOPPER_TABLE} (
         owner_id, name, pin_hash, pin_key, pin, created_at_ms, updated_at_ms
      ) VALUES (?, ?, ?, ?, NULL, ?, ?);`, ownerContext.value.id, normalizedName, derivedPinMaterial?.storageValue ?? null, pinKey, nowMs, nowMs);
        const created = await findShopperById(Number(insertResult.lastInsertRowId));
        if (!created) {
            return {
                ok: false,
                error: {
                    code: "OWNER_SCOPE_UNAVAILABLE",
                    message: owner_scope_1.OWNER_SCOPE_UNAVAILABLE_MESSAGE,
                },
            };
        }
        return { ok: true, value: mapShopper(created) };
    }
    catch (error) {
        if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
            return (0, owner_scope_1.conflictError)(SHOPPER_PIN_CONFLICT_MESSAGE);
        }
        console.warn("[shopper-service] createShopper failed", {
            reason: (0, owner_scope_1.getSafeErrorReason)(error),
        });
        return {
            ok: false,
            error: {
                code: "OWNER_SCOPE_UNAVAILABLE",
                message: owner_scope_1.OWNER_SCOPE_UNAVAILABLE_MESSAGE,
            },
        };
    }
}
async function listShoppers() {
    const ownerContext = (0, owner_scope_1.requireActiveOwnerContext)();
    if (!ownerContext.ok) {
        return ownerContext;
    }
    await (0, db_1.bootstrapDatabase)();
    const db = (0, db_1.getDb)();
    try {
        const rows = await db.getAllAsync(`SELECT id, owner_id, name, created_at_ms, updated_at_ms
       FROM ${schema_1.SHOPPER_TABLE}
       WHERE owner_id = ?
       ORDER BY created_at_ms DESC, id DESC;`, ownerContext.value.id);
        return { ok: true, value: rows.map(mapShopper) };
    }
    catch (error) {
        console.warn("[shopper-service] listShoppers failed", {
            reason: (0, owner_scope_1.getSafeErrorReason)(error),
        });
        return {
            ok: false,
            error: {
                code: "OWNER_SCOPE_UNAVAILABLE",
                message: owner_scope_1.OWNER_SCOPE_UNAVAILABLE_MESSAGE,
            },
        };
    }
}
async function getShopperById(shopperId) {
    const ownerContext = (0, owner_scope_1.requireActiveOwnerContext)();
    if (!ownerContext.ok) {
        return ownerContext;
    }
    await (0, db_1.bootstrapDatabase)();
    try {
        const row = await findShopperById(shopperId);
        if (!row) {
            return {
                ok: false,
                error: {
                    code: "OWNER_SCOPE_NOT_FOUND",
                    message: owner_scope_1.OWNER_SCOPE_NOT_FOUND_MESSAGE,
                },
            };
        }
        if (row.owner_id !== ownerContext.value.id) {
            return {
                ok: false,
                error: {
                    code: "OWNER_SCOPE_MISMATCH",
                    message: owner_scope_1.OWNER_SCOPE_MISMATCH_MESSAGE,
                },
            };
        }
        return { ok: true, value: mapShopper(row) };
    }
    catch (error) {
        console.warn("[shopper-service] getShopperById failed", {
            reason: (0, owner_scope_1.getSafeErrorReason)(error),
        });
        return {
            ok: false,
            error: {
                code: "OWNER_SCOPE_UNAVAILABLE",
                message: owner_scope_1.OWNER_SCOPE_UNAVAILABLE_MESSAGE,
            },
        };
    }
}
async function updateShopper(input) {
    const ownerContext = (0, owner_scope_1.requireActiveOwnerContext)();
    if (!ownerContext.ok) {
        return ownerContext;
    }
    await (0, db_1.bootstrapDatabase)();
    const db = (0, db_1.getDb)();
    const existing = await findShopperById(input.shopperId);
    const normalizedName = normalize(input.name);
    const shouldUpdatePin = Object.prototype.hasOwnProperty.call(input, "pin");
    const normalizedPin = shouldUpdatePin ? normalizePin(input.pin) : undefined;
    const nameError = validateShopperName(normalizedName);
    if (nameError) {
        return nameError;
    }
    if (shouldUpdatePin) {
        const pinError = validatePin(normalizedPin ?? null, { required: true });
        if (pinError) {
            return pinError;
        }
    }
    if (!existing) {
        return {
            ok: false,
            error: {
                code: "OWNER_SCOPE_NOT_FOUND",
                message: owner_scope_1.OWNER_SCOPE_NOT_FOUND_MESSAGE,
            },
        };
    }
    if (existing.owner_id !== ownerContext.value.id) {
        return {
            ok: false,
            error: {
                code: "OWNER_SCOPE_MISMATCH",
                message: owner_scope_1.OWNER_SCOPE_MISMATCH_MESSAGE,
            },
        };
    }
    try {
        if (normalizedPin != null) {
            const conflictingLegacyPin = await findShopperWithLegacyPin(normalizedPin, input.shopperId);
            if (conflictingLegacyPin) {
                return (0, owner_scope_1.conflictError)(SHOPPER_PIN_CONFLICT_MESSAGE);
            }
        }
        if (shouldUpdatePin) {
            const deviceSalt = await getDeviceShopperPinSalt();
            if (normalizedPin == null) {
                return (0, owner_scope_1.invalidInputError)(SHOPPER_PIN_INVALID_MESSAGE);
            }
            const [derivedPinMaterial, pinKey] = await Promise.all([
                (0, password_derivation_1.deriveShopperPinCredentialMaterial)(normalizedPin, deviceSalt),
                (0, password_derivation_1.deriveShopperPinUniquenessKey)(normalizedPin, deviceSalt),
            ]);
            await db.runAsync(`UPDATE ${schema_1.SHOPPER_TABLE}
         SET name = ?, pin_hash = ?, pin_key = ?, pin = NULL, updated_at_ms = ?
         WHERE id = ? AND owner_id = ?;`, normalizedName, derivedPinMaterial?.storageValue ?? null, pinKey, input.nowMs ?? Date.now(), input.shopperId, ownerContext.value.id);
        }
        else {
            await db.runAsync(`UPDATE ${schema_1.SHOPPER_TABLE}
         SET name = ?, updated_at_ms = ?
         WHERE id = ? AND owner_id = ?;`, normalizedName, input.nowMs ?? Date.now(), input.shopperId, ownerContext.value.id);
        }
        const updated = await findShopperById(input.shopperId);
        if (!updated) {
            return {
                ok: false,
                error: {
                    code: "OWNER_SCOPE_NOT_FOUND",
                    message: owner_scope_1.OWNER_SCOPE_NOT_FOUND_MESSAGE,
                },
            };
        }
        return { ok: true, value: mapShopper(updated) };
    }
    catch (error) {
        if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
            return (0, owner_scope_1.conflictError)(SHOPPER_PIN_CONFLICT_MESSAGE);
        }
        console.warn("[shopper-service] updateShopper failed", {
            reason: (0, owner_scope_1.getSafeErrorReason)(error),
        });
        return {
            ok: false,
            error: {
                code: "OWNER_SCOPE_UNAVAILABLE",
                message: owner_scope_1.OWNER_SCOPE_UNAVAILABLE_MESSAGE,
            },
        };
    }
}
