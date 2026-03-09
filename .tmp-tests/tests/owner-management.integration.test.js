"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const testing_library_1 = require("expo-router/testing-library");
const admin_session_1 = require("@/domain/services/admin-session");
const mockHasAnyAdmin = jest.fn();
const mockResolveAdminLoginVisibility = jest.fn();
const mockAuthenticateAdmin = jest.fn();
const mockListOwners = jest.fn();
const mockCreateOwner = jest.fn();
const mockSwitchActiveOwner = jest.fn();
jest.mock("@/domain/services/auth-service", () => ({
    hasAnyAdmin: () => mockHasAnyAdmin(),
    authenticateAdmin: (...args) => mockAuthenticateAdmin(...args),
    normalizeAdminUsername: (value) => value.trim().toLowerCase(),
}));
jest.mock("@/domain/services/entry-gate-runtime", () => ({
    resolveAdminLoginVisibility: (...args) => mockResolveAdminLoginVisibility(...args),
}));
jest.mock("@/domain/services/owner-service", () => ({
    listOwners: (...args) => mockListOwners(...args),
    createOwner: (...args) => mockCreateOwner(...args),
    switchActiveOwner: (...args) => mockSwitchActiveOwner(...args),
}));
const ROUTES = {
    "(admin)/_layout": require("../src/app/(admin)/_layout").default,
    "(admin)/login": require("../src/app/(admin)/login").default,
    "(admin)/dashboard": require("../src/app/(admin)/dashboard").default,
    "(admin)/owners": require("../src/app/(admin)/owners").default,
};
describe("Owner management integration", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (0, admin_session_1.clearAdminSession)();
        mockHasAnyAdmin.mockResolvedValue(true);
        mockResolveAdminLoginVisibility.mockResolvedValue({
            kind: "success",
            value: true,
            elapsedMs: 0,
        });
        mockAuthenticateAdmin.mockResolvedValue({
            kind: "success",
            admin: { id: 1, username: "admin" },
        });
        mockListOwners.mockResolvedValue({ ok: true, value: [] });
        mockCreateOwner.mockResolvedValue({
            ok: true,
            value: {
                id: 2,
                name: "Downtown",
                createdAtMs: 10,
                updatedAtMs: 10,
            },
        });
        mockSwitchActiveOwner.mockResolvedValue({
            ok: true,
            value: {
                id: 2,
                name: "Downtown",
                createdAtMs: 10,
                updatedAtMs: 10,
            },
        });
    });
    it("creates owner, lists it, and switches active owner from owners screen", async () => {
        (0, admin_session_1.setAdminSession)({ id: 1, username: "admin" });
        mockListOwners
            .mockResolvedValueOnce({ ok: true, value: [] })
            .mockResolvedValueOnce({
            ok: true,
            value: [{ id: 2, name: "Downtown", createdAtMs: 10, updatedAtMs: 10 }],
        })
            .mockResolvedValueOnce({
            ok: true,
            value: [{ id: 2, name: "Downtown", createdAtMs: 10, updatedAtMs: 10 }],
        });
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: "/owners" });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByText("Owners")).toBeTruthy();
        });
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Owner Name"), "Downtown");
        testing_library_1.fireEvent.press(testing_library_1.screen.getByText("Create Owner"));
        await (0, testing_library_1.waitFor)(() => {
            expect(mockCreateOwner).toHaveBeenCalledWith({ name: "Downtown" });
        });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByText("Downtown")).toBeTruthy();
        });
        testing_library_1.fireEvent.press(testing_library_1.screen.getByLabelText("Switch to Downtown"));
        await (0, testing_library_1.waitFor)(() => {
            expect(mockSwitchActiveOwner).toHaveBeenCalledWith(2);
        });
        expect(testing_library_1.screen.queryByText("Active owner: Downtown")).toBeFalsy();
    });
    it("shows no-owner guard on dashboard when no active owner exists", async () => {
        (0, admin_session_1.setAdminSession)({ id: 1, username: "admin" });
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: "/dashboard" });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByText("No active owner selected.")).toBeTruthy();
        });
        expect(testing_library_1.screen.getByText("Go to Owners")).toBeTruthy();
    });
});
