import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import {
  ADMIN_LOGIN_ROUTE,
  CREATE_MASTER_ADMIN_ROUTE,
} from "@/domain/services/entry-gate";

const PUBLIC_CREATE_MASTER_ADMIN_ROUTE = "/create-master-admin";
const PUBLIC_ADMIN_LOGIN_ROUTE = "/login";

const mockResolveEntryRouteFromAdminCheck = jest.fn();
const mockResolveCreateMasterAdminVisibility = jest.fn();
const mockResolveAdminLoginVisibility = jest.fn();
const mockHasAnyAdmin = jest.fn();

jest.mock("@/domain/services/auth-service", () => ({
  hasAnyAdmin: () => mockHasAnyAdmin(),
}));

jest.mock("@/domain/services/entry-gate-runtime", () => ({
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
  });

  it("routes first-run users to create-master-admin screen", async () => {
    mockResolveEntryRouteFromAdminCheck.mockResolvedValue({
      kind: "success",
      value: CREATE_MASTER_ADMIN_ROUTE,
      elapsedMs: 18,
    });

    renderRouter(ROUTES, { initialUrl: "/" });

    await waitFor(() => {
      expect(screen).toHavePathname(PUBLIC_CREATE_MASTER_ADMIN_ROUTE);
    });
    await expectResolverWiring(mockResolveEntryRouteFromAdminCheck, false);
  });

  it("routes returning admins to login screen", async () => {
    mockHasAnyAdmin.mockResolvedValue(true);
    mockResolveEntryRouteFromAdminCheck.mockResolvedValue({
      kind: "success",
      value: ADMIN_LOGIN_ROUTE,
      elapsedMs: 11,
    });

    renderRouter(ROUTES, { initialUrl: "/" });

    await waitFor(() => {
      expect(screen).toHavePathname(PUBLIC_ADMIN_LOGIN_ROUTE);
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
        value: ADMIN_LOGIN_ROUTE,
        elapsedMs: 90,
      });

    renderRouter(ROUTES, { initialUrl: "/" });

    await waitFor(() => {
      expect(screen.getByText("Unable to load entry gate")).toBeTruthy();
    });
    fireEvent.press(screen.getByText("Retry"));
    await waitFor(() => {
      expect(screen).toHavePathname(PUBLIC_ADMIN_LOGIN_ROUTE);
    });
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
    await expectResolverWiring(mockResolveCreateMasterAdminVisibility, false);
  });

  it("renders create-master-admin shell content when no admin exists", async () => {
    mockResolveCreateMasterAdminVisibility.mockResolvedValue({
      kind: "success",
      value: true,
      elapsedMs: 0,
    });

    renderRouter(ROUTES, { initialUrl: PUBLIC_CREATE_MASTER_ADMIN_ROUTE });

    await waitFor(() => {
      expect(screen.getByText("Create Master Admin")).toBeTruthy();
    });
    await expectResolverWiring(mockResolveCreateMasterAdminVisibility, false);
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
});
