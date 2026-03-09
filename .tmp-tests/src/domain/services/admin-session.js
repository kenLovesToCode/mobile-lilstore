"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getAdminSession = getAdminSession;
exports.isAdminAuthenticated = isAdminAuthenticated;
exports.getActiveOwner = getActiveOwner;
exports.setAdminSession = setAdminSession;
exports.setActiveOwner = setActiveOwner;
exports.clearAdminSession = clearAdminSession;
exports.subscribeToAdminSession = subscribeToAdminSession;
let currentAdminSession = null;
let currentActiveOwner = null;
const listeners = new Set();
function getSafeErrorReason(error) {
    if (error instanceof Error && error.name) {
        return error.name;
    }
    return "UnknownError";
}
function toImmutableAdminSession(admin) {
    return Object.freeze({
        id: admin.id,
        username: admin.username,
    });
}
function toImmutableOwnerContext(owner) {
    return Object.freeze({
        id: owner.id,
        name: owner.name,
    });
}
function emitSessionChange() {
    for (const listener of listeners) {
        try {
            listener();
        }
        catch (error) {
            console.warn("[admin-session] listener callback failed", {
                reason: getSafeErrorReason(error),
            });
        }
    }
}
function getAdminSession() {
    return currentAdminSession;
}
function isAdminAuthenticated() {
    return currentAdminSession !== null;
}
function getActiveOwner() {
    return currentActiveOwner;
}
function setAdminSession(admin) {
    currentAdminSession = toImmutableAdminSession(admin);
    currentActiveOwner = null;
    emitSessionChange();
}
function setActiveOwner(owner) {
    currentActiveOwner = toImmutableOwnerContext(owner);
    emitSessionChange();
}
function clearAdminSession() {
    currentAdminSession = null;
    currentActiveOwner = null;
    emitSessionChange();
}
function subscribeToAdminSession(listener) {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
}
