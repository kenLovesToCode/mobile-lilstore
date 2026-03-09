"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const testing_library_1 = require("expo-router/testing-library");
const entry_gate_1 = require("@/domain/services/entry-gate");
const adminSessionService = __importStar(require("@/domain/services/admin-session"));
const admin_session_1 = require("@/domain/services/admin-session");
const PUBLIC_CREATE_MASTER_ADMIN_ROUTE = "/create-master-admin";
const PUBLIC_ADMIN_LOGIN_ROUTE = "/login";
const PUBLIC_ADMIN_DASHBOARD_ROUTE = "/dashboard";
const mockResolveEntryRouteFromAdminCheck = jest.fn();
const mockResolveCreateMasterAdminVisibility = jest.fn();
const mockResolveAdminLoginVisibility = jest.fn();
const mockHasAnyAdmin = jest.fn();
const mockCreateInitialMasterAdmin = jest.fn();
const mockAuthenticateAdmin = jest.fn();
jest.mock("@/domain/services/auth-service", () => ({
    hasAnyAdmin: () => mockHasAnyAdmin(),
    createInitialMasterAdmin: (...args) => mockCreateInitialMasterAdmin(...args),
    authenticateAdmin: (...args) => mockAuthenticateAdmin(...args),
    normalizeAdminUsername: (value) => value.trim().toLowerCase(),
}));
jest.mock("@/domain/services/entry-gate-runtime", () => ({
    resolveEntryRouteFromAdminCheck: (...args) => mockResolveEntryRouteFromAdminCheck(...args),
    resolveCreateMasterAdminVisibility: (...args) => mockResolveCreateMasterAdminVisibility(...args),
    resolveAdminLoginVisibility: (...args) => mockResolveAdminLoginVisibility(...args),
}));
const ROUTES = {
    _layout: require("../src/app/_layout").default,
    index: require("../src/app/index").default,
    "(admin)/_layout": require("../src/app/(admin)/_layout").default,
    "(admin)/create-master-admin": require("../src/app/(admin)/create-master-admin").default,
    "(admin)/login": require("../src/app/(admin)/login").default,
    "(admin)/dashboard": require("../src/app/(admin)/dashboard").default,
};
async function expectResolverWiring(resolverMock, expectedAdminExists) {
    expect(resolverMock).toHaveBeenCalled();
    const [readHasAdmin] = resolverMock.mock.calls.at(-1) ?? [];
    expect(typeof readHasAdmin).toBe("function");
    await expect(readHasAdmin()).resolves.toBe(expectedAdminExists);
    expect(mockHasAnyAdmin).toHaveBeenCalled();
}
describe("Entry gate router integration", () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (0, admin_session_1.clearAdminSession)();
        mockHasAnyAdmin.mockResolvedValue(false);
        mockResolveEntryRouteFromAdminCheck.mockResolvedValue({
            kind: "success",
            value: entry_gate_1.CREATE_MASTER_ADMIN_ROUTE,
            elapsedMs: 0,
        });
        mockResolveCreateMasterAdminVisibility.mockResolvedValue({
            kind: "success",
            value: true,
            elapsedMs: 0,
        });
        mockResolveAdminLoginVisibility.mockResolvedValue({
            kind: "success",
            value: true,
            elapsedMs: 0,
        });
        mockCreateInitialMasterAdmin.mockResolvedValue({
            kind: "success",
            username: "admin",
            createdAtMs: 1700000000000,
        });
        mockAuthenticateAdmin.mockResolvedValue({
            kind: "success",
            admin: {
                id: 1,
                username: "admin",
            },
        });
    });
    it("routes first-run users to create-master-admin screen", async () => {
        mockResolveEntryRouteFromAdminCheck.mockResolvedValue({
            kind: "success",
            value: entry_gate_1.CREATE_MASTER_ADMIN_ROUTE,
            elapsedMs: 18,
        });
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: "/" });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen).toHavePathname(PUBLIC_CREATE_MASTER_ADMIN_ROUTE);
        });
        await expectResolverWiring(mockResolveEntryRouteFromAdminCheck, false);
    });
    it("routes returning admins to login screen", async () => {
        mockHasAnyAdmin.mockResolvedValue(true);
        mockResolveEntryRouteFromAdminCheck.mockResolvedValue({
            kind: "success",
            value: entry_gate_1.ADMIN_LOGIN_ROUTE,
            elapsedMs: 11,
        });
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: "/" });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen).toHavePathname(PUBLIC_ADMIN_LOGIN_ROUTE);
        });
        await expectResolverWiring(mockResolveEntryRouteFromAdminCheck, true);
    });
    it("retries entry gate after a failure and navigates when retry succeeds", async () => {
        mockResolveEntryRouteFromAdminCheck
            .mockResolvedValueOnce({
            kind: "error",
            message: "We couldn't check local setup right now. Please retry.",
            elapsedMs: 1900,
        })
            .mockResolvedValueOnce({
            kind: "success",
            value: entry_gate_1.ADMIN_LOGIN_ROUTE,
            elapsedMs: 90,
        });
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: "/" });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByText("Unable to load entry gate")).toBeTruthy();
        });
        testing_library_1.fireEvent.press(testing_library_1.screen.getByText("Retry"));
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen).toHavePathname(PUBLIC_ADMIN_LOGIN_ROUTE);
        });
    });
    it("redirects create-master-admin shell to login when admin already exists", async () => {
        mockHasAnyAdmin.mockResolvedValue(true);
        mockResolveCreateMasterAdminVisibility.mockResolvedValue({
            kind: "success",
            value: false,
            elapsedMs: 0,
        });
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: PUBLIC_CREATE_MASTER_ADMIN_ROUTE });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen).toHavePathname(PUBLIC_ADMIN_LOGIN_ROUTE);
        });
        await expectResolverWiring(mockResolveCreateMasterAdminVisibility, true);
    });
    it("retries create-master-admin guard after failure and renders setup shell", async () => {
        mockResolveCreateMasterAdminVisibility
            .mockResolvedValueOnce({
            kind: "error",
            message: "We couldn't check local setup right now. Please retry.",
            elapsedMs: 50,
        })
            .mockResolvedValueOnce({
            kind: "success",
            value: true,
            elapsedMs: 0,
        });
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: PUBLIC_CREATE_MASTER_ADMIN_ROUTE });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByText("Unable to load entry gate")).toBeTruthy();
        });
        testing_library_1.fireEvent.press(testing_library_1.screen.getByText("Retry"));
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByText("Create Master Admin")).toBeTruthy();
        });
        expect(testing_library_1.screen.getByLabelText("Username")).toBeTruthy();
        await expectResolverWiring(mockResolveCreateMasterAdminVisibility, false);
    });
    it("renders create-master-admin form content when no admin exists", async () => {
        mockResolveCreateMasterAdminVisibility.mockResolvedValue({
            kind: "success",
            value: true,
            elapsedMs: 0,
        });
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: PUBLIC_CREATE_MASTER_ADMIN_ROUTE });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByText("Create Master Admin")).toBeTruthy();
        });
        expect(testing_library_1.screen.getByLabelText("Username")).toBeTruthy();
        expect(testing_library_1.screen.getByLabelText("Password")).toBeTruthy();
        expect(testing_library_1.screen.getByLabelText("Confirm Password")).toBeTruthy();
        expect(testing_library_1.screen.getByText("Create Admin Account")).toBeTruthy();
        await expectResolverWiring(mockResolveCreateMasterAdminVisibility, false);
    });
    it("submits create-master-admin form and routes to login on success", async () => {
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: PUBLIC_CREATE_MASTER_ADMIN_ROUTE });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByLabelText("Username")).toBeTruthy();
        });
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Username"), "  MasterUser  ");
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Password"), "Password123!");
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Confirm Password"), "Password123!");
        testing_library_1.fireEvent.press(testing_library_1.screen.getByText("Create Admin Account"));
        await (0, testing_library_1.waitFor)(() => {
            expect(mockCreateInitialMasterAdmin).toHaveBeenCalledWith({
                username: "masteruser",
                password: "Password123!",
            });
        });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen).toHavePathname(PUBLIC_ADMIN_LOGIN_ROUTE);
        });
    });
    it("shows user-safe validation message when form fields are invalid", async () => {
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: PUBLIC_CREATE_MASTER_ADMIN_ROUTE });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByLabelText("Username")).toBeTruthy();
        });
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Username"), "owner");
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Password"), "Password123!");
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Confirm Password"), "Mismatch!");
        testing_library_1.fireEvent.press(testing_library_1.screen.getByText("Create Admin Account"));
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByText("Password and confirmation must match.")).toBeTruthy();
        });
        expect(mockCreateInitialMasterAdmin).not.toHaveBeenCalled();
        expect(testing_library_1.screen).toHavePathname(PUBLIC_CREATE_MASTER_ADMIN_ROUTE);
    });
    it("redirects to login when service reports setup already complete", async () => {
        mockCreateInitialMasterAdmin.mockResolvedValue({
            kind: "already-exists",
            message: "Admin setup is already complete. Please sign in.",
        });
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: PUBLIC_CREATE_MASTER_ADMIN_ROUTE });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByLabelText("Username")).toBeTruthy();
        });
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Username"), "owner");
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Password"), "Password123!");
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Confirm Password"), "Password123!");
        testing_library_1.fireEvent.press(testing_library_1.screen.getByText("Create Admin Account"));
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen).toHavePathname(PUBLIC_ADMIN_LOGIN_ROUTE);
        });
    });
    it("shows a safe failure message when create-admin service fails", async () => {
        mockCreateInitialMasterAdmin.mockResolvedValue({
            kind: "error",
            message: "We couldn't create the admin account right now. Please retry.",
        });
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: PUBLIC_CREATE_MASTER_ADMIN_ROUTE });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByLabelText("Username")).toBeTruthy();
        });
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Username"), "owner");
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Password"), "Password123!");
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Confirm Password"), "Password123!");
        testing_library_1.fireEvent.press(testing_library_1.screen.getByText("Create Admin Account"));
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByText("We couldn't create the admin account right now. Please retry.")).toBeTruthy();
        });
        expect(testing_library_1.screen).toHavePathname(PUBLIC_CREATE_MASTER_ADMIN_ROUTE);
    });
    it("clears plaintext password fields after invalid submit attempt", async () => {
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: PUBLIC_CREATE_MASTER_ADMIN_ROUTE });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByLabelText("Username")).toBeTruthy();
        });
        const passwordInput = testing_library_1.screen.getByLabelText("Password");
        const confirmPasswordInput = testing_library_1.screen.getByLabelText("Confirm Password");
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Username"), "owner");
        testing_library_1.fireEvent.changeText(passwordInput, "Password123!");
        testing_library_1.fireEvent.changeText(confirmPasswordInput, "Mismatch!");
        testing_library_1.fireEvent.press(testing_library_1.screen.getByText("Create Admin Account"));
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByText("Password and confirmation must match.")).toBeTruthy();
        });
        expect(testing_library_1.screen.queryByDisplayValue("Password123!")).toBeFalsy();
        expect(testing_library_1.screen.queryByDisplayValue("Mismatch!")).toBeFalsy();
    });
    it("redirects login shell to create-master-admin when no admin exists", async () => {
        mockResolveAdminLoginVisibility.mockResolvedValue({
            kind: "success",
            value: false,
            elapsedMs: 0,
        });
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: PUBLIC_ADMIN_LOGIN_ROUTE });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen).toHavePathname(PUBLIC_CREATE_MASTER_ADMIN_ROUTE);
        });
        await expectResolverWiring(mockResolveAdminLoginVisibility, false);
    });
    it("retries admin-login guard after failure and renders login shell", async () => {
        mockHasAnyAdmin.mockResolvedValue(true);
        mockResolveAdminLoginVisibility
            .mockResolvedValueOnce({
            kind: "error",
            message: "We couldn't check local setup right now. Please retry.",
            elapsedMs: 50,
        })
            .mockResolvedValueOnce({
            kind: "success",
            value: true,
            elapsedMs: 0,
        });
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: PUBLIC_ADMIN_LOGIN_ROUTE });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByText("Unable to load entry gate")).toBeTruthy();
        });
        testing_library_1.fireEvent.press(testing_library_1.screen.getByText("Retry"));
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByText("Admin Login")).toBeTruthy();
        });
        await expectResolverWiring(mockResolveAdminLoginVisibility, true);
    });
    it("prioritizes authenticated-session redirect over login guard error state", async () => {
        mockHasAnyAdmin.mockResolvedValue(true);
        mockResolveAdminLoginVisibility.mockResolvedValue({
            kind: "error",
            message: "We couldn't check local setup right now. Please retry.",
            elapsedMs: 50,
        });
        (0, admin_session_1.setAdminSession)({ id: 1, username: "admin" });
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: PUBLIC_ADMIN_LOGIN_ROUTE });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen).toHavePathname(PUBLIC_ADMIN_DASHBOARD_ROUTE);
        });
        expect(testing_library_1.screen.queryByText("Unable to load entry gate")).toBeFalsy();
    });
    it("prioritizes authenticated-session redirect over login guard redirect", async () => {
        mockHasAnyAdmin.mockResolvedValue(false);
        mockResolveAdminLoginVisibility.mockResolvedValue({
            kind: "success",
            value: false,
            elapsedMs: 0,
        });
        (0, admin_session_1.setAdminSession)({ id: 1, username: "admin" });
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: PUBLIC_ADMIN_LOGIN_ROUTE });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen).toHavePathname(PUBLIC_ADMIN_DASHBOARD_ROUTE);
        });
    });
    it("renders login shell content when admin exists", async () => {
        mockHasAnyAdmin.mockResolvedValue(true);
        mockResolveAdminLoginVisibility.mockResolvedValue({
            kind: "success",
            value: true,
            elapsedMs: 0,
        });
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: PUBLIC_ADMIN_LOGIN_ROUTE });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByText("Admin Login")).toBeTruthy();
        });
        await expectResolverWiring(mockResolveAdminLoginVisibility, true);
    });
    it("submits login form and redirects to the protected dashboard on success", async () => {
        mockHasAnyAdmin.mockResolvedValue(true);
        mockResolveAdminLoginVisibility.mockResolvedValue({
            kind: "success",
            value: true,
            elapsedMs: 0,
        });
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: PUBLIC_ADMIN_LOGIN_ROUTE });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByLabelText("Username")).toBeTruthy();
        });
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Username"), "  MasterUser  ");
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Password"), "Password123!");
        testing_library_1.fireEvent.press(testing_library_1.screen.getByText("Sign In"));
        await (0, testing_library_1.waitFor)(() => {
            expect(mockAuthenticateAdmin).toHaveBeenCalledWith({
                username: "masteruser",
                password: "Password123!",
            });
        });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen).toHavePathname(PUBLIC_ADMIN_DASHBOARD_ROUTE);
        });
    });
    it("logs out from dashboard and returns to login", async () => {
        mockHasAnyAdmin.mockResolvedValue(true);
        mockResolveAdminLoginVisibility.mockResolvedValue({
            kind: "success",
            value: true,
            elapsedMs: 0,
        });
        const app = (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: PUBLIC_ADMIN_LOGIN_ROUTE });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByLabelText("Username")).toBeTruthy();
        });
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Username"), "masteruser");
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Password"), "Password123!");
        testing_library_1.fireEvent.press(testing_library_1.screen.getByText("Sign In"));
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen).toHavePathname(PUBLIC_ADMIN_DASHBOARD_ROUTE);
        });
        testing_library_1.fireEvent.press(testing_library_1.screen.getByLabelText("Log Out"));
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen).toHavePathname(PUBLIC_ADMIN_LOGIN_ROUTE);
        });
        expect(testing_library_1.screen.queryByText("Admin Dashboard")).toBeFalsy();
        expect(testing_library_1.testRouter.canGoBack()).toBe(false);
        app.unmount();
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: PUBLIC_ADMIN_DASHBOARD_ROUTE });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen).toHavePathname(PUBLIC_ADMIN_LOGIN_ROUTE);
        });
    });
    it("handles rapid logout taps with a single session clear", async () => {
        mockHasAnyAdmin.mockResolvedValue(true);
        mockResolveAdminLoginVisibility.mockResolvedValue({
            kind: "success",
            value: true,
            elapsedMs: 0,
        });
        const clearSessionSpy = jest.spyOn(adminSessionService, "clearAdminSession");
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: PUBLIC_ADMIN_LOGIN_ROUTE });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByLabelText("Username")).toBeTruthy();
        });
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Username"), "masteruser");
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Password"), "Password123!");
        testing_library_1.fireEvent.press(testing_library_1.screen.getByText("Sign In"));
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen).toHavePathname(PUBLIC_ADMIN_DASHBOARD_ROUTE);
        });
        const logoutButton = testing_library_1.screen.getByLabelText("Log Out");
        testing_library_1.fireEvent.press(logoutButton);
        testing_library_1.fireEvent.press(logoutButton);
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen).toHavePathname(PUBLIC_ADMIN_LOGIN_ROUTE);
        });
        expect(clearSessionSpy).toHaveBeenCalledTimes(1);
        clearSessionSpy.mockRestore();
    });
    it("prevents duplicate auth submits on rapid double tap", async () => {
        mockHasAnyAdmin.mockResolvedValue(true);
        mockResolveAdminLoginVisibility.mockResolvedValue({
            kind: "success",
            value: true,
            elapsedMs: 0,
        });
        let resolveAuthenticate;
        const pendingAuthenticate = new Promise((resolve) => {
            resolveAuthenticate = resolve;
        });
        mockAuthenticateAdmin.mockReturnValueOnce(pendingAuthenticate);
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: PUBLIC_ADMIN_LOGIN_ROUTE });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByLabelText("Username")).toBeTruthy();
        });
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Username"), "masteruser");
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Password"), "Password123!");
        const submitButton = testing_library_1.screen.getByText("Sign In");
        testing_library_1.fireEvent.press(submitButton);
        testing_library_1.fireEvent.press(submitButton);
        expect(mockAuthenticateAdmin).toHaveBeenCalledTimes(1);
        resolveAuthenticate?.({
            kind: "success",
            admin: {
                id: 1,
                username: "admin",
            },
        });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen).toHavePathname(PUBLIC_ADMIN_DASHBOARD_ROUTE);
        });
    });
    it("keeps the user on login and shows an error on invalid credentials", async () => {
        mockHasAnyAdmin.mockResolvedValue(true);
        mockResolveAdminLoginVisibility.mockResolvedValue({
            kind: "success",
            value: true,
            elapsedMs: 0,
        });
        mockAuthenticateAdmin.mockResolvedValueOnce({
            kind: "invalid-credentials",
            message: "Invalid username or password.",
        });
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: PUBLIC_ADMIN_LOGIN_ROUTE });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByLabelText("Username")).toBeTruthy();
        });
        testing_library_1.fireEvent.changeText(testing_library_1.screen.getByLabelText("Username"), "masteruser");
        const passwordInput = testing_library_1.screen.getByLabelText("Password");
        testing_library_1.fireEvent.changeText(passwordInput, "WrongPassword!");
        testing_library_1.fireEvent.press(testing_library_1.screen.getByText("Sign In"));
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen.getByText("Invalid username or password.")).toBeTruthy();
        });
        expect(testing_library_1.screen).toHavePathname(PUBLIC_ADMIN_LOGIN_ROUTE);
        expect(testing_library_1.screen.getByLabelText("Password").props.value).toBe("");
        expect(testing_library_1.screen.queryByDisplayValue("WrongPassword!")).toBeFalsy();
    });
    it("redirects logged-out direct dashboard access to login", async () => {
        mockHasAnyAdmin.mockResolvedValue(true);
        mockResolveAdminLoginVisibility.mockResolvedValue({
            kind: "success",
            value: true,
            elapsedMs: 0,
        });
        (0, testing_library_1.renderRouter)(ROUTES, { initialUrl: PUBLIC_ADMIN_DASHBOARD_ROUTE });
        await (0, testing_library_1.waitFor)(() => {
            expect(testing_library_1.screen).toHavePathname(PUBLIC_ADMIN_LOGIN_ROUTE);
        });
    });
});
