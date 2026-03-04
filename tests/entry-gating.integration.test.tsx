import {
  fireEvent,
  renderRouter,
  screen,
  testRouter,
  waitFor,
} from "expo-router/testing-library";

import {
  ADMIN_LOGIN_ROUTE,
  CREATE_MASTER_ADMIN_ROUTE,
} from "@/domain/services/entry-gate";
import * as adminSessionService from "@/domain/services/admin-session";
import { clearAdminSession, setAdminSession } from "@/domain/services/admin-session";

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
  createInitialMasterAdmin: (...args: unknown[]) =>
    mockCreateInitialMasterAdmin(...args),
  authenticateAdmin: (...args: unknown[]) => mockAuthenticateAdmin(...args),
  normalizeAdminUsername: (value: string) => value.trim().toLowerCase(),
}));

jest.mock("@/domain/services/entry-gate-runtime", () => ({
  DEFAULT_GATE_ERROR_MESSAGE:
    "We couldn't check local setup right now. Please retry.",
  resolveEntryRouteFromAdminCheck: (...args: unknown[]) =>
    mockResolveEntryRouteFromAdminCheck(...args),
  resolveCreateMasterAdminVisibility: (...args: unknown[]) =>
    mockResolveCreateMasterAdminVisibility(...args),
  resolveAdminLoginVisibility: (...args: unknown[]) =>
    mockResolveAdminLoginVisibility(...args),
}));

const ROUTES = {
  _layout: require("../src/app/_layout").default,
  index: require("../src/app/index").default,
  "(admin)/_layout": require("../src/app/(admin)/_layout").default,
  "(admin)/create-master-admin": require("../src/app/(admin)/create-master-admin").default,
  "(admin)/login": require("../src/app/(admin)/login").default,
  "(admin)/dashboard": require("../src/app/(admin)/dashboard").default,
};

async function expectResolverWiring(
  resolverMock: jest.Mock,
  expectedAdminExists: boolean,
) {
  expect(resolverMock).toHaveBeenCalled();
  const [readHasAdmin] = resolverMock.mock.calls.at(-1) ?? [];
  expect(typeof readHasAdmin).toBe("function");
  await expect(readHasAdmin()).resolves.toBe(expectedAdminExists);
  expect(mockHasAnyAdmin).toHaveBeenCalled();
}

describe("Entry gate router integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAdminSession();
    mockHasAnyAdmin.mockResolvedValue(false);
    mockResolveEntryRouteFromAdminCheck.mockResolvedValue({
      kind: "success",
      value: CREATE_MASTER_ADMIN_ROUTE,
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

  it("renders home screen with Buy Now and Admin actions", async () => {
    renderRouter(ROUTES, { initialUrl: "/" });

    await waitFor(() => {
      expect(screen.getByText("Buy Now")).toBeTruthy();
      expect(screen.getByText("Admin")).toBeTruthy();
    });
    expect(screen).toHavePathname("/");
    expect(mockResolveEntryRouteFromAdminCheck).not.toHaveBeenCalled();
  });

  it("shows safe message when admin route resolution throws", async () => {
    mockResolveEntryRouteFromAdminCheck.mockRejectedValueOnce(
      new Error("network dropped"),
    );

    renderRouter(ROUTES, { initialUrl: "/" });

    fireEvent.press(screen.getByText("Admin"));

    await waitFor(() => {
      expect(
        screen.getByText("We couldn't check local setup right now. Please retry."),
      ).toBeTruthy();
      expect(screen).toHavePathname("/");
    });
  });

  it("routes first-run admins from home to create-master-admin", async () => {
    mockResolveEntryRouteFromAdminCheck.mockResolvedValue({
      kind: "success",
      value: CREATE_MASTER_ADMIN_ROUTE,
      elapsedMs: 18,
    });

    renderRouter(ROUTES, { initialUrl: "/" });

    fireEvent.press(screen.getByText("Admin"));

    await waitFor(() => {
      expect(screen).toHavePathname(PUBLIC_CREATE_MASTER_ADMIN_ROUTE);
    });
    await expectResolverWiring(mockResolveEntryRouteFromAdminCheck, false);
  });

  it("routes returning admins from home to login", async () => {
    mockHasAnyAdmin.mockResolvedValue(true);
    mockResolveEntryRouteFromAdminCheck.mockResolvedValue({
      kind: "success",
      value: ADMIN_LOGIN_ROUTE,
      elapsedMs: 11,
    });

    renderRouter(ROUTES, { initialUrl: "/" });

    fireEvent.press(screen.getByText("Admin"));

    await waitFor(() => {
      expect(screen).toHavePathname(PUBLIC_ADMIN_LOGIN_ROUTE);
    });
    await expectResolverWiring(mockResolveEntryRouteFromAdminCheck, true);
  });

  it("redirects create-master-admin shell to login when admin already exists", async () => {
    mockHasAnyAdmin.mockResolvedValue(true);
    mockResolveCreateMasterAdminVisibility.mockResolvedValue({
      kind: "success",
      value: false,
      elapsedMs: 0,
    });

    renderRouter(ROUTES, { initialUrl: PUBLIC_CREATE_MASTER_ADMIN_ROUTE });

    await waitFor(() => {
      expect(screen).toHavePathname(PUBLIC_ADMIN_LOGIN_ROUTE);
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

    renderRouter(ROUTES, { initialUrl: PUBLIC_CREATE_MASTER_ADMIN_ROUTE });

    await waitFor(() => {
      expect(screen.getByText("Unable to load entry gate")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Retry"));
    await waitFor(() => {
      expect(screen.getByText("Create Master Admin")).toBeTruthy();
    });
    expect(screen.getByLabelText("Username")).toBeTruthy();
    await expectResolverWiring(mockResolveCreateMasterAdminVisibility, false);
  });

  it("renders create-master-admin form content when no admin exists", async () => {
    mockResolveCreateMasterAdminVisibility.mockResolvedValue({
      kind: "success",
      value: true,
      elapsedMs: 0,
    });

    renderRouter(ROUTES, { initialUrl: PUBLIC_CREATE_MASTER_ADMIN_ROUTE });

    await waitFor(() => {
      expect(screen.getByText("Create Master Admin")).toBeTruthy();
    });
    expect(screen.getByLabelText("Username")).toBeTruthy();
    expect(screen.getByLabelText("Password")).toBeTruthy();
    expect(screen.getByLabelText("Confirm Password")).toBeTruthy();
    expect(screen.getByText("Create Admin Account")).toBeTruthy();
    await expectResolverWiring(mockResolveCreateMasterAdminVisibility, false);
  });

  it("submits create-master-admin form and routes to login on success", async () => {
    renderRouter(ROUTES, { initialUrl: PUBLIC_CREATE_MASTER_ADMIN_ROUTE });

    await waitFor(() => {
      expect(screen.getByLabelText("Username")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText("Username"), "  MasterUser  ");
    fireEvent.changeText(screen.getByLabelText("Password"), "Password123!");
    fireEvent.changeText(screen.getByLabelText("Confirm Password"), "Password123!");
    fireEvent.press(screen.getByText("Create Admin Account"));

    await waitFor(() => {
      expect(mockCreateInitialMasterAdmin).toHaveBeenCalledWith({
        username: "masteruser",
        password: "Password123!",
      });
    });

    await waitFor(() => {
      expect(screen).toHavePathname(PUBLIC_ADMIN_LOGIN_ROUTE);
    });
  });

  it("shows user-safe validation message when form fields are invalid", async () => {
    renderRouter(ROUTES, { initialUrl: PUBLIC_CREATE_MASTER_ADMIN_ROUTE });

    await waitFor(() => {
      expect(screen.getByLabelText("Username")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText("Username"), "owner");
    fireEvent.changeText(screen.getByLabelText("Password"), "Password123!");
    fireEvent.changeText(screen.getByLabelText("Confirm Password"), "Mismatch!");
    fireEvent.press(screen.getByText("Create Admin Account"));

    await waitFor(() => {
      expect(screen.getByText("Password and confirmation must match.")).toBeTruthy();
    });
    expect(mockCreateInitialMasterAdmin).not.toHaveBeenCalled();
    expect(screen).toHavePathname(PUBLIC_CREATE_MASTER_ADMIN_ROUTE);
  });

  it("redirects to login when service reports setup already complete", async () => {
    mockCreateInitialMasterAdmin.mockResolvedValue({
      kind: "already-exists",
      message: "Admin setup is already complete. Please sign in.",
    });

    renderRouter(ROUTES, { initialUrl: PUBLIC_CREATE_MASTER_ADMIN_ROUTE });

    await waitFor(() => {
      expect(screen.getByLabelText("Username")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText("Username"), "owner");
    fireEvent.changeText(screen.getByLabelText("Password"), "Password123!");
    fireEvent.changeText(screen.getByLabelText("Confirm Password"), "Password123!");
    fireEvent.press(screen.getByText("Create Admin Account"));

    await waitFor(() => {
      expect(screen).toHavePathname(PUBLIC_ADMIN_LOGIN_ROUTE);
    });
  });

  it("shows a safe failure message when create-admin service fails", async () => {
    mockCreateInitialMasterAdmin.mockResolvedValue({
      kind: "error",
      message: "We couldn't create the admin account right now. Please retry.",
    });

    renderRouter(ROUTES, { initialUrl: PUBLIC_CREATE_MASTER_ADMIN_ROUTE });

    await waitFor(() => {
      expect(screen.getByLabelText("Username")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText("Username"), "owner");
    fireEvent.changeText(screen.getByLabelText("Password"), "Password123!");
    fireEvent.changeText(screen.getByLabelText("Confirm Password"), "Password123!");
    fireEvent.press(screen.getByText("Create Admin Account"));

    await waitFor(() => {
      expect(
        screen.getByText("We couldn't create the admin account right now. Please retry."),
      ).toBeTruthy();
    });
    expect(screen).toHavePathname(PUBLIC_CREATE_MASTER_ADMIN_ROUTE);
  });

  it("clears plaintext password fields after invalid submit attempt", async () => {
    renderRouter(ROUTES, { initialUrl: PUBLIC_CREATE_MASTER_ADMIN_ROUTE });

    await waitFor(() => {
      expect(screen.getByLabelText("Username")).toBeTruthy();
    });

    const passwordInput = screen.getByLabelText("Password");
    const confirmPasswordInput = screen.getByLabelText("Confirm Password");

    fireEvent.changeText(screen.getByLabelText("Username"), "owner");
    fireEvent.changeText(passwordInput, "Password123!");
    fireEvent.changeText(confirmPasswordInput, "Mismatch!");
    fireEvent.press(screen.getByText("Create Admin Account"));

    await waitFor(() => {
      expect(screen.getByText("Password and confirmation must match.")).toBeTruthy();
    });

    expect(screen.queryByDisplayValue("Password123!")).toBeFalsy();
    expect(screen.queryByDisplayValue("Mismatch!")).toBeFalsy();
  });

  it("redirects login shell to create-master-admin when no admin exists", async () => {
    mockResolveAdminLoginVisibility.mockResolvedValue({
      kind: "success",
      value: false,
      elapsedMs: 0,
    });

    renderRouter(ROUTES, { initialUrl: PUBLIC_ADMIN_LOGIN_ROUTE });

    await waitFor(() => {
      expect(screen).toHavePathname(PUBLIC_CREATE_MASTER_ADMIN_ROUTE);
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

    renderRouter(ROUTES, { initialUrl: PUBLIC_ADMIN_LOGIN_ROUTE });

    await waitFor(() => {
      expect(screen.getByText("Unable to load entry gate")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Retry"));
    await waitFor(() => {
      expect(screen.getByText("Admin Login")).toBeTruthy();
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
    setAdminSession({ id: 1, username: "admin" });

    renderRouter(ROUTES, { initialUrl: PUBLIC_ADMIN_LOGIN_ROUTE });

    await waitFor(() => {
      expect(screen).toHavePathname(PUBLIC_ADMIN_DASHBOARD_ROUTE);
    });
    expect(screen.queryByText("Unable to load entry gate")).toBeFalsy();
  });

  it("prioritizes authenticated-session redirect over login guard redirect", async () => {
    mockHasAnyAdmin.mockResolvedValue(false);
    mockResolveAdminLoginVisibility.mockResolvedValue({
      kind: "success",
      value: false,
      elapsedMs: 0,
    });
    setAdminSession({ id: 1, username: "admin" });

    renderRouter(ROUTES, { initialUrl: PUBLIC_ADMIN_LOGIN_ROUTE });

    await waitFor(() => {
      expect(screen).toHavePathname(PUBLIC_ADMIN_DASHBOARD_ROUTE);
    });
  });

  it("renders login shell content when admin exists", async () => {
    mockHasAnyAdmin.mockResolvedValue(true);
    mockResolveAdminLoginVisibility.mockResolvedValue({
      kind: "success",
      value: true,
      elapsedMs: 0,
    });

    renderRouter(ROUTES, { initialUrl: PUBLIC_ADMIN_LOGIN_ROUTE });

    await waitFor(() => {
      expect(screen.getByText("Admin Login")).toBeTruthy();
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

    renderRouter(ROUTES, { initialUrl: PUBLIC_ADMIN_LOGIN_ROUTE });

    await waitFor(() => {
      expect(screen.getByLabelText("Username")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText("Username"), "  MasterUser  ");
    fireEvent.changeText(screen.getByLabelText("Password"), "Password123!");
    fireEvent.press(screen.getByText("Sign In"));

    await waitFor(() => {
      expect(mockAuthenticateAdmin).toHaveBeenCalledWith({
        username: "masteruser",
        password: "Password123!",
      });
    });

    await waitFor(() => {
      expect(screen).toHavePathname(PUBLIC_ADMIN_DASHBOARD_ROUTE);
    });
  });

  it("logs out from dashboard and returns to login", async () => {
    mockHasAnyAdmin.mockResolvedValue(true);
    mockResolveAdminLoginVisibility.mockResolvedValue({
      kind: "success",
      value: true,
      elapsedMs: 0,
    });

    const app = renderRouter(ROUTES, { initialUrl: PUBLIC_ADMIN_LOGIN_ROUTE });

    await waitFor(() => {
      expect(screen.getByLabelText("Username")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText("Username"), "masteruser");
    fireEvent.changeText(screen.getByLabelText("Password"), "Password123!");
    fireEvent.press(screen.getByText("Sign In"));

    await waitFor(() => {
      expect(screen).toHavePathname(PUBLIC_ADMIN_DASHBOARD_ROUTE);
    });

    fireEvent.press(screen.getByLabelText("Log Out"));

    await waitFor(() => {
      expect(screen).toHavePathname(PUBLIC_ADMIN_LOGIN_ROUTE);
    });
    expect(screen.queryByText("Admin Dashboard")).toBeFalsy();

    expect(testRouter.canGoBack()).toBe(false);

    app.unmount();
    renderRouter(ROUTES, { initialUrl: PUBLIC_ADMIN_DASHBOARD_ROUTE });
    await waitFor(() => {
      expect(screen).toHavePathname(PUBLIC_ADMIN_LOGIN_ROUTE);
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

    renderRouter(ROUTES, { initialUrl: PUBLIC_ADMIN_LOGIN_ROUTE });

    await waitFor(() => {
      expect(screen.getByLabelText("Username")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText("Username"), "masteruser");
    fireEvent.changeText(screen.getByLabelText("Password"), "Password123!");
    fireEvent.press(screen.getByText("Sign In"));

    await waitFor(() => {
      expect(screen).toHavePathname(PUBLIC_ADMIN_DASHBOARD_ROUTE);
    });

    const logoutButton = screen.getByLabelText("Log Out");
    fireEvent.press(logoutButton);
    fireEvent.press(logoutButton);

    await waitFor(() => {
      expect(screen).toHavePathname(PUBLIC_ADMIN_LOGIN_ROUTE);
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

    type PendingAuthenticateResult = {
      kind: "success";
      admin: {
        id: number;
        username: string;
      };
    };

    let resolveAuthenticate:
      | ((result: PendingAuthenticateResult) => void)
      | undefined;
    const pendingAuthenticate = new Promise<PendingAuthenticateResult>(
      (resolve) => {
      resolveAuthenticate = resolve;
      },
    );
    mockAuthenticateAdmin.mockReturnValueOnce(pendingAuthenticate);

    renderRouter(ROUTES, { initialUrl: PUBLIC_ADMIN_LOGIN_ROUTE });

    await waitFor(() => {
      expect(screen.getByLabelText("Username")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText("Username"), "masteruser");
    fireEvent.changeText(screen.getByLabelText("Password"), "Password123!");

    const submitButton = screen.getByText("Sign In");
    fireEvent.press(submitButton);
    fireEvent.press(submitButton);

    expect(mockAuthenticateAdmin).toHaveBeenCalledTimes(1);

    resolveAuthenticate?.({
      kind: "success",
      admin: {
        id: 1,
        username: "admin",
      },
    });

    await waitFor(() => {
      expect(screen).toHavePathname(PUBLIC_ADMIN_DASHBOARD_ROUTE);
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

    renderRouter(ROUTES, { initialUrl: PUBLIC_ADMIN_LOGIN_ROUTE });

    await waitFor(() => {
      expect(screen.getByLabelText("Username")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText("Username"), "masteruser");
    const passwordInput = screen.getByLabelText("Password");
    fireEvent.changeText(passwordInput, "WrongPassword!");
    fireEvent.press(screen.getByText("Sign In"));

    await waitFor(() => {
      expect(screen.getByText("Invalid username or password.")).toBeTruthy();
    });
    expect(screen).toHavePathname(PUBLIC_ADMIN_LOGIN_ROUTE);
    expect((screen.getByLabelText("Password") as { props: { value: string } }).props.value).toBe("");
    expect(screen.queryByDisplayValue("WrongPassword!")).toBeFalsy();
  });

  it("redirects logged-out direct dashboard access to login", async () => {
    mockHasAnyAdmin.mockResolvedValue(true);
    mockResolveAdminLoginVisibility.mockResolvedValue({
      kind: "success",
      value: true,
      elapsedMs: 0,
    });

    renderRouter(ROUTES, { initialUrl: PUBLIC_ADMIN_DASHBOARD_ROUTE });

    await waitFor(() => {
      expect(screen).toHavePathname(PUBLIC_ADMIN_LOGIN_ROUTE);
    });
  });
});
