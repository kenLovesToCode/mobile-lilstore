import {
  fireEvent,
  renderRouter,
  screen,
  waitFor,
} from "expo-router/testing-library";

import {
  clearAdminSession,
  setAdminSession,
} from "@/domain/services/admin-session";

const mockHasAnyAdmin = jest.fn();
const mockResolveAdminLoginVisibility = jest.fn();
const mockAuthenticateAdmin = jest.fn();
const mockListOwners = jest.fn();
const mockCreateOwner = jest.fn();
const mockSwitchActiveOwner = jest.fn();

jest.mock("@/domain/services/auth-service", () => ({
  hasAnyAdmin: () => mockHasAnyAdmin(),
  authenticateAdmin: (...args: unknown[]) => mockAuthenticateAdmin(...args),
  normalizeAdminUsername: (value: string) => value.trim().toLowerCase(),
}));

jest.mock("@/domain/services/entry-gate-runtime", () => ({
  resolveAdminLoginVisibility: (...args: unknown[]) =>
    mockResolveAdminLoginVisibility(...args),
}));

jest.mock("@/domain/services/owner-service", () => ({
  listOwners: (...args: unknown[]) => mockListOwners(...args),
  createOwner: (...args: unknown[]) => mockCreateOwner(...args),
  switchActiveOwner: (...args: unknown[]) => mockSwitchActiveOwner(...args),
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
    clearAdminSession();
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
    setAdminSession({ id: 1, username: "admin" });

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

    renderRouter(ROUTES, { initialUrl: "/owners" });

    await waitFor(() => {
      expect(screen.getByText("Owners")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText("Owner Name"), "Downtown");
    fireEvent.press(screen.getByText("Create Owner"));

    await waitFor(() => {
      expect(mockCreateOwner).toHaveBeenCalledWith({ name: "Downtown" });
    });

    await waitFor(() => {
      expect(screen.getByText("Downtown")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Switch to Downtown"));

    await waitFor(() => {
      expect(mockSwitchActiveOwner).toHaveBeenCalledWith(2);
    });

    expect(screen.queryByText("Active owner: Downtown")).toBeFalsy();
  });

  it("shows no-owner guard on dashboard when no active owner exists", async () => {
    setAdminSession({ id: 1, username: "admin" });

    renderRouter(ROUTES, { initialUrl: "/dashboard" });

    await waitFor(() => {
      expect(screen.getByText("No active owner selected.")).toBeTruthy();
    });
    expect(screen.getByText("Go to Owners")).toBeTruthy();
  });
});
