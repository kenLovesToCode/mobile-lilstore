"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const entry_gate_1 = require("@/domain/services/entry-gate");
const entry_gate_runtime_1 = require("@/domain/services/entry-gate-runtime");
describe("entry gate runtime", () => {
    beforeEach(() => {
        (0, entry_gate_runtime_1.invalidateEntryGateSnapshot)();
    });
    afterEach(() => {
        (0, entry_gate_runtime_1.invalidateEntryGateSnapshot)();
    });
    it("routes to create-master-admin when no admin exists", async () => {
        const result = await (0, entry_gate_runtime_1.resolveEntryRouteFromAdminCheck)(async () => false, {
            timeoutMs: 100,
        });
        expect(result).toEqual(expect.objectContaining({
            kind: "success",
            value: entry_gate_1.CREATE_MASTER_ADMIN_ROUTE,
        }));
    });
    it("routes to admin login when at least one admin exists", async () => {
        const result = await (0, entry_gate_runtime_1.resolveEntryRouteFromAdminCheck)(async () => true, {
            timeoutMs: 100,
        });
        expect(result).toEqual(expect.objectContaining({
            kind: "success",
            value: entry_gate_1.ADMIN_LOGIN_ROUTE,
        }));
    });
    it("uses gate snapshot for create-master-admin visibility", async () => {
        (0, entry_gate_runtime_1.updateEntryGateSnapshotAfterAdminChange)(true);
        const readHasAdmin = jest.fn(async () => false);
        const result = await (0, entry_gate_runtime_1.resolveCreateMasterAdminVisibility)(readHasAdmin, {
            snapshotMaxAgeMs: 1000,
        });
        expect(result).toEqual(expect.objectContaining({
            kind: "success",
            value: false,
        }));
        expect(readHasAdmin).not.toHaveBeenCalled();
    });
    it("uses gate snapshot for login visibility", async () => {
        (0, entry_gate_runtime_1.updateEntryGateSnapshotAfterAdminChange)(true);
        const readHasAdmin = jest.fn(async () => false);
        const result = await (0, entry_gate_runtime_1.resolveAdminLoginVisibility)(readHasAdmin, {
            snapshotMaxAgeMs: 1000,
        });
        expect(result).toEqual(expect.objectContaining({
            kind: "success",
            value: true,
        }));
        expect(readHasAdmin).not.toHaveBeenCalled();
    });
    it("returns timeout-safe error when admin check exceeds timeout", async () => {
        const result = await (0, entry_gate_runtime_1.resolveEntryRouteFromAdminCheck)(async () => new Promise(() => { }), { timeoutMs: 5 });
        expect(result).toEqual(expect.objectContaining({
            kind: "error",
            message: entry_gate_runtime_1.GATE_TIMEOUT_ERROR_MESSAGE,
        }));
    });
    it("returns default safe error for unexpected failures", async () => {
        const result = await (0, entry_gate_runtime_1.resolveEntryRouteFromAdminCheck)(async () => {
            throw new Error("db unavailable");
        });
        expect(result).toEqual(expect.objectContaining({
            kind: "error",
            message: entry_gate_runtime_1.DEFAULT_GATE_ERROR_MESSAGE,
        }));
    });
});
