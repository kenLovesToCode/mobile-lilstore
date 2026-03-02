import {
  ADMIN_LOGIN_ROUTE,
  CREATE_MASTER_ADMIN_ROUTE,
} from "@/domain/services/entry-gate";
import {
  DEFAULT_GATE_ERROR_MESSAGE,
  GATE_TIMEOUT_ERROR_MESSAGE,
  invalidateEntryGateSnapshot,
  resolveAdminLoginVisibility,
  resolveCreateMasterAdminVisibility,
  resolveEntryRouteFromAdminCheck,
  updateEntryGateSnapshotAfterAdminChange,
} from "@/domain/services/entry-gate-runtime";

describe("entry gate runtime", () => {
  beforeEach(() => {
    invalidateEntryGateSnapshot();
  });

  afterEach(() => {
    invalidateEntryGateSnapshot();
  });

  it("routes to create-master-admin when no admin exists", async () => {
    const result = await resolveEntryRouteFromAdminCheck(async () => false, {
      timeoutMs: 100,
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: "success",
        value: CREATE_MASTER_ADMIN_ROUTE,
      }),
    );
  });

  it("routes to admin login when at least one admin exists", async () => {
    const result = await resolveEntryRouteFromAdminCheck(async () => true, {
      timeoutMs: 100,
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: "success",
        value: ADMIN_LOGIN_ROUTE,
      }),
    );
  });

  it("uses gate snapshot for create-master-admin visibility", async () => {
    updateEntryGateSnapshotAfterAdminChange(true);
    const readHasAdmin = jest.fn(async () => false);

    const result = await resolveCreateMasterAdminVisibility(readHasAdmin, {
      snapshotMaxAgeMs: 1000,
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: "success",
        value: false,
      }),
    );
    expect(readHasAdmin).not.toHaveBeenCalled();
  });

  it("uses gate snapshot for login visibility", async () => {
    updateEntryGateSnapshotAfterAdminChange(true);
    const readHasAdmin = jest.fn(async () => false);

    const result = await resolveAdminLoginVisibility(readHasAdmin, {
      snapshotMaxAgeMs: 1000,
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: "success",
        value: true,
      }),
    );
    expect(readHasAdmin).not.toHaveBeenCalled();
  });

  it("returns timeout-safe error when admin check exceeds timeout", async () => {
    const result = await resolveEntryRouteFromAdminCheck(
      async () => new Promise<boolean>(() => {}),
      { timeoutMs: 5 },
    );

    expect(result).toEqual(
      expect.objectContaining({
        kind: "error",
        message: GATE_TIMEOUT_ERROR_MESSAGE,
      }),
    );
  });

  it("returns default safe error for unexpected failures", async () => {
    const result = await resolveEntryRouteFromAdminCheck(async () => {
      throw new Error("db unavailable");
    });

    expect(result).toEqual(
      expect.objectContaining({
        kind: "error",
        message: DEFAULT_GATE_ERROR_MESSAGE,
      }),
    );
  });
});
