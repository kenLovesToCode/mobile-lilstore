"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.recordPurchase = recordPurchase;
exports.recordPayment = recordPayment;
exports.listPurchases = listPurchases;
exports.listPayments = listPayments;
exports.listLedgerHistory = listLedgerHistory;
const db_1 = require("@/db/db");
const schema_1 = require("@/db/schema");
const owner_scope_1 = require("@/domain/services/owner-scope");
const LEDGER_PURCHASE_INVALID_MESSAGE = "Purchase total must be a positive integer amount.";
const LEDGER_PAYMENT_INVALID_MESSAGE = "Payment amount must be a positive integer amount.";
function mapPurchase(row) {
    return {
        id: row.id,
        ownerId: row.owner_id,
        shopperId: row.shopper_id,
        totalCents: row.total_cents,
        createdAtMs: row.created_at_ms,
    };
}
function mapPayment(row) {
    return {
        id: row.id,
        ownerId: row.owner_id,
        shopperId: row.shopper_id,
        amountCents: row.amount_cents,
        createdAtMs: row.created_at_ms,
    };
}
async function findShopperOwner(shopperId) {
    const db = (0, db_1.getDb)();
    return db.getFirstAsync(`SELECT owner_id FROM ${schema_1.SHOPPER_TABLE} WHERE id = ? LIMIT 1;`, shopperId);
}
function validatePositiveMoney(value, message) {
    if (!Number.isInteger(value) || value <= 0) {
        return (0, owner_scope_1.invalidInputError)(message);
    }
    return null;
}
async function recordPurchase(input) {
    const ownerContext = (0, owner_scope_1.requireActiveOwnerContext)();
    if (!ownerContext.ok) {
        return ownerContext;
    }
    await (0, db_1.bootstrapDatabase)();
    const db = (0, db_1.getDb)();
    const invalidAmount = validatePositiveMoney(input.totalCents, LEDGER_PURCHASE_INVALID_MESSAGE);
    if (invalidAmount) {
        return invalidAmount;
    }
    const shopperOwner = await findShopperOwner(input.shopperId);
    if (!shopperOwner) {
        return {
            ok: false,
            error: {
                code: "OWNER_SCOPE_NOT_FOUND",
                message: owner_scope_1.OWNER_SCOPE_NOT_FOUND_MESSAGE,
            },
        };
    }
    if (shopperOwner.owner_id !== ownerContext.value.id) {
        return {
            ok: false,
            error: {
                code: "OWNER_SCOPE_MISMATCH",
                message: owner_scope_1.OWNER_SCOPE_MISMATCH_MESSAGE,
            },
        };
    }
    try {
        const nowMs = input.nowMs ?? Date.now();
        const insertResult = await db.runAsync(`INSERT INTO ${schema_1.PURCHASE_TABLE} (
         owner_id, shopper_id, total_cents, created_at_ms
       ) VALUES (?, ?, ?, ?);`, ownerContext.value.id, input.shopperId, input.totalCents, nowMs);
        const created = await db.getFirstAsync(`SELECT id, owner_id, shopper_id, total_cents, created_at_ms
       FROM ${schema_1.PURCHASE_TABLE}
       WHERE id = ?
       LIMIT 1;`, Number(insertResult.lastInsertRowId));
        if (!created) {
            return {
                ok: false,
                error: {
                    code: "OWNER_SCOPE_UNAVAILABLE",
                    message: owner_scope_1.OWNER_SCOPE_UNAVAILABLE_MESSAGE,
                },
            };
        }
        return { ok: true, value: mapPurchase(created) };
    }
    catch (error) {
        console.warn("[ledger-service] recordPurchase failed", {
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
async function recordPayment(input) {
    const ownerContext = (0, owner_scope_1.requireActiveOwnerContext)();
    if (!ownerContext.ok) {
        return ownerContext;
    }
    await (0, db_1.bootstrapDatabase)();
    const db = (0, db_1.getDb)();
    const invalidAmount = validatePositiveMoney(input.amountCents, LEDGER_PAYMENT_INVALID_MESSAGE);
    if (invalidAmount) {
        return invalidAmount;
    }
    const shopperOwner = await findShopperOwner(input.shopperId);
    if (!shopperOwner) {
        return {
            ok: false,
            error: {
                code: "OWNER_SCOPE_NOT_FOUND",
                message: owner_scope_1.OWNER_SCOPE_NOT_FOUND_MESSAGE,
            },
        };
    }
    if (shopperOwner.owner_id !== ownerContext.value.id) {
        return {
            ok: false,
            error: {
                code: "OWNER_SCOPE_MISMATCH",
                message: owner_scope_1.OWNER_SCOPE_MISMATCH_MESSAGE,
            },
        };
    }
    try {
        const nowMs = input.nowMs ?? Date.now();
        const insertResult = await db.runAsync(`INSERT INTO ${schema_1.PAYMENT_TABLE} (
         owner_id, shopper_id, amount_cents, created_at_ms
       ) VALUES (?, ?, ?, ?);`, ownerContext.value.id, input.shopperId, input.amountCents, nowMs);
        const created = await db.getFirstAsync(`SELECT id, owner_id, shopper_id, amount_cents, created_at_ms
       FROM ${schema_1.PAYMENT_TABLE}
       WHERE id = ?
       LIMIT 1;`, Number(insertResult.lastInsertRowId));
        if (!created) {
            return {
                ok: false,
                error: {
                    code: "OWNER_SCOPE_UNAVAILABLE",
                    message: owner_scope_1.OWNER_SCOPE_UNAVAILABLE_MESSAGE,
                },
            };
        }
        return { ok: true, value: mapPayment(created) };
    }
    catch (error) {
        console.warn("[ledger-service] recordPayment failed", {
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
async function listPurchases() {
    const ownerContext = (0, owner_scope_1.requireActiveOwnerContext)();
    if (!ownerContext.ok) {
        return ownerContext;
    }
    await (0, db_1.bootstrapDatabase)();
    const db = (0, db_1.getDb)();
    try {
        const rows = await db.getAllAsync(`SELECT id, owner_id, shopper_id, total_cents, created_at_ms
       FROM ${schema_1.PURCHASE_TABLE}
       WHERE owner_id = ?
       ORDER BY created_at_ms DESC, id DESC;`, ownerContext.value.id);
        return { ok: true, value: rows.map(mapPurchase) };
    }
    catch (error) {
        console.warn("[ledger-service] listPurchases failed", {
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
async function listPayments() {
    const ownerContext = (0, owner_scope_1.requireActiveOwnerContext)();
    if (!ownerContext.ok) {
        return ownerContext;
    }
    await (0, db_1.bootstrapDatabase)();
    const db = (0, db_1.getDb)();
    try {
        const rows = await db.getAllAsync(`SELECT id, owner_id, shopper_id, amount_cents, created_at_ms
       FROM ${schema_1.PAYMENT_TABLE}
       WHERE owner_id = ?
       ORDER BY created_at_ms DESC, id DESC;`, ownerContext.value.id);
        return { ok: true, value: rows.map(mapPayment) };
    }
    catch (error) {
        console.warn("[ledger-service] listPayments failed", {
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
async function listLedgerHistory() {
    const ownerContext = (0, owner_scope_1.requireActiveOwnerContext)();
    if (!ownerContext.ok) {
        return ownerContext;
    }
    await (0, db_1.bootstrapDatabase)();
    const db = (0, db_1.getDb)();
    try {
        const rows = await db.getAllAsync(`SELECT kind, id, shopper_id, amount_cents, created_at_ms
       FROM (
         SELECT 'purchase' AS kind, id, shopper_id, total_cents AS amount_cents, created_at_ms
         FROM ${schema_1.PURCHASE_TABLE}
         WHERE owner_id = ?
         UNION ALL
         SELECT 'payment' AS kind, id, shopper_id, amount_cents, created_at_ms
         FROM ${schema_1.PAYMENT_TABLE}
         WHERE owner_id = ?
       )
       ORDER BY created_at_ms DESC, id DESC;`, ownerContext.value.id, ownerContext.value.id);
        return {
            ok: true,
            value: rows.map((row) => ({
                kind: row.kind,
                id: row.id,
                shopperId: row.shopper_id,
                amountCents: row.amount_cents,
                createdAtMs: row.created_at_ms,
            })),
        };
    }
    catch (error) {
        console.warn("[ledger-service] listLedgerHistory failed", {
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
