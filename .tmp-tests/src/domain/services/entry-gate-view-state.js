"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEntryGateScreenViewState = getEntryGateScreenViewState;
exports.getCreateMasterAdminScreenViewState = getCreateMasterAdminScreenViewState;
exports.getAdminLoginScreenViewState = getAdminLoginScreenViewState;
const entry_gate_1 = require("./entry-gate");
function getEntryGateScreenViewState(targetRoute, gateError) {
    if (gateError) {
        return { kind: "error", message: gateError };
    }
    if (!targetRoute) {
        return { kind: "loading" };
    }
    return { kind: "redirect", href: targetRoute };
}
function getCreateMasterAdminScreenViewState(showSetup, gateError) {
    if (gateError) {
        return { kind: "error", message: gateError };
    }
    if (showSetup === null) {
        return { kind: "loading" };
    }
    if (!showSetup) {
        return { kind: "redirect", href: entry_gate_1.ADMIN_LOGIN_ROUTE };
    }
    return { kind: "content" };
}
function getAdminLoginScreenViewState(showLogin, gateError) {
    if (gateError) {
        return { kind: "error", message: gateError };
    }
    if (showLogin === null) {
        return { kind: "loading" };
    }
    if (!showLogin) {
        return { kind: "redirect", href: entry_gate_1.CREATE_MASTER_ADMIN_ROUTE };
    }
    return { kind: "content" };
}
