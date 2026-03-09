"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addShoppingListItem = addShoppingListItem;
exports.listShoppingListItems = listShoppingListItems;
exports.updateShoppingListItem = updateShoppingListItem;
const db_1 = require("@/db/db");
const schema_1 = require("@/db/schema");
const owner_scope_1 = require("@/domain/services/owner-scope");
const SHOPPING_LIST_INPUT_INVALID_MESSAGE = "Quantity must be a positive integer and unit price must be a non-negative integer.";
function mapItem(row) {
    return {
        id: row.id,
        ownerId: row.owner_id,
        productId: row.product_id,
        quantity: row.quantity,
        unitPriceCents: row.unit_price_cents,
        createdAtMs: row.created_at_ms,
        updatedAtMs: row.updated_at_ms,
    };
}
async function findProductOwner(productId) {
    const db = (0, db_1.getDb)();
    return db.getFirstAsync(`SELECT owner_id FROM ${schema_1.PRODUCT_TABLE} WHERE id = ? LIMIT 1;`, productId);
}
async function findItem(itemId) {
    const db = (0, db_1.getDb)();
    return db.getFirstAsync(`SELECT id, owner_id, product_id, quantity, unit_price_cents, created_at_ms, updated_at_ms
     FROM ${schema_1.SHOPPING_LIST_ITEM_TABLE}
     WHERE id = ?
     LIMIT 1;`, itemId);
}
function validatePricing(quantity, unitPriceCents) {
    if (!Number.isInteger(quantity) ||
        quantity <= 0 ||
        !Number.isInteger(unitPriceCents) ||
        unitPriceCents < 0) {
        return (0, owner_scope_1.invalidInputError)(SHOPPING_LIST_INPUT_INVALID_MESSAGE);
    }
    return null;
}
async function addShoppingListItem(input) {
    const ownerContext = (0, owner_scope_1.requireActiveOwnerContext)();
    if (!ownerContext.ok) {
        return ownerContext;
    }
    await (0, db_1.bootstrapDatabase)();
    const db = (0, db_1.getDb)();
    const invalidPricing = validatePricing(input.quantity, input.unitPriceCents);
    if (invalidPricing) {
        return invalidPricing;
    }
    const productOwner = await findProductOwner(input.productId);
    if (!productOwner) {
        return {
            ok: false,
            error: {
                code: "OWNER_SCOPE_NOT_FOUND",
                message: owner_scope_1.OWNER_SCOPE_NOT_FOUND_MESSAGE,
            },
        };
    }
    if (productOwner.owner_id !== ownerContext.value.id) {
        return {
            ok: false,
            error: {
                code: "OWNER_SCOPE_MISMATCH",
                message: owner_scope_1.OWNER_SCOPE_MISMATCH_MESSAGE,
            },
        };
    }
    const nowMs = input.nowMs ?? Date.now();
    try {
        const insertResult = await db.runAsync(`INSERT INTO ${schema_1.SHOPPING_LIST_ITEM_TABLE} (
         owner_id, product_id, quantity, unit_price_cents, created_at_ms, updated_at_ms
       ) VALUES (?, ?, ?, ?, ?, ?);`, ownerContext.value.id, input.productId, input.quantity, input.unitPriceCents, nowMs, nowMs);
        const created = await findItem(Number(insertResult.lastInsertRowId));
        if (!created) {
            return {
                ok: false,
                error: {
                    code: "OWNER_SCOPE_UNAVAILABLE",
                    message: owner_scope_1.OWNER_SCOPE_UNAVAILABLE_MESSAGE,
                },
            };
        }
        return { ok: true, value: mapItem(created) };
    }
    catch (error) {
        console.warn("[shopping-list-service] addShoppingListItem failed", {
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
async function listShoppingListItems() {
    const ownerContext = (0, owner_scope_1.requireActiveOwnerContext)();
    if (!ownerContext.ok) {
        return ownerContext;
    }
    await (0, db_1.bootstrapDatabase)();
    const db = (0, db_1.getDb)();
    try {
        const rows = await db.getAllAsync(`SELECT id, owner_id, product_id, quantity, unit_price_cents, created_at_ms, updated_at_ms
       FROM ${schema_1.SHOPPING_LIST_ITEM_TABLE}
       WHERE owner_id = ?
       ORDER BY created_at_ms DESC, id DESC;`, ownerContext.value.id);
        return { ok: true, value: rows.map(mapItem) };
    }
    catch (error) {
        console.warn("[shopping-list-service] listShoppingListItems failed", {
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
async function updateShoppingListItem(input) {
    const ownerContext = (0, owner_scope_1.requireActiveOwnerContext)();
    if (!ownerContext.ok) {
        return ownerContext;
    }
    await (0, db_1.bootstrapDatabase)();
    const db = (0, db_1.getDb)();
    const invalidPricing = validatePricing(input.quantity, input.unitPriceCents);
    if (invalidPricing) {
        return invalidPricing;
    }
    const existing = await findItem(input.itemId);
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
        await db.runAsync(`UPDATE ${schema_1.SHOPPING_LIST_ITEM_TABLE}
       SET quantity = ?, unit_price_cents = ?, updated_at_ms = ?
       WHERE id = ? AND owner_id = ?;`, input.quantity, input.unitPriceCents, input.nowMs ?? Date.now(), input.itemId, ownerContext.value.id);
        const updated = await findItem(input.itemId);
        if (!updated) {
            return {
                ok: false,
                error: {
                    code: "OWNER_SCOPE_NOT_FOUND",
                    message: owner_scope_1.OWNER_SCOPE_NOT_FOUND_MESSAGE,
                },
            };
        }
        return { ok: true, value: mapItem(updated) };
    }
    catch (error) {
        console.warn("[shopping-list-service] updateShoppingListItem failed", {
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
