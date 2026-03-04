import {
  fireEvent,
  renderRouter,
  screen,
  testRouter,
  waitFor,
} from "expo-router/testing-library";

import {
  clearShopperSession,
  getShopperSession,
  setShopperSession,
} from "@/domain/services/shopper-session";

const mockResolveShopperEntryByPin = jest.fn();
const mockResolveEntryRouteFromAdminCheck = jest.fn();
const mockHasAnyAdmin = jest.fn();

jest.mock("@/domain/services/shopper-service", () => ({
  resolveShopperEntryByPin: (...args: unknown[]) =>
    mockResolveShopperEntryByPin(...args),
}));

jest.mock("@/domain/services/entry-gate-runtime", () => ({
  DEFAULT_GATE_ERROR_MESSAGE:
    "We couldn't check local setup right now. Please retry.",
  resolveEntryRouteFromAdminCheck: (...args: unknown[]) =>
    mockResolveEntryRouteFromAdminCheck(...args),
}));

jest.mock("@/domain/services/auth-service", () => ({
  hasAnyAdmin: () => mockHasAnyAdmin(),
}));

const ROUTES = {
  _layout: require("../src/app/_layout").default,
  index: require("../src/app/index").default,
  "(shopper)/_layout": require("../src/app/(shopper)/_layout").default,
  "(shopper)/pin": require("../src/app/(shopper)/pin").default,
  "(shopper)/scan": require("../src/app/(shopper)/scan").default,
};

function enterPin(pin: string) {
  for (const digit of pin) {
    fireEvent.press(screen.getByLabelText(`PIN digit ${digit}`));
  }
}

describe("Shopper PIN entry integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearShopperSession();
    mockHasAnyAdmin.mockResolvedValue(true);
    mockResolveEntryRouteFromAdminCheck.mockResolvedValue({
      kind: "success",
      value: "/(admin)/login",
      elapsedMs: 0,
    });
    mockResolveShopperEntryByPin.mockResolvedValue({
      ok: true,
      value: {
        shopperId: 77,
        ownerId: 11,
        displayName: "Entry Shopper",
      },
    });
  });

  it("navigates from home Buy Now action to shopper PIN screen", async () => {
    renderRouter(ROUTES, { initialUrl: "/" });

    fireEvent.press(screen.getByText("Buy Now"));

    await waitFor(() => {
      expect(screen).toHavePathname("/pin");
      expect(screen.getByText("Enter your shopper PIN")).toBeTruthy();
    });
  });

  it("unlocks shopper session on valid PIN and navigates to scanner", async () => {
    renderRouter(ROUTES, { initialUrl: "/pin" });

    enterPin("1234");
    fireEvent.press(screen.getByLabelText("Unlock Shopper Session"));

    await waitFor(() => {
      expect(mockResolveShopperEntryByPin).toHaveBeenCalledWith("1234");
      expect(screen).toHavePathname("/scan");
    });

    const session = getShopperSession();
    expect(session).toMatchObject({
      shopperId: 77,
      ownerId: 11,
      displayName: "Entry Shopper",
    });
    expect(session).not.toHaveProperty("pin");
    expect(session).not.toHaveProperty("pinHash");
    expect(session).not.toHaveProperty("pinKey");
  });

  it("shows friendly message and stays on PIN screen when shopper is not found", async () => {
    mockResolveShopperEntryByPin.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "OWNER_SCOPE_NOT_FOUND",
        message: "No shopper was found for this PIN.",
      },
    });

    renderRouter(ROUTES, { initialUrl: "/pin" });

    enterPin("1234");
    fireEvent.press(screen.getByLabelText("Unlock Shopper Session"));

    await waitFor(() => {
      expect(screen.getByText("We couldn't match that PIN. Please try again.")).toBeTruthy();
      expect(screen).toHavePathname("/pin");
    });
    expect(getShopperSession()).toBeNull();
  });

  it("shows actionable message when PIN lookup is ambiguous", async () => {
    mockResolveShopperEntryByPin.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "OWNER_SCOPE_CONFLICT",
        message:
          "PIN lookup is ambiguous for this device. Reset shopper PINs before continuing.",
      },
    });

    renderRouter(ROUTES, { initialUrl: "/pin" });

    enterPin("1234");
    fireEvent.press(screen.getByLabelText("Unlock Shopper Session"));

    await waitFor(() => {
      expect(
        screen.getByText(
          "That PIN matches multiple shoppers. Ask an admin to reset shopper PINs, then try again.",
        ),
      ).toBeTruthy();
      expect(screen).toHavePathname("/pin");
    });
    expect(getShopperSession()).toBeNull();
  });

  it("handles explicit invalid-input responses with clear recovery guidance", async () => {
    mockResolveShopperEntryByPin.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "OWNER_SCOPE_INVALID_INPUT",
        message: "Shopper PIN must be at least 4 digits.",
      },
    });

    renderRouter(ROUTES, { initialUrl: "/pin" });

    enterPin("1234");
    fireEvent.press(screen.getByLabelText("Unlock Shopper Session"));

    await waitFor(() => {
      expect(screen.getByText("Enter at least 4 digits to continue.")).toBeTruthy();
      expect(screen).toHavePathname("/pin");
    });
  });

  it("shows safe fallback message when PIN lookup throws unexpectedly", async () => {
    setShopperSession({
      shopperId: 99,
      ownerId: 33,
      displayName: "Existing Session",
      startedAtMs: 1234,
    });
    mockResolveShopperEntryByPin.mockRejectedValueOnce(new Error("db read failed"));

    renderRouter(ROUTES, { initialUrl: "/pin" });

    enterPin("1234");
    fireEvent.press(screen.getByLabelText("Unlock Shopper Session"));

    await waitFor(() => {
      expect(
        screen.getByText("We couldn't unlock your session right now. Please try again."),
      ).toBeTruthy();
      expect(screen).toHavePathname("/pin");
    });
    expect(getShopperSession()).toBeNull();
  });

  it("prevents duplicate concurrent PIN lookup submits", async () => {
    type PendingLookupResult = {
      ok: true;
      value: {
        shopperId: number;
        ownerId: number;
        displayName: string;
      };
    };
    let resolveLookup: ((value: PendingLookupResult) => void) | undefined;
    const pendingLookup = new Promise<PendingLookupResult>((resolve) => {
      resolveLookup = resolve;
    });
    mockResolveShopperEntryByPin.mockReturnValueOnce(pendingLookup);

    renderRouter(ROUTES, { initialUrl: "/pin" });

    enterPin("1234");
    const submit = screen.getByLabelText("Unlock Shopper Session");
    fireEvent.press(submit);
    fireEvent.press(submit);

    expect(mockResolveShopperEntryByPin).toHaveBeenCalledTimes(1);

    resolveLookup?.({
      ok: true,
      value: {
        shopperId: 77,
        ownerId: 11,
        displayName: "Entry Shopper",
      },
    });

    await waitFor(() => {
      expect(screen).toHavePathname("/scan");
    });
  });

  it("redirects /scan to /pin when shopper session is missing", async () => {
    renderRouter(ROUTES, { initialUrl: "/scan" });

    await waitFor(() => {
      expect(screen).toHavePathname("/pin");
    });
  });

  it("renders scanner placeholder when shopper session is active", async () => {
    setShopperSession({
      shopperId: 77,
      ownerId: 11,
      displayName: "Entry Shopper",
      startedAtMs: 1234,
    });

    renderRouter(ROUTES, { initialUrl: "/scan" });

    await waitFor(() => {
      expect(screen.getByText("Scanner coming soon")).toBeTruthy();
      expect(screen.getByText("Entry Shopper")).toBeTruthy();
      expect(screen).toHavePathname("/scan");
    });
  });

  it("clears shopper session when canceling out of scanner flow", async () => {
    setShopperSession({
      shopperId: 77,
      ownerId: 11,
      displayName: "Entry Shopper",
      startedAtMs: 1234,
    });

    renderRouter(ROUTES, { initialUrl: "/scan" });

    await waitFor(() => {
      expect(screen.getByText("Scanner coming soon")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Use Different Shopper"));

    await waitFor(() => {
      expect(screen).toHavePathname("/pin");
    });
    expect(getShopperSession()).toBeNull();
  });

  it("clears shopper session when leaving scanner flow with back navigation", async () => {
    renderRouter(ROUTES, { initialUrl: "/" });

    fireEvent.press(screen.getByText("Buy Now"));
    await waitFor(() => {
      expect(screen).toHavePathname("/pin");
    });

    enterPin("1234");
    fireEvent.press(screen.getByLabelText("Unlock Shopper Session"));

    await waitFor(() => {
      expect(screen).toHavePathname("/scan");
    });
    expect(getShopperSession()).toMatchObject({
      shopperId: 77,
      ownerId: 11,
      displayName: "Entry Shopper",
    });

    testRouter.back("/");

    await waitFor(() => {
      expect(screen).toHavePathname("/");
    });
    expect(getShopperSession()).toBeNull();
  });
});
