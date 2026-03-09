"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHOPPER_PIN_HASH_GLOBAL_UNIQUENESS_MIGRATION_STATEMENTS = void 0;
exports.ensureShopperPinHashColumn = ensureShopperPinHashColumn;
exports.ensureShopperPinKeyColumn = ensureShopperPinKeyColumn;
exports.backfillLegacyShopperPins = backfillLegacyShopperPins;
const schema_1 = require("@/db/schema");
const password_derivation_1 = require("@/domain/services/password-derivation");
exports.SHOPPER_PIN_HASH_GLOBAL_UNIQUENESS_MIGRATION_STATEMENTS = [
    "DROP INDEX IF EXISTS idx_shopper_owner_pin_unique;",
    "DROP INDEX IF EXISTS idx_shopper_pin_hash_unique;",
    schema_1.CREATE_SHOPPER_PIN_KEY_UNIQUE_INDEX_SQL,
];
const LEGACY_PIN_PATTERN = /^\d{4,}$/;
async function ensureShopperPinHashColumn(db) {
    const columns = await db.getAllAsync(`PRAGMA table_info(${schema_1.SHOPPER_TABLE});`);
    const hasPinHash = columns.some((column) => column.name === "pin_hash");
    if (hasPinHash) {
        return;
    }
    await db.execAsync(`ALTER TABLE ${schema_1.SHOPPER_TABLE} ADD COLUMN pin_hash TEXT;`);
}
async function ensureShopperPinKeyColumn(db) {
    const columns = await db.getAllAsync(`PRAGMA table_info(${schema_1.SHOPPER_TABLE});`);
    const hasPinKey = columns.some((column) => column.name === "pin_key");
    if (hasPinKey) {
        return;
    }
    await db.execAsync(`ALTER TABLE ${schema_1.SHOPPER_TABLE} ADD COLUMN pin_key TEXT;`);
}
async function backfillLegacyShopperPins(db, deviceSaltHex) {
    const seenPinKeys = new Map();
    const rows = await db.getAllAsync(`SELECT id, pin, pin_hash, pin_key
     FROM ${schema_1.SHOPPER_TABLE}
     ORDER BY id ASC;`);
    for (const row of rows) {
        let resolvedPinKey = row.pin_key?.trim().toLowerCase() ?? null;
        const normalizedLegacyPin = row.pin?.trim() ?? null;
        if (normalizedLegacyPin == null || normalizedLegacyPin.length === 0) {
            if (row.pin != null) {
                await db.runAsync(`UPDATE ${schema_1.SHOPPER_TABLE}
           SET pin = NULL
           WHERE id = ?;`, row.id);
            }
        }
        else if (LEGACY_PIN_PATTERN.test(normalizedLegacyPin)) {
            const [derivedPinMaterial, pinKey] = await Promise.all([
                (0, password_derivation_1.deriveShopperPinCredentialMaterial)(normalizedLegacyPin, deviceSaltHex),
                (0, password_derivation_1.deriveShopperPinUniquenessKey)(normalizedLegacyPin, deviceSaltHex),
            ]);
            await db.runAsync(`UPDATE ${schema_1.SHOPPER_TABLE}
         SET pin_hash = ?, pin_key = ?, pin = NULL
         WHERE id = ?;`, derivedPinMaterial.storageValue, pinKey, row.id);
            resolvedPinKey = pinKey;
        }
        else {
            await db.runAsync(`UPDATE ${schema_1.SHOPPER_TABLE}
         SET pin = NULL
         WHERE id = ?;`, row.id);
        }
        if (!resolvedPinKey && row.pin_hash) {
            try {
                const pinKey = (0, password_derivation_1.extractHashHexFromStoredCredential)(row.pin_hash);
                await db.runAsync(`UPDATE ${schema_1.SHOPPER_TABLE}
           SET pin_key = ?
           WHERE id = ?;`, pinKey, row.id);
                resolvedPinKey = pinKey;
            }
            catch {
                // Preserve malformed payload rows as-is; service-level writes will repair over time.
            }
        }
        if (resolvedPinKey) {
            const existingShopperId = seenPinKeys.get(resolvedPinKey);
            if (typeof existingShopperId === "number" && existingShopperId !== row.id) {
                await db.runAsync(`UPDATE ${schema_1.SHOPPER_TABLE}
           SET pin_hash = NULL, pin_key = NULL, pin = NULL
           WHERE id = ?;`, row.id);
                continue;
            }
            seenPinKeys.set(resolvedPinKey, row.id);
        }
    }
}
