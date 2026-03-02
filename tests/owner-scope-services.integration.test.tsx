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
    mockDb.getFirstAsync.mockResolvedValue(null);
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
