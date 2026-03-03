const mockBootstrapDatabase = jest.fn();
const mockGetDb = jest.fn();
const mockWarn = jest.spyOn(console, "warn").mockImplementation(() => {});

const mockDb = {
  getAllAsync: jest.fn(),
  getFirstAsync: jest.fn(),
  runAsync: jest.fn(),
};

jest.mock("@/db/db", () => ({
  bootstrapDatabase: (...args: unknown[]) => mockBootstrapDatabase(...args),
  getDb: (...args: unknown[]) => mockGetDb(...args),
}));

describe("owner-scoped services", () => {
  let session: typeof import("@/domain/services/admin-session");
  let productService: typeof import("@/domain/services/product-service");
  let shoppingListService: typeof import("@/domain/services/shopping-list-service");
  let ledgerService: typeof import("@/domain/services/ledger-service");
  let shopperService: typeof import("@/domain/services/shopper-service");

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockBootstrapDatabase.mockResolvedValue(undefined);
    mockGetDb.mockReturnValue(mockDb);
    mockDb.getAllAsync.mockResolvedValue([]);
    mockDb.getFirstAsync.mockImplementation((query: string) => {
      if (query.includes("FROM app_secret")) {
        return Promise.resolve({ value: "00112233445566778899aabbccddeeff" });
      }
      return Promise.resolve(null);
    });
    mockDb.runAsync.mockResolvedValue({ changes: 1, lastInsertRowId: 1 });

    session = require("@/domain/services/admin-session");
    session.clearAdminSession();
    session.setAdminSession({ id: 1, username: "admin" });
    session.setActiveOwner({ id: 11, name: "Owner A" });

    productService = require("@/domain/services/product-service");
    shopperService = require("@/domain/services/shopper-service");
    shoppingListService = require("@/domain/services/shopping-list-service");
    ledgerService = require("@/domain/services/ledger-service");
  });

  afterAll(() => {
    mockWarn.mockRestore();
  });

  it("enforces owner-scoped reads for products", async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      {
        id: 1,
        owner_id: 11,
        name: "Milk",
        barcode: "A-1",
        created_at_ms: 1,
        updated_at_ms: 1,
      },
    ]);

    const result = await productService.listProducts();

    expect(result.ok).toBe(true);
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("WHERE owner_id = ?"),
      11,
    );
  });

  it("does not expose shopper pin data in read models", async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      {
        id: 5,
        owner_id: 11,
        name: "Shopper A",
        created_at_ms: 1,
        updated_at_ms: 1,
      },
    ]);

    const result = await shopperService.listShoppers();

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]).toEqual({
        id: 5,
        ownerId: 11,
        name: "Shopper A",
        createdAtMs: 1,
        updatedAtMs: 1,
      });
      expect((result.value[0] as { pin?: string }).pin).toBeUndefined();
    }
  });

  it("rejects cross-owner product edits", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 33,
      owner_id: 99,
      name: "Owner B product",
      barcode: "B-1",
      created_at_ms: 1,
      updated_at_ms: 1,
    });

    const result = await productService.updateProduct({
      productId: 33,
      name: "Edited",
      barcode: "B-1",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_MISMATCH",
        message: "The requested record belongs to a different owner.",
      },
    });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("rejects adding shopping-list items that reference another owner's product", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      owner_id: 99,
    });

    const result = await shoppingListService.addShoppingListItem({
      productId: 444,
      quantity: 1,
      unitPriceCents: 100,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_MISMATCH",
        message: "The requested record belongs to a different owner.",
      },
    });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("rejects payments when shopper belongs to a different owner", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      owner_id: 99,
    });

    const result = await ledgerService.recordPayment({
      shopperId: 900,
      amountCents: 200,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_MISMATCH",
        message: "The requested record belongs to a different owner.",
      },
    });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("rejects purchases when shopper belongs to a different owner", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      owner_id: 99,
    });

    const result = await ledgerService.recordPurchase({
      shopperId: 900,
      totalCents: 200,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_MISMATCH",
        message: "The requested record belongs to a different owner.",
      },
    });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("rejects cross-owner shopper edits", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 51,
      owner_id: 99,
      name: "Owner B shopper",
      created_at_ms: 1,
      updated_at_ms: 1,
    });

    const result = await shopperService.updateShopper({
      shopperId: 51,
      name: "Edited",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_MISMATCH",
        message: "The requested record belongs to a different owner.",
      },
    });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("returns conflict error for duplicate barcode", async () => {
    mockDb.runAsync.mockRejectedValueOnce(
      new Error("UNIQUE constraint failed: product.owner_id, product.barcode"),
    );

    const result = await productService.createProduct({
      name: "Milk",
      barcode: "A-1",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_CONFLICT",
        message: "A product with this barcode already exists for the active owner.",
      },
    });
  });

  it("stores derived shopper pin payload instead of plaintext pin digits", async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({ value: "00112233445566778899aabbccddeeff" })
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 90,
        owner_id: 11,
        name: "Shopper A",
        created_at_ms: 1,
        updated_at_ms: 1,
      });

    const result = await shopperService.createShopper({
      name: "Shopper A",
      pin: "1234",
    });

    expect(result.ok).toBe(true);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("pin_hash, pin_key, pin"),
      11,
      "Shopper A",
      expect.stringContaining("scrypt$"),
      expect.stringMatching(/^[0-9a-f]+$/),
      expect.any(Number),
      expect.any(Number),
    );
    const pinHashArg = mockDb.runAsync.mock.calls[0]?.[3];
    const pinKeyArg = mockDb.runAsync.mock.calls[0]?.[4];
    expect(pinHashArg).not.toBe("1234");
    expect(pinKeyArg).not.toBe("1234");
  });

  it("returns conflict error for duplicate shopper pin across different owners", async () => {
    mockDb.runAsync.mockRejectedValueOnce(
      new Error("UNIQUE constraint failed: shopper.pin_key"),
    );

    const result = await shopperService.createShopper({
      name: "Shopper A",
      pin: "1234",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_CONFLICT",
        message: "A shopper with this PIN already exists on this device.",
      },
    });
  });

  it("blocks create when legacy hash-only shopper already matches the same pin", async () => {
    const { deriveShopperPinCredentialMaterial } = require(
      "@/domain/services/password-derivation"
    );
    const legacyMaterial = await deriveShopperPinCredentialMaterial(
      "1234",
      "00112233445566778899aabbccddeeff",
    );

    mockDb.getAllAsync.mockResolvedValueOnce([
      {
        id: 444,
        pin_hash: legacyMaterial.storageValue,
      },
    ]);

    const result = await shopperService.createShopper({
      name: "Shopper A",
      pin: "1234",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_CONFLICT",
        message: "A shopper with this PIN already exists on this device.",
      },
    });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("blocks shopper update when the next pin conflicts device-wide", async () => {
    mockDb.getFirstAsync.mockImplementation((query: string) => {
      if (query.includes("FROM app_secret")) {
        return Promise.resolve({ value: "00112233445566778899aabbccddeeff" });
      }
      if (query.includes("WHERE pin = ?")) {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        id: 51,
        owner_id: 11,
        name: "Owner A shopper",
        created_at_ms: 1,
        updated_at_ms: 1,
      });
    });
    mockDb.runAsync.mockRejectedValueOnce(
      new Error("UNIQUE constraint failed: shopper.pin_key"),
    );

    const result = await shopperService.updateShopper({
      shopperId: 51,
      name: "Renamed Shopper",
      pin: "1234",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_CONFLICT",
        message: "A shopper with this PIN already exists on this device.",
      },
    });
  });

  it("looks up a shopper by pin across owners and returns only session-safe identity fields", async () => {
    mockDb.getAllAsync
      .mockResolvedValueOnce([
        {
          id: 55,
          owner_id: 99,
          name: "Owner B Shopper",
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await shopperService.lookupShopperByPin("1234");

    expect(result).toEqual({
      ok: true,
      value: {
        shopperId: 55,
        ownerId: 99,
        displayName: "Owner B Shopper",
      },
    });
    if (result.ok) {
      expect((result.value as { pinHash?: string }).pinHash).toBeUndefined();
      expect((result.value as { pinKey?: string }).pinKey).toBeUndefined();
    }
  });

  it("supports shopper entry lookup via dedicated consumer path", async () => {
    mockDb.getAllAsync
      .mockResolvedValueOnce([
        {
          id: 77,
          owner_id: 11,
          name: "Entry Shopper",
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await shopperService.resolveShopperEntryByPin("5678");

    expect(result).toEqual({
      ok: true,
      value: {
        shopperId: 77,
        ownerId: 11,
        displayName: "Entry Shopper",
      },
    });
  });

  it("rejects invalid pin format for shopper lookup", async () => {
    const result = await shopperService.lookupShopperByPin("12a");

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_INVALID_INPUT",
        message: "Shopper PIN must be at least 4 digits.",
      },
    });
    expect(mockBootstrapDatabase).not.toHaveBeenCalled();
    expect(mockDb.getAllAsync).not.toHaveBeenCalled();
  });

  it("returns not-found when shopper pin lookup has no match", async () => {
    mockDb.getAllAsync
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await shopperService.lookupShopperByPin("1234");

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_NOT_FOUND",
        message: "No shopper was found for this PIN.",
      },
    });
  });

  it("matches legacy plaintext shopper rows during lookup", async () => {
    mockDb.getAllAsync
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 909,
          owner_id: 7,
          name: "Legacy Plaintext Shopper",
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await shopperService.lookupShopperByPin("1234");

    expect(result).toEqual({
      ok: true,
      value: {
        shopperId: 909,
        ownerId: 7,
        displayName: "Legacy Plaintext Shopper",
      },
    });
  });

  it("matches legacy hash-only shopper rows during lookup", async () => {
    const { deriveShopperPinCredentialMaterial } = require(
      "@/domain/services/password-derivation"
    );
    const legacyMaterial = await deriveShopperPinCredentialMaterial(
      "1234",
      "00112233445566778899aabbccddeeff",
    );
    mockDb.getAllAsync
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 808,
          owner_id: 42,
          name: "Legacy Hash Shopper",
          pin_hash: legacyMaterial.storageValue,
        },
      ])
      .mockResolvedValueOnce([]);

    const result = await shopperService.lookupShopperByPin("1234");

    expect(result).toEqual({
      ok: true,
      value: {
        shopperId: 808,
        ownerId: 42,
        displayName: "Legacy Hash Shopper",
      },
    });
  });

  it("fails safely when lookup detects multiple shopper matches for one pin", async () => {
    mockDb.getAllAsync
      .mockResolvedValueOnce([
        {
          id: 1,
          owner_id: 11,
          name: "Primary Shopper",
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 2,
          owner_id: 12,
          name: "Legacy Shopper",
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await shopperService.lookupShopperByPin("1234");

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_CONFLICT",
        message:
          "PIN lookup is ambiguous for this device. Reset shopper PINs before continuing.",
      },
    });
  });

  it("requires shopper pin when creating shoppers", async () => {
    const result = await shopperService.createShopper({
      name: "Shopper A",
      pin: "",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_INVALID_INPUT",
        message: "Shopper PIN must be at least 4 digits.",
      },
    });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("updates shopper name without clearing pin hash when pin is omitted", async () => {
    mockDb.getFirstAsync.mockImplementation((query: string) => {
      if (!query.includes("FROM shopper")) {
        return Promise.resolve(null);
      }
      return Promise.resolve({
        id: 51,
        owner_id: 11,
        name: "Renamed Shopper",
        created_at_ms: 1,
        updated_at_ms: 2,
      });
    });

    const result = await shopperService.updateShopper({
      shopperId: 51,
      name: "Renamed Shopper",
    });

    expect(result.ok).toBe(true);
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.not.stringContaining("pin_hash"),
      "Renamed Shopper",
      expect.any(Number),
      51,
      11,
    );
  });

  it("rejects explicit shopper pin clearing on update", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 51,
      owner_id: 11,
      name: "Shopper A",
      created_at_ms: 1,
      updated_at_ms: 1,
    });

    const result = await shopperService.updateShopper({
      shopperId: 51,
      name: "Renamed Shopper",
      pin: null,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_INVALID_INPUT",
        message: "Shopper PIN must be at least 4 digits.",
      },
    });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("rejects invalid ledger amounts", async () => {
    const purchaseResult = await ledgerService.recordPurchase({
      shopperId: 1,
      totalCents: 0,
    });
    const paymentResult = await ledgerService.recordPayment({
      shopperId: 1,
      amountCents: -10,
    });

    expect(purchaseResult).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_INVALID_INPUT",
        message: "Purchase total must be a positive integer amount.",
      },
    });
    expect(paymentResult).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_INVALID_INPUT",
        message: "Payment amount must be a positive integer amount.",
      },
    });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("returns missing-active-owner error when owner context is not selected", async () => {
    session.setAdminSession({ id: 1, username: "admin" });

    const result = await productService.listProducts();

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_REQUIRES_ACTIVE_OWNER",
        message: "Select an active owner before managing owner-scoped data.",
      },
    });
  });
});
