"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProduct = createProduct;
exports.listProducts = listProducts;
exports.getProductById = getProductById;
exports.updateProduct = updateProduct;
const db_1 = require("@/db/db");
const schema_1 = require("@/db/schema");
const owner_scope_1 = require("@/domain/services/owner-scope");
function mapProduct(row) {
    return {
        id: row.id,
        ownerId: row.owner_id,
        name: row.name,
        barcode: row.barcode,
        createdAtMs: row.created_at_ms,
        updatedAtMs: row.updated_at_ms,
    };
}
function normalizeInput(value) {
    return value.trim();
}
const PRODUCT_BARCODE_CONFLICT_MESSAGE = "A product with this barcode already exists for the active owner.";
const PRODUCT_INPUT_INVALID_MESSAGE = "Product name and barcode are required.";
function mapConflictError(error) {
    if (!(error instanceof Error)) {
        return null;
    }
    if (/UNIQUE constraint failed/i.test(error.message)) {
        return (0, owner_scope_1.conflictError)(PRODUCT_BARCODE_CONFLICT_MESSAGE);
    }
    return null;
}
function validateProductInput(name, barcode) {
    if (!name || !barcode) {
        return (0, owner_scope_1.invalidInputError)(PRODUCT_INPUT_INVALID_MESSAGE);
    }
    return null;
}
async function findProductById(productId) {
    const db = (0, db_1.getDb)();
    return db.getFirstAsync(`SELECT id, owner_id, name, barcode, created_at_ms, updated_at_ms
     FROM ${schema_1.PRODUCT_TABLE}
     WHERE id = ?
     LIMIT 1;`, productId);
}
async function createProduct(input) {
    const ownerContext = (0, owner_scope_1.requireActiveOwnerContext)();
    if (!ownerContext.ok) {
        return ownerContext;
    }
    await (0, db_1.bootstrapDatabase)();
    const db = (0, db_1.getDb)();
    const nowMs = input.nowMs ?? Date.now();
    const normalizedName = normalizeInput(input.name);
    const normalizedBarcode = normalizeInput(input.barcode);
    const invalidInput = validateProductInput(normalizedName, normalizedBarcode);
    if (invalidInput) {
        return invalidInput;
    }
    try {
        const insertResult = await db.runAsync(`INSERT INTO ${schema_1.PRODUCT_TABLE} (
         owner_id, name, barcode, created_at_ms, updated_at_ms
       ) VALUES (?, ?, ?, ?, ?);`, ownerContext.value.id, normalizedName, normalizedBarcode, nowMs, nowMs);
        const created = await db.getFirstAsync(`SELECT id, owner_id, name, barcode, created_at_ms, updated_at_ms
       FROM ${schema_1.PRODUCT_TABLE}
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
        return { ok: true, value: mapProduct(created) };
    }
    catch (error) {
        const mapped = mapConflictError(error);
        if (mapped) {
            return mapped;
        }
        console.warn("[product-service] createProduct failed", {
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
async function listProducts() {
    const ownerContext = (0, owner_scope_1.requireActiveOwnerContext)();
    if (!ownerContext.ok) {
        return ownerContext;
    }
    await (0, db_1.bootstrapDatabase)();
    const db = (0, db_1.getDb)();
    try {
        const rows = await db.getAllAsync(`SELECT id, owner_id, name, barcode, created_at_ms, updated_at_ms
       FROM ${schema_1.PRODUCT_TABLE}
       WHERE owner_id = ?
       ORDER BY created_at_ms DESC, id DESC;`, ownerContext.value.id);
        return { ok: true, value: rows.map(mapProduct) };
    }
    catch (error) {
        console.warn("[product-service] listProducts failed", {
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
async function getProductById(productId) {
    const ownerContext = (0, owner_scope_1.requireActiveOwnerContext)();
    if (!ownerContext.ok) {
        return ownerContext;
    }
    await (0, db_1.bootstrapDatabase)();
    try {
        const row = await findProductById(productId);
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
        return { ok: true, value: mapProduct(row) };
    }
    catch (error) {
        console.warn("[product-service] getProductById failed", {
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
async function updateProduct(input) {
    const ownerContext = (0, owner_scope_1.requireActiveOwnerContext)();
    if (!ownerContext.ok) {
        return ownerContext;
    }
    await (0, db_1.bootstrapDatabase)();
    const db = (0, db_1.getDb)();
    const existing = await findProductById(input.productId);
    const normalizedName = normalizeInput(input.name);
    const normalizedBarcode = normalizeInput(input.barcode);
    const invalidInput = validateProductInput(normalizedName, normalizedBarcode);
    if (invalidInput) {
        return invalidInput;
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
        await db.runAsync(`UPDATE ${schema_1.PRODUCT_TABLE}
       SET name = ?, barcode = ?, updated_at_ms = ?
       WHERE id = ? AND owner_id = ?;`, normalizedName, normalizedBarcode, input.nowMs ?? Date.now(), input.productId, ownerContext.value.id);
        const updated = await findProductById(input.productId);
        if (!updated) {
            return {
                ok: false,
                error: {
                    code: "OWNER_SCOPE_NOT_FOUND",
                    message: owner_scope_1.OWNER_SCOPE_NOT_FOUND_MESSAGE,
                },
            };
        }
        return { ok: true, value: mapProduct(updated) };
    }
    catch (error) {
        const mapped = mapConflictError(error);
        if (mapped) {
            return mapped;
        }
        console.warn("[product-service] updateProduct failed", {
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
