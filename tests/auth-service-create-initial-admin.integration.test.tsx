import {
  createInitialMasterAdmin,
  normalizeAdminUsername,
} from "@/domain/services/auth-service";

const mockBootstrapDatabase = jest.fn();
const mockGetDb = jest.fn();
const mockUpdateEntryGateSnapshotAfterAdminChange = jest.fn();
const mockWarn = jest.spyOn(console, "warn").mockImplementation(() => {});

const mockTxn = {
  runAsync: jest.fn(),
};

const mockDb = {
  getFirstAsync: jest.fn(),
  withExclusiveTransactionAsync: jest.fn(
    async (task: (txn: typeof mockTxn) => Promise<void>) => {
      await task(mockTxn);
    },
  ),
};

jest.mock("@/db/db", () => ({
  bootstrapDatabase: (...args: unknown[]) => mockBootstrapDatabase(...args),
  getDb: (...args: unknown[]) => mockGetDb(...args),
}));

jest.mock("@/domain/services/entry-gate-runtime", () => ({
  updateEntryGateSnapshotAfterAdminChange: (...args: unknown[]) =>
    mockUpdateEntryGateSnapshotAfterAdminChange(...args),
}));

describe("createInitialMasterAdmin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetDb.mockReturnValue(mockDb);
    mockBootstrapDatabase.mockResolvedValue(undefined);
    mockDb.getFirstAsync.mockResolvedValue({ admin_count: 0 });
    mockTxn.runAsync.mockResolvedValue({ changes: 1, lastInsertRowId: 1 });
  });

  afterAll(() => {
    mockWarn.mockRestore();
  });

  it("creates the first admin record with normalized username and derived credential material", async () => {
    const result = await createInitialMasterAdmin({
      username: "  MasterUser  ",
      password: "Password123!",
      nowMs: 1700000000000,
    });

    expect(mockBootstrapDatabase).toHaveBeenCalled();
    expect(mockDb.getFirstAsync).toHaveBeenCalledWith(
      expect.stringContaining("SELECT COUNT(*) as admin_count"),
    );
    expect(mockDb.withExclusiveTransactionAsync).toHaveBeenCalled();
    expect(mockTxn.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO admin"),
      "masteruser",
      expect.stringMatching(/^scrypt\$N=\d+\$r=\d+\$p=\d+\$dkLen=\d+\$salt=.*\$hash=.*/),
      1700000000000,
      1700000000000,
    );
    const derivedStorageValue = mockTxn.runAsync.mock.calls.at(-1)?.[2];
    expect(typeof derivedStorageValue).toBe("string");
    expect(derivedStorageValue).not.toContain("Password123!");
    expect(derivedStorageValue).toContain("salt=");
    expect(derivedStorageValue).toContain("hash=");
    expect(mockUpdateEntryGateSnapshotAfterAdminChange).toHaveBeenCalledWith(
      true,
    );
    expect(result).toEqual({
      kind: "success",
      username: "masteruser",
      createdAtMs: 1700000000000,
    });
  });

  it("returns already-exists without deriving password when an admin already exists", async () => {
    mockDb.getFirstAsync.mockResolvedValue({ admin_count: 1 });

    const result = await createInitialMasterAdmin({
      username: "owner",
      password: "Password123!",
      nowMs: 1700000000000,
    });

    expect(mockDb.withExclusiveTransactionAsync).not.toHaveBeenCalled();
    expect(mockTxn.runAsync).not.toHaveBeenCalled();
    expect(mockUpdateEntryGateSnapshotAfterAdminChange).toHaveBeenCalledWith(
      true,
    );
    expect(result).toEqual({
      kind: "already-exists",
      message: "Admin setup is already complete. Please sign in.",
    });
  });

  it("returns already-exists when a concurrent creator wins first", async () => {
    mockTxn.runAsync.mockResolvedValueOnce({ changes: 0, lastInsertRowId: 0 });

    const result = await createInitialMasterAdmin({
      username: "owner",
      password: "Password123!",
      nowMs: 1700000000000,
    });

    expect(result).toEqual({
      kind: "already-exists",
      message: "Admin setup is already complete. Please sign in.",
    });
    expect(mockUpdateEntryGateSnapshotAfterAdminChange).toHaveBeenCalledWith(
      true,
    );
  });

  it("returns safe error when transaction fails", async () => {
    mockDb.withExclusiveTransactionAsync.mockRejectedValueOnce(
      new Error("database is locked"),
    );

    const result = await createInitialMasterAdmin({
      username: "owner",
      password: "Password123!",
    });

    expect(result).toEqual({
      kind: "error",
      message: "We couldn't create the admin account right now. Please retry.",
    });
    expect(mockWarn).toHaveBeenCalledWith(
      "[auth-service] createInitialMasterAdmin failed",
      { reason: "Error" },
    );
    expect(mockUpdateEntryGateSnapshotAfterAdminChange).not.toHaveBeenCalled();
  });

  it("normalizes admin usernames using trim + lowercase", () => {
    expect(normalizeAdminUsername("  MasterUser  ")).toBe("masteruser");
  });
});
