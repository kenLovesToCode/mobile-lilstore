"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createOwner = createOwner;
exports.listOwners = listOwners;
exports.switchActiveOwner = switchActiveOwner;
const db_1 = require("@/db/db");
const schema_1 = require("@/db/schema");
const admin_session_1 = require("@/domain/services/admin-session");
const OWNER_NAME_REQUIRED_MESSAGE = "Owner name is required.";
const OWNER_NAME_TAKEN_MESSAGE = "An owner with that name already exists.";
const OWNER_NOT_FOUND_MESSAGE = "Owner not found.";
const OWNER_SWITCH_REQUIRES_ADMIN_SESSION_MESSAGE = "Please sign in as admin to switch owners.";
const OWNER_SERVICE_UNAVAILABLE_MESSAGE = "We couldn't update store owners right now. Please retry.";
function mapOwnerRow(row) {
    return {
        id: row.id,
        name: row.name,
        createdAtMs: row.created_at_ms,
        updatedAtMs: row.updated_at_ms,
    };
}
function normalizeOwnerName(name) {
    return name.trim();
}
function isUniqueConstraintError(error) {
    if (!(error instanceof Error)) {
        return false;
    }
    return /UNIQUE constraint failed/i.test(error.message);
}
function safeErrorReason(error) {
    if (error instanceof Error && error.name) {
        return error.name;
    }
    return "UnknownError";
}
async function createOwner(input) {
    if (!(0, admin_session_1.isAdminAuthenticated)()) {
        return {
            ok: false,
            error: {
                code: "OWNER_SWITCH_REQUIRES_ADMIN_SESSION",
                message: OWNER_SWITCH_REQUIRES_ADMIN_SESSION_MESSAGE,
            },
        };
    }
    const normalizedName = normalizeOwnerName(input.name);
    if (!normalizedName) {
        return {
            ok: false,
            error: {
                code: "OWNER_NAME_REQUIRED",
                message: OWNER_NAME_REQUIRED_MESSAGE,
            },
        };
    }
    await (0, db_1.bootstrapDatabase)();
    const db = (0, db_1.getDb)();
    const nowMs = input.nowMs ?? Date.now();
    try {
        const insertResult = await db.runAsync(`INSERT INTO ${schema_1.STORE_OWNER_TABLE} (name, created_at_ms, updated_at_ms)
       VALUES (?, ?, ?);`, normalizedName, nowMs, nowMs);
        const ownerId = Number(insertResult.lastInsertRowId);
        const createdOwner = await db.getFirstAsync(`SELECT id, name, created_at_ms, updated_at_ms
       FROM ${schema_1.STORE_OWNER_TABLE}
       WHERE id = ?
       LIMIT 1;`, ownerId);
        if (!createdOwner) {
            return {
                ok: false,
                error: {
                    code: "OWNER_SERVICE_UNAVAILABLE",
                    message: OWNER_SERVICE_UNAVAILABLE_MESSAGE,
                },
            };
        }
        return {
            ok: true,
            value: mapOwnerRow(createdOwner),
        };
    }
    catch (error) {
        if (isUniqueConstraintError(error)) {
            return {
                ok: false,
                error: {
                    code: "OWNER_NAME_TAKEN",
                    message: OWNER_NAME_TAKEN_MESSAGE,
                },
            };
        }
        console.warn("[owner-service] createOwner failed", {
            reason: safeErrorReason(error),
        });
        return {
            ok: false,
            error: {
                code: "OWNER_SERVICE_UNAVAILABLE",
                message: OWNER_SERVICE_UNAVAILABLE_MESSAGE,
            },
        };
    }
}
async function listOwners() {
    if (!(0, admin_session_1.isAdminAuthenticated)()) {
        return {
            ok: false,
            error: {
                code: "OWNER_SWITCH_REQUIRES_ADMIN_SESSION",
                message: OWNER_SWITCH_REQUIRES_ADMIN_SESSION_MESSAGE,
            },
        };
    }
    await (0, db_1.bootstrapDatabase)();
    const db = (0, db_1.getDb)();
    try {
        const rows = await db.getAllAsync(`SELECT id, name, created_at_ms, updated_at_ms
       FROM ${schema_1.STORE_OWNER_TABLE}
       ORDER BY created_at_ms DESC, id DESC;`);
        return {
            ok: true,
            value: rows.map(mapOwnerRow),
        };
    }
    catch (error) {
        console.warn("[owner-service] listOwners failed", {
            reason: safeErrorReason(error),
        });
        return {
            ok: false,
            error: {
                code: "OWNER_SERVICE_UNAVAILABLE",
                message: OWNER_SERVICE_UNAVAILABLE_MESSAGE,
            },
        };
    }
}
async function switchActiveOwner(ownerId) {
    if (!(0, admin_session_1.isAdminAuthenticated)()) {
        return {
            ok: false,
            error: {
                code: "OWNER_SWITCH_REQUIRES_ADMIN_SESSION",
                message: OWNER_SWITCH_REQUIRES_ADMIN_SESSION_MESSAGE,
            },
        };
    }
    await (0, db_1.bootstrapDatabase)();
    const db = (0, db_1.getDb)();
    try {
        const ownerRow = await db.getFirstAsync(`SELECT id, name, created_at_ms, updated_at_ms
       FROM ${schema_1.STORE_OWNER_TABLE}
       WHERE id = ?
       LIMIT 1;`, ownerId);
        if (!ownerRow) {
            return {
                ok: false,
                error: {
                    code: "OWNER_NOT_FOUND",
                    message: OWNER_NOT_FOUND_MESSAGE,
                },
            };
        }
        if (!(0, admin_session_1.isAdminAuthenticated)()) {
            return {
                ok: false,
                error: {
                    code: "OWNER_SWITCH_REQUIRES_ADMIN_SESSION",
                    message: OWNER_SWITCH_REQUIRES_ADMIN_SESSION_MESSAGE,
                },
            };
        }
        (0, admin_session_1.setActiveOwner)({
            id: ownerRow.id,
            name: ownerRow.name,
        });
        return {
            ok: true,
            value: mapOwnerRow(ownerRow),
        };
    }
    catch (error) {
        console.warn("[owner-service] switchActiveOwner failed", {
            reason: safeErrorReason(error),
        });
        return {
            ok: false,
            error: {
                code: "OWNER_SERVICE_UNAVAILABLE",
                message: OWNER_SERVICE_UNAVAILABLE_MESSAGE,
            },
        };
    }
}
