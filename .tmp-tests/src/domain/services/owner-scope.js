"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OWNER_SCOPE_UNAVAILABLE_MESSAGE = exports.OWNER_SCOPE_NOT_FOUND_MESSAGE = exports.OWNER_SCOPE_MISMATCH_MESSAGE = exports.OWNER_SCOPE_CONFLICT_MESSAGE = exports.OWNER_SCOPE_INVALID_INPUT_MESSAGE = exports.OWNER_SCOPE_REQUIRES_ACTIVE_OWNER_MESSAGE = exports.OWNER_SCOPE_REQUIRES_ADMIN_SESSION_MESSAGE = void 0;
exports.getSafeErrorReason = getSafeErrorReason;
exports.invalidInputError = invalidInputError;
exports.conflictError = conflictError;
exports.requireActiveOwnerContext = requireActiveOwnerContext;
const admin_session_1 = require("@/domain/services/admin-session");
exports.OWNER_SCOPE_REQUIRES_ADMIN_SESSION_MESSAGE = "Please sign in as admin to continue.";
exports.OWNER_SCOPE_REQUIRES_ACTIVE_OWNER_MESSAGE = "Select an active owner before managing owner-scoped data.";
exports.OWNER_SCOPE_INVALID_INPUT_MESSAGE = "Please provide valid inputs for this operation.";
exports.OWNER_SCOPE_CONFLICT_MESSAGE = "This operation conflicts with existing owner-scoped data.";
exports.OWNER_SCOPE_MISMATCH_MESSAGE = "The requested record belongs to a different owner.";
exports.OWNER_SCOPE_NOT_FOUND_MESSAGE = "Record not found in the active owner scope.";
exports.OWNER_SCOPE_UNAVAILABLE_MESSAGE = "We couldn't process that owner-scoped operation right now. Please retry.";
function getSafeErrorReason(error) {
    if (error instanceof Error && error.name) {
        return error.name;
    }
    return "UnknownError";
}
function invalidInputError(message = exports.OWNER_SCOPE_INVALID_INPUT_MESSAGE) {
    return {
        ok: false,
        error: {
            code: "OWNER_SCOPE_INVALID_INPUT",
            message,
        },
    };
}
function conflictError(message = exports.OWNER_SCOPE_CONFLICT_MESSAGE) {
    return {
        ok: false,
        error: {
            code: "OWNER_SCOPE_CONFLICT",
            message,
        },
    };
}
function requireActiveOwnerContext() {
    if (!(0, admin_session_1.isAdminAuthenticated)()) {
        return {
            ok: false,
            error: {
                code: "OWNER_SCOPE_REQUIRES_ADMIN_SESSION",
                message: exports.OWNER_SCOPE_REQUIRES_ADMIN_SESSION_MESSAGE,
            },
        };
    }
    const activeOwner = (0, admin_session_1.getActiveOwner)();
    if (!activeOwner) {
        return {
            ok: false,
            error: {
                code: "OWNER_SCOPE_REQUIRES_ACTIVE_OWNER",
                message: exports.OWNER_SCOPE_REQUIRES_ACTIVE_OWNER_MESSAGE,
            },
        };
    }
    return {
        ok: true,
        value: activeOwner,
    };
}
