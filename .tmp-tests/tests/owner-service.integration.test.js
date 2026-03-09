"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockBootstrapDatabase = jest.fn();
const mockGetDb = jest.fn();
const mockWarn = jest.spyOn(console, "warn").mockImplementation(() => { });
const mockDb = {
    getAllAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    runAsync: jest.fn(),
};
jest.mock("@/db/db", () => ({
    bootstrapDatabase: (...args) => mockBootstrapDatabase(...args),
    getDb: (...args) => mockGetDb(...args),
}));
let ownerService;
describe("owner-service", () => {
    let session;
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockBootstrapDatabase.mockResolvedValue(undefined);
        mockGetDb.mockReturnValue(mockDb);
        mockDb.getAllAsync.mockResolvedValue([]);
        mockDb.getFirstAsync.mockResolvedValue(null);
        mockDb.runAsync.mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
        session = require("@/domain/services/admin-session");
        session.clearAdminSession();
        session.setAdminSession({ id: 1, username: "admin" });
        ownerService = require("@/domain/services/owner-service");
    });
    afterAll(() => {
        mockWarn.mockRestore();
    });
    it("creates owner and returns inserted value", async () => {
        mockDb.runAsync.mockResolvedValueOnce({ changes: 1, lastInsertRowId: 12 });
        mockDb.getFirstAsync.mockResolvedValueOnce({
            id: 12,
            name: "Main Store",
            created_at_ms: 1700000000000,
            updated_at_ms: 1700000000000,
        });
        const result = await ownerService.createOwner({
            name: "  Main Store ",
            nowMs: 1700000000000,
        });
        expect(result).toEqual({
            ok: true,
            value: {
                id: 12,
                name: "Main Store",
                createdAtMs: 1700000000000,
                updatedAtMs: 1700000000000,
            },
        });
    });
    it("rejects empty owner names", async () => {
        const result = await ownerService.createOwner({ name: "   " });
        expect(result).toEqual({
            ok: false,
            error: {
                code: "OWNER_NAME_REQUIRED",
                message: "Owner name is required.",
            },
        });
        expect(mockDb.runAsync).not.toHaveBeenCalled();
    });
    it("maps duplicate-name db failures to safe owner error", async () => {
        mockDb.runAsync.mockRejectedValueOnce(new Error("UNIQUE constraint failed: store_owner.name"));
        const result = await ownerService.createOwner({ name: "Main Store" });
        expect(result).toEqual({
            ok: false,
            error: {
                code: "OWNER_NAME_TAKEN",
                message: "An owner with that name already exists.",
            },
        });
    });
    it("lists owners newest first", async () => {
        mockDb.getAllAsync.mockResolvedValueOnce([
            {
                id: 2,
                name: "North",
                created_at_ms: 200,
                updated_at_ms: 200,
            },
            {
                id: 1,
                name: "South",
                created_at_ms: 100,
                updated_at_ms: 100,
            },
        ]);
        const result = await ownerService.listOwners();
        expect(result).toEqual({
            ok: true,
            value: [
                { id: 2, name: "North", createdAtMs: 200, updatedAtMs: 200 },
                { id: 1, name: "South", createdAtMs: 100, updatedAtMs: 100 },
            ],
        });
    });
    it("switches active owner and updates session context", async () => {
        mockDb.getFirstAsync.mockResolvedValueOnce({
            id: 7,
            name: "Downtown",
            created_at_ms: 1,
            updated_at_ms: 1,
        });
        const result = await ownerService.switchActiveOwner(7);
        expect(result).toEqual({
            ok: true,
            value: { id: 7, name: "Downtown", createdAtMs: 1, updatedAtMs: 1 },
        });
        expect(session.getActiveOwner()).toEqual({ id: 7, name: "Downtown" });
    });
    it("requires an authenticated admin session for create/list/switch", async () => {
        session.clearAdminSession();
        const createResult = await ownerService.createOwner({ name: "North" });
        const listResult = await ownerService.listOwners();
        const switchResult = await ownerService.switchActiveOwner(1);
        expect(createResult).toEqual({
            ok: false,
            error: {
                code: "OWNER_SWITCH_REQUIRES_ADMIN_SESSION",
                message: "Please sign in as admin to switch owners.",
            },
        });
        expect(listResult).toEqual({
            ok: false,
            error: {
                code: "OWNER_SWITCH_REQUIRES_ADMIN_SESSION",
                message: "Please sign in as admin to switch owners.",
            },
        });
        expect(switchResult).toEqual({
            ok: false,
            error: {
                code: "OWNER_SWITCH_REQUIRES_ADMIN_SESSION",
                message: "Please sign in as admin to switch owners.",
            },
        });
    });
    it("returns owner-not-found when switching to an unknown owner", async () => {
        mockDb.getFirstAsync.mockResolvedValueOnce(null);
        const result = await ownerService.switchActiveOwner(999);
        expect(result).toEqual({
            ok: false,
            error: {
                code: "OWNER_NOT_FOUND",
                message: "Owner not found.",
            },
        });
    });
    it("returns safe service error when listOwners query fails", async () => {
        mockDb.getAllAsync.mockRejectedValueOnce(new Error("database is locked"));
        const result = await ownerService.listOwners();
        expect(result).toEqual({
            ok: false,
            error: {
                code: "OWNER_SERVICE_UNAVAILABLE",
                message: "We couldn't update store owners right now. Please retry.",
            },
        });
    });
    it("returns safe service error when switchActiveOwner query fails", async () => {
        mockDb.getFirstAsync.mockRejectedValueOnce(new Error("database is locked"));
        const result = await ownerService.switchActiveOwner(7);
        expect(result).toEqual({
            ok: false,
            error: {
                code: "OWNER_SERVICE_UNAVAILABLE",
                message: "We couldn't update store owners right now. Please retry.",
            },
        });
    });
});
