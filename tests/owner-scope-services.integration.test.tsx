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
  let ownerDataService: typeof import("@/domain/services/owner-data-service");

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    mockDb.getAllAsync.mockReset();
    mockDb.getFirstAsync.mockReset();
    mockDb.runAsync.mockReset();
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
    ownerDataService = require("@/domain/services/owner-data-service");
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

  it("creates products with trimmed inputs in the active owner scope", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 44,
      owner_id: 11,
      name: "Milk",
      barcode: "A-1",
      created_at_ms: 100,
      updated_at_ms: 100,
    });

    const result = await productService.createProduct({
      name: "  Milk  ",
      barcode: "  A-1  ",
      nowMs: 100,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: 44,
        ownerId: 11,
        name: "Milk",
        barcode: "A-1",
        createdAtMs: 100,
        updatedAtMs: 100,
      },
    });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO product"),
      11,
      "Milk",
      "A-1",
      100,
      100,
    );
  });

  it("updates products with trimmed inputs in the active owner scope", async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({
        id: 44,
        owner_id: 11,
        name: "Milk",
        barcode: "A-1",
        created_at_ms: 100,
        updated_at_ms: 100,
      })
      .mockResolvedValueOnce({
        id: 44,
        owner_id: 11,
        name: "Milk Updated",
        barcode: "A-2",
        created_at_ms: 100,
        updated_at_ms: 300,
      });

    const result = await productService.updateProduct({
      productId: 44,
      name: "  Milk Updated  ",
      barcode: "  A-2  ",
      nowMs: 300,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: 44,
        ownerId: 11,
        name: "Milk Updated",
        barcode: "A-2",
        createdAtMs: 100,
        updatedAtMs: 300,
      },
    });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE product"),
      "Milk Updated",
      "A-2",
      300,
      44,
      11,
    );
  });

  it("rejects empty product name/barcode on create and update", async () => {
    const createResult = await productService.createProduct({
      name: "   ",
      barcode: "   ",
    });

    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 77,
      owner_id: 11,
      name: "Existing",
      barcode: "X-1",
      created_at_ms: 1,
      updated_at_ms: 1,
    });
    const updateResult = await productService.updateProduct({
      productId: 77,
      name: " ",
      barcode: " ",
    });

    expect(createResult).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_INVALID_INPUT",
        message: "Product name and barcode are required.",
      },
    });
    expect(updateResult).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_INVALID_INPUT",
        message: "Product name and barcode are required.",
      },
    });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("archives products in active owner scope with deterministic timestamps", async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({
        id: 44,
        owner_id: 11,
        name: "Milk",
        barcode: "A-1",
        archived_at_ms: null,
        created_at_ms: 100,
        updated_at_ms: 100,
      })
      .mockResolvedValueOnce({
        id: 44,
        owner_id: 11,
        name: "Milk",
        barcode: "A-1",
        archived_at_ms: 500,
        created_at_ms: 100,
        updated_at_ms: 500,
      });

    const result = await productService.archiveProduct({
      productId: 44,
      nowMs: 500,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: 44,
        ownerId: 11,
        name: "Milk",
        barcode: "A-1",
        createdAtMs: 100,
        updatedAtMs: 500,
      },
    });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("archived_at_ms = COALESCE(archived_at_ms, ?)"),
      500,
      500,
      44,
      11,
    );
  });

  it("restores archived products in active owner scope with deterministic conflict mapping", async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({
        id: 44,
        owner_id: 11,
        name: "Milk",
        barcode: "A-1",
        archived_at_ms: 500,
        created_at_ms: 100,
        updated_at_ms: 500,
      })
      .mockResolvedValueOnce({
        id: 44,
        owner_id: 11,
        name: "Milk",
        barcode: "A-1",
        archived_at_ms: null,
        created_at_ms: 100,
        updated_at_ms: 700,
      });

    const result = await productService.restoreProduct({
      productId: 44,
      nowMs: 700,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: 44,
        ownerId: 11,
        name: "Milk",
        barcode: "A-1",
        createdAtMs: 100,
        updatedAtMs: 700,
      },
    });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("SET archived_at_ms = NULL"),
      700,
      44,
      11,
    );
  });

  it("maps owner-scoped duplicate barcode conflicts during restore deterministically", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 44,
      owner_id: 11,
      name: "Milk",
      barcode: "A-1",
      archived_at_ms: 500,
      created_at_ms: 100,
      updated_at_ms: 500,
    });
    mockDb.runAsync.mockRejectedValueOnce(
      new Error("UNIQUE constraint failed: index 'idx_product_owner_barcode_unique'"),
    );

    const result = await productService.restoreProduct({
      productId: 44,
      nowMs: 700,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_CONFLICT",
        message: "A product with this barcode already exists for the active owner.",
      },
    });
  });

  it("rejects restore when product is already active", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 44,
      owner_id: 11,
      name: "Milk",
      barcode: "A-1",
      archived_at_ms: null,
      created_at_ms: 100,
      updated_at_ms: 500,
    });

    const result = await productService.restoreProduct({
      productId: 44,
      nowMs: 700,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_CONFLICT",
        message: "Only archived products can be restored.",
      },
    });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("allows shopping-list create and edit paths after restoring an archived product", async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({
        id: 444,
        owner_id: 11,
        name: "Milk",
        barcode: "A-1",
        archived_at_ms: 500,
        created_at_ms: 100,
        updated_at_ms: 500,
      })
      .mockResolvedValueOnce({
        id: 444,
        owner_id: 11,
        name: "Milk",
        barcode: "A-1",
        archived_at_ms: null,
        created_at_ms: 100,
        updated_at_ms: 700,
      })
      .mockResolvedValueOnce({
        owner_id: 11,
        archived_at_ms: null,
      })
      .mockResolvedValueOnce({
        id: 81,
        owner_id: 11,
        product_id: 444,
        quantity: 1,
        unit_price_cents: 100,
        bundle_qty: null,
        bundle_price_cents: null,
        created_at_ms: 701,
        updated_at_ms: 701,
      })
      .mockResolvedValueOnce({
        id: 81,
        owner_id: 11,
        product_id: 444,
        quantity: 1,
        unit_price_cents: 100,
        bundle_qty: null,
        bundle_price_cents: null,
        created_at_ms: 701,
        updated_at_ms: 701,
      })
      .mockResolvedValueOnce({
        owner_id: 11,
        archived_at_ms: null,
      })
      .mockResolvedValueOnce({
        id: 81,
        owner_id: 11,
        product_id: 444,
        quantity: 2,
        unit_price_cents: 100,
        bundle_qty: null,
        bundle_price_cents: null,
        created_at_ms: 701,
        updated_at_ms: 702,
      });
    mockDb.runAsync
      .mockResolvedValueOnce({ changes: 1, lastInsertRowId: 444 })
      .mockResolvedValueOnce({ changes: 1, lastInsertRowId: 81 })
      .mockResolvedValueOnce({ changes: 1, lastInsertRowId: 0 });

    const restoreResult = await productService.restoreProduct({
      productId: 444,
      nowMs: 700,
    });
    const createListItemResult = await shoppingListService.addShoppingListItem({
      productId: 444,
      quantity: 1,
      unitPriceCents: 100,
      nowMs: 701,
    });
    const updateListItemResult = await shoppingListService.updateShoppingListItem({
      itemId: 81,
      quantity: 2,
      unitPriceCents: 100,
      nowMs: 702,
    });

    expect(restoreResult.ok).toBe(true);
    expect(createListItemResult).toEqual({
      ok: true,
      value: {
        id: 81,
        ownerId: 11,
        productId: 444,
        quantity: 1,
        unitPriceCents: 100,
        bundleQty: null,
        bundlePriceCents: null,
        createdAtMs: 701,
        updatedAtMs: 701,
      },
    });
    expect(updateListItemResult).toEqual({
      ok: true,
      value: {
        id: 81,
        ownerId: 11,
        productId: 444,
        quantity: 2,
        unitPriceCents: 100,
        bundleQty: null,
        bundlePriceCents: null,
        createdAtMs: 701,
        updatedAtMs: 702,
      },
    });
  });

  it("filters archived products from default list reads and supports includeArchived and archivedOnly reads", async () => {
    mockDb.getAllAsync.mockResolvedValue([]);

    await productService.listProducts();
    await productService.listProducts({ includeArchived: true });
    await productService.listProducts({ archivedOnly: true });

    expect(mockDb.getAllAsync).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining("archived_at_ms IS NULL"),
      11,
    );
    expect(mockDb.getAllAsync).toHaveBeenNthCalledWith(
      2,
      expect.not.stringContaining("archived_at_ms IS NULL"),
      11,
    );
    expect(mockDb.getAllAsync).toHaveBeenNthCalledWith(
      3,
      expect.stringContaining("archived_at_ms IS NOT NULL"),
      11,
    );
  });

  it("blocks hard-delete when shopping-list dependencies exist", async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({
        id: 44,
        owner_id: 11,
        name: "Milk",
        barcode: "A-1",
        archived_at_ms: null,
        created_at_ms: 100,
        updated_at_ms: 100,
      })
      .mockResolvedValueOnce({ total: 1 });

    const result = await productService.deleteProduct({
      productId: 44,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_CONFLICT",
        message:
          "This product is still used by shopping-list items. Remove those references first, or archive the product instead.",
      },
    });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("hard-deletes a product when no shopping-list dependency exists", async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({
        id: 44,
        owner_id: 11,
        name: "Milk",
        barcode: "A-1",
        archived_at_ms: null,
        created_at_ms: 100,
        updated_at_ms: 100,
      })
      .mockResolvedValueOnce({ total: 0 });

    const result = await productService.deleteProduct({
      productId: 44,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        deletedProductId: 44,
      },
    });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM product"),
      44,
      11,
    );
  });

  it("rejects cross-owner product archive requests", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 33,
      owner_id: 99,
      name: "Owner B product",
      barcode: "B-1",
      archived_at_ms: null,
      created_at_ms: 1,
      updated_at_ms: 1,
    });

    const result = await productService.archiveProduct({
      productId: 33,
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

  it("rejects cross-owner product restore requests", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 33,
      owner_id: 99,
      name: "Owner B product",
      barcode: "B-1",
      archived_at_ms: 1,
      created_at_ms: 1,
      updated_at_ms: 1,
    });

    const result = await productService.restoreProduct({
      productId: 33,
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

  it("rejects cross-owner product delete requests", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 33,
      owner_id: 99,
      name: "Owner B product",
      barcode: "B-1",
      archived_at_ms: null,
      created_at_ms: 1,
      updated_at_ms: 1,
    });

    const result = await productService.deleteProduct({
      productId: 33,
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

  it("creates shopping-list items in active owner scope with deterministic values", async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({
        owner_id: 11,
        archived_at_ms: null,
      })
      .mockResolvedValueOnce({
        id: 901,
        owner_id: 11,
        product_id: 444,
        quantity: 3,
        unit_price_cents: 199,
        bundle_qty: 3,
        bundle_price_cents: 500,
        created_at_ms: 100,
        updated_at_ms: 100,
      });
    mockDb.runAsync.mockResolvedValueOnce({
      changes: 1,
      lastInsertRowId: 901,
    });

    const result = await shoppingListService.addShoppingListItem({
      productId: 444,
      quantity: 3,
      unitPriceCents: 199,
      bundleQty: 3,
      bundlePriceCents: 500,
      nowMs: 100,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: 901,
        ownerId: 11,
        productId: 444,
        quantity: 3,
        unitPriceCents: 199,
        bundleQty: 3,
        bundlePriceCents: 500,
        createdAtMs: 100,
        updatedAtMs: 100,
      },
    });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO shopping_list_item"),
      11,
      444,
      3,
      199,
      3,
      500,
      100,
      100,
    );
  });

  it("returns deterministic conflict error when publishing duplicate owner/product shopping-list entries", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      owner_id: 11,
      archived_at_ms: null,
    });
    mockDb.runAsync.mockRejectedValueOnce(
      new Error(
        "UNIQUE constraint failed: index 'idx_shopping_list_item_owner_product_unique'",
      ),
    );

    const result = await shoppingListService.addShoppingListItem({
      productId: 444,
      quantity: 2,
      unitPriceCents: 125,
      nowMs: 250,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_CONFLICT",
        message:
          "This product is already published in the shopping list for the active owner.",
      },
    });
  });

  it("updates shopping-list items in active owner scope with deterministic values", async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({
        id: 901,
        owner_id: 11,
        product_id: 444,
        quantity: 3,
        unit_price_cents: 199,
        bundle_qty: null,
        bundle_price_cents: null,
        created_at_ms: 100,
        updated_at_ms: 100,
      })
      .mockResolvedValueOnce({
        owner_id: 11,
        archived_at_ms: null,
      })
      .mockResolvedValueOnce({
        id: 901,
        owner_id: 11,
        product_id: 444,
        quantity: 5,
        unit_price_cents: 250,
        bundle_qty: 2,
        bundle_price_cents: 425,
        created_at_ms: 100,
        updated_at_ms: 200,
      });

    const result = await shoppingListService.updateShoppingListItem({
      itemId: 901,
      quantity: 5,
      unitPriceCents: 250,
      bundleQty: 2,
      bundlePriceCents: 425,
      nowMs: 200,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: 901,
        ownerId: 11,
        productId: 444,
        quantity: 5,
        unitPriceCents: 250,
        bundleQty: 2,
        bundlePriceCents: 425,
        createdAtMs: 100,
        updatedAtMs: 200,
      },
    });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE shopping_list_item"),
      5,
      250,
      2,
      425,
      200,
      901,
      11,
    );
  });

  it("preserves existing bundle offer when update input omits bundle fields", async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({
        id: 901,
        owner_id: 11,
        product_id: 444,
        quantity: 3,
        unit_price_cents: 199,
        bundle_qty: 3,
        bundle_price_cents: 500,
        created_at_ms: 100,
        updated_at_ms: 100,
      })
      .mockResolvedValueOnce({
        owner_id: 11,
        archived_at_ms: null,
      })
      .mockResolvedValueOnce({
        id: 901,
        owner_id: 11,
        product_id: 444,
        quantity: 4,
        unit_price_cents: 225,
        bundle_qty: 3,
        bundle_price_cents: 500,
        created_at_ms: 100,
        updated_at_ms: 300,
      });

    const result = await shoppingListService.updateShoppingListItem({
      itemId: 901,
      quantity: 4,
      unitPriceCents: 225,
      nowMs: 300,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: 901,
        ownerId: 11,
        productId: 444,
        quantity: 4,
        unitPriceCents: 225,
        bundleQty: 3,
        bundlePriceCents: 500,
        createdAtMs: 100,
        updatedAtMs: 300,
      },
    });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE shopping_list_item"),
      4,
      225,
      3,
      500,
      300,
      901,
      11,
    );
  });

  it("rejects shopping-list bundle inputs when only one bundle field is provided", async () => {
    const addResult = await shoppingListService.addShoppingListItem({
      productId: 444,
      quantity: 3,
      unitPriceCents: 199,
      bundleQty: 3,
    });
    const updateResult = await shoppingListService.updateShoppingListItem({
      itemId: 901,
      quantity: 5,
      unitPriceCents: 250,
      bundlePriceCents: 500,
    });
    const updateWithNullBundleQtyResult = await shoppingListService.updateShoppingListItem({
      itemId: 901,
      quantity: 5,
      unitPriceCents: 250,
      bundleQty: null,
    });
    const updateWithNullBundlePriceResult =
      await shoppingListService.updateShoppingListItem({
        itemId: 901,
        quantity: 5,
        unitPriceCents: 250,
        bundlePriceCents: null,
      });

    expect(addResult).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_INVALID_INPUT",
        message:
          "Quantity must be a positive integer, unit price must be a non-negative integer, and bundle offers must include both fields with bundle quantity >= 2 and bundle price > 0.",
      },
    });
    expect(updateResult).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_INVALID_INPUT",
        message:
          "Quantity must be a positive integer, unit price must be a non-negative integer, and bundle offers must include both fields with bundle quantity >= 2 and bundle price > 0.",
      },
    });
    expect(updateWithNullBundleQtyResult).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_INVALID_INPUT",
        message:
          "Quantity must be a positive integer, unit price must be a non-negative integer, and bundle offers must include both fields with bundle quantity >= 2 and bundle price > 0.",
      },
    });
    expect(updateWithNullBundlePriceResult).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_INVALID_INPUT",
        message:
          "Quantity must be a positive integer, unit price must be a non-negative integer, and bundle offers must include both fields with bundle quantity >= 2 and bundle price > 0.",
      },
    });
    expect(mockDb.getFirstAsync).not.toHaveBeenCalled();
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("rejects shopping-list bundle inputs with invalid bundle bounds", async () => {
    const createResult = await shoppingListService.addShoppingListItem({
      productId: 444,
      quantity: 3,
      unitPriceCents: 199,
      bundleQty: 1,
      bundlePriceCents: 500,
    });
    const updateResult = await shoppingListService.updateShoppingListItem({
      itemId: 901,
      quantity: 5,
      unitPriceCents: 250,
      bundleQty: 3,
      bundlePriceCents: 0,
    });

    expect(createResult).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_INVALID_INPUT",
        message:
          "Quantity must be a positive integer, unit price must be a non-negative integer, and bundle offers must include both fields with bundle quantity >= 2 and bundle price > 0.",
      },
    });
    expect(updateResult).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_INVALID_INPUT",
        message:
          "Quantity must be a positive integer, unit price must be a non-negative integer, and bundle offers must include both fields with bundle quantity >= 2 and bundle price > 0.",
      },
    });
    expect(mockDb.getFirstAsync).not.toHaveBeenCalled();
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("removes shopping-list items in active owner scope", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 901,
      owner_id: 11,
      product_id: 444,
      quantity: 3,
      unit_price_cents: 199,
      created_at_ms: 100,
      updated_at_ms: 100,
    });
    mockDb.runAsync.mockResolvedValueOnce({
      changes: 1,
      lastInsertRowId: 0,
    });

    const result = await shoppingListService.removeShoppingListItem({
      itemId: 901,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        removedItemId: 901,
      },
    });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM shopping_list_item"),
      901,
      11,
    );
  });

  it("returns not-found when remove delete changes are zero after pre-check", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 901,
      owner_id: 11,
      product_id: 444,
      quantity: 3,
      unit_price_cents: 199,
      created_at_ms: 100,
      updated_at_ms: 100,
    });
    mockDb.runAsync.mockResolvedValueOnce({
      changes: 0,
      lastInsertRowId: 0,
    });

    const result = await shoppingListService.removeShoppingListItem({
      itemId: 901,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_NOT_FOUND",
        message: "Record not found in the active owner scope.",
      },
    });
  });

  it("rejects removing shopping-list items from another owner scope", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 901,
      owner_id: 99,
      product_id: 444,
      quantity: 3,
      unit_price_cents: 199,
      created_at_ms: 100,
      updated_at_ms: 100,
    });

    const result = await shoppingListService.removeShoppingListItem({
      itemId: 901,
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

  it("rejects removing missing shopping-list items with deterministic not-found mapping", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null);

    const result = await shoppingListService.removeShoppingListItem({
      itemId: 999,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_NOT_FOUND",
        message: "Record not found in the active owner scope.",
      },
    });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("removes assorted shopping-list items in active owner scope", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 77,
      owner_id: 11,
      name: "Assorted",
      quantity: 8,
      unit_price_cents: 250,
      bundle_qty: null,
      bundle_price_cents: null,
      created_at_ms: 100,
      updated_at_ms: 100,
    });
    mockDb.runAsync.mockResolvedValueOnce({
      changes: 1,
      lastInsertRowId: 0,
    });

    const result = await shoppingListService.removeAssortedShoppingListItem({
      itemId: 77,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        removedItemId: 77,
      },
    });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM shopping_list_assorted_item"),
      77,
      11,
    );
  });

  it("returns not-found when assorted remove delete changes are zero after pre-check", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 77,
      owner_id: 11,
      name: "Assorted",
      quantity: 8,
      unit_price_cents: 250,
      bundle_qty: null,
      bundle_price_cents: null,
      created_at_ms: 100,
      updated_at_ms: 100,
    });
    mockDb.runAsync.mockResolvedValueOnce({
      changes: 0,
      lastInsertRowId: 0,
    });

    const result = await shoppingListService.removeAssortedShoppingListItem({
      itemId: 77,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_NOT_FOUND",
        message: "Record not found in the active owner scope.",
      },
    });
  });

  it("rejects removing assorted shopping-list items from another owner scope", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 77,
      owner_id: 99,
      name: "Assorted",
      quantity: 8,
      unit_price_cents: 250,
      bundle_qty: null,
      bundle_price_cents: null,
      created_at_ms: 100,
      updated_at_ms: 100,
    });

    const result = await shoppingListService.removeAssortedShoppingListItem({
      itemId: 77,
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

  it("rejects removing missing assorted shopping-list items with deterministic not-found mapping", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce(null);

    const result = await shoppingListService.removeAssortedShoppingListItem({
      itemId: 77,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_NOT_FOUND",
        message: "Record not found in the active owner scope.",
      },
    });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("rejects adding shopping-list items that reference archived products", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      owner_id: 11,
      archived_at_ms: 1234,
    });

    const result = await shoppingListService.addShoppingListItem({
      productId: 444,
      quantity: 1,
      unitPriceCents: 100,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_CONFLICT",
        message:
          "Archived products cannot be used in active shopping-list entries. Select an active product.",
      },
    });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("rejects shopping-list item edits when the referenced product is archived", async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({
        id: 81,
        owner_id: 11,
        product_id: 444,
        quantity: 1,
        unit_price_cents: 100,
        created_at_ms: 1,
        updated_at_ms: 1,
      })
      .mockResolvedValueOnce({
        owner_id: 11,
        archived_at_ms: 5678,
      });

    const result = await shoppingListService.updateShoppingListItem({
      itemId: 81,
      quantity: 2,
      unitPriceCents: 100,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_CONFLICT",
        message:
          "Archived products cannot be used in active shopping-list entries. Select an active product.",
      },
    });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("filters archived products out of active shopping-list reads", async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([]);

    const result = await shoppingListService.listShoppingListItems();

    expect(result).toEqual({
      ok: true,
      value: [],
    });
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("INNER JOIN product AS product"),
      11,
    );
    expect(mockDb.getAllAsync).toHaveBeenCalledWith(
      expect.stringContaining("product.archived_at_ms IS NULL"),
      11,
    );
  });

  it("creates assorted shopping-list groups with shared pricing, quantity, and member products", async () => {
    mockDb.getAllAsync
      .mockResolvedValueOnce([
        {
          id: 444,
          owner_id: 11,
          archived_at_ms: null,
        },
        {
          id: 555,
          owner_id: 11,
          archived_at_ms: null,
        },
      ])
      .mockResolvedValueOnce([
        { product_id: 444 },
        { product_id: 555 },
      ]);
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 77,
      owner_id: 11,
      name: "Assorted",
      quantity: 8,
      unit_price_cents: 250,
      bundle_qty: 3,
      bundle_price_cents: 600,
      created_at_ms: 100,
      updated_at_ms: 100,
    });
    mockDb.runAsync
      .mockResolvedValueOnce({ changes: 0, lastInsertRowId: 0 })
      .mockResolvedValueOnce({ changes: 1, lastInsertRowId: 77 })
      .mockResolvedValueOnce({ changes: 1, lastInsertRowId: 1 })
      .mockResolvedValueOnce({ changes: 1, lastInsertRowId: 2 })
      .mockResolvedValueOnce({ changes: 0, lastInsertRowId: 0 });

    const result = await shoppingListService.createAssortedShoppingListItem({
      name: "Assorted",
      quantity: 8,
      unitPriceCents: 250,
      bundleQty: 3,
      bundlePriceCents: 600,
      memberProductIds: [444, 555],
      nowMs: 100,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: 77,
        ownerId: 11,
        name: "Assorted",
        quantity: 8,
        unitPriceCents: 250,
        bundleQty: 3,
        bundlePriceCents: 600,
        memberProductIds: [444, 555],
        memberCount: 2,
        createdAtMs: 100,
        updatedAtMs: 100,
        itemType: "assorted",
      },
    });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO shopping_list_assorted_item"),
      11,
      "Assorted",
      8,
      250,
      3,
      600,
      100,
      100,
    );
  });

  it("updates assorted shopping-list groups including members and shared pricing", async () => {
    mockDb.getFirstAsync
      .mockResolvedValueOnce({
        id: 77,
        owner_id: 11,
        name: "Assorted",
        quantity: 8,
        unit_price_cents: 250,
        bundle_qty: null,
        bundle_price_cents: null,
        created_at_ms: 100,
        updated_at_ms: 100,
      })
      .mockResolvedValueOnce({
        id: 77,
        owner_id: 11,
        name: "Assorted",
        quantity: 5,
        unit_price_cents: 300,
        bundle_qty: 2,
        bundle_price_cents: 500,
        created_at_ms: 100,
        updated_at_ms: 200,
      });
    mockDb.getAllAsync
      .mockResolvedValueOnce([
        {
          id: 444,
          owner_id: 11,
          archived_at_ms: null,
        },
        {
          id: 555,
          owner_id: 11,
          archived_at_ms: null,
        },
      ])
      .mockResolvedValueOnce([
        { product_id: 444 },
        { product_id: 555 },
      ]);
    mockDb.runAsync
      .mockResolvedValueOnce({ changes: 0, lastInsertRowId: 0 })
      .mockResolvedValueOnce({ changes: 1, lastInsertRowId: 0 })
      .mockResolvedValueOnce({ changes: 2, lastInsertRowId: 0 })
      .mockResolvedValueOnce({ changes: 1, lastInsertRowId: 1 })
      .mockResolvedValueOnce({ changes: 1, lastInsertRowId: 2 })
      .mockResolvedValueOnce({ changes: 0, lastInsertRowId: 0 });

    const result = await shoppingListService.updateAssortedShoppingListItem({
      itemId: 77,
      name: "Assorted",
      quantity: 5,
      unitPriceCents: 300,
      bundleQty: 2,
      bundlePriceCents: 500,
      memberProductIds: [444, 555],
      nowMs: 200,
    });

    expect(result).toEqual({
      ok: true,
      value: {
        id: 77,
        ownerId: 11,
        name: "Assorted",
        quantity: 5,
        unitPriceCents: 300,
        bundleQty: 2,
        bundlePriceCents: 500,
        memberProductIds: [444, 555],
        memberCount: 2,
        createdAtMs: 100,
        updatedAtMs: 200,
        itemType: "assorted",
      },
    });
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE shopping_list_assorted_item"),
      "Assorted",
      5,
      300,
      2,
      500,
      200,
      77,
      11,
    );
  });

  it("rejects assorted-group writes with fewer than two members", async () => {
    const createResult = await shoppingListService.createAssortedShoppingListItem({
      name: "Assorted",
      quantity: 5,
      unitPriceCents: 250,
      memberProductIds: [444],
    });

    expect(createResult).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_INVALID_INPUT",
        message:
          "Assorted shopping-list entries must include at least two unique active member products for the active owner.",
      },
    });
    expect(mockDb.getAllAsync).not.toHaveBeenCalled();
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("rejects assorted-group writes when a member product belongs to another owner", async () => {
    mockDb.getAllAsync.mockResolvedValueOnce([
      {
        id: 444,
        owner_id: 11,
        archived_at_ms: null,
      },
      {
        id: 555,
        owner_id: 99,
        archived_at_ms: null,
      },
    ]);

    const createResult = await shoppingListService.createAssortedShoppingListItem({
      name: "Assorted",
      quantity: 5,
      unitPriceCents: 250,
      memberProductIds: [444, 555],
    });

    expect(createResult).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_MISMATCH",
        message: "The requested record belongs to a different owner.",
      },
    });
    expect(mockDb.runAsync).not.toHaveBeenCalled();
  });

  it("lists published shopping-list entries including assorted groups as single rows", async () => {
    mockDb.getAllAsync
      .mockResolvedValueOnce([
        {
          id: 901,
          owner_id: 11,
          product_id: 444,
          quantity: 3,
          unit_price_cents: 150,
          bundle_qty: null,
          bundle_price_cents: null,
          created_at_ms: 100,
          updated_at_ms: 100,
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 77,
          owner_id: 11,
          name: "Assorted",
          quantity: 8,
          unit_price_cents: 250,
          bundle_qty: null,
          bundle_price_cents: null,
          created_at_ms: 120,
          updated_at_ms: 120,
          member_count: 2,
        },
      ])
      .mockResolvedValueOnce([
        { assorted_item_id: 77, product_id: 444 },
        { assorted_item_id: 77, product_id: 555 },
      ]);

    const result = await shoppingListService.listShoppingListItems();

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: 77,
          ownerId: 11,
          name: "Assorted",
          quantity: 8,
          unitPriceCents: 250,
          bundleQty: null,
          bundlePriceCents: null,
          memberProductIds: [444, 555],
          memberCount: 2,
          createdAtMs: 120,
          updatedAtMs: 120,
          itemType: "assorted",
        },
        {
          id: 901,
          ownerId: 11,
          productId: 444,
          quantity: 3,
          unitPriceCents: 150,
          bundleQty: null,
          bundlePriceCents: null,
          createdAtMs: 100,
          updatedAtMs: 100,
          itemType: "standard",
        },
      ],
    });
  });

  it("keeps assorted groups visible even when active member count drops below two", async () => {
    mockDb.getAllAsync
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          id: 77,
          owner_id: 11,
          name: "Assorted",
          quantity: 8,
          unit_price_cents: 250,
          bundle_qty: null,
          bundle_price_cents: null,
          created_at_ms: 120,
          updated_at_ms: 120,
          member_count: 1,
        },
      ])
      .mockResolvedValueOnce([{ assorted_item_id: 77, product_id: 444 }]);

    const result = await shoppingListService.listShoppingListItems();

    expect(result).toEqual({
      ok: true,
      value: [
        {
          id: 77,
          ownerId: 11,
          name: "Assorted",
          quantity: 8,
          unitPriceCents: 250,
          bundleQty: null,
          bundlePriceCents: null,
          memberProductIds: [444],
          memberCount: 1,
          createdAtMs: 120,
          updatedAtMs: 120,
          itemType: "assorted",
        },
      ],
    });
  });

  it("keeps owner snapshot shoppingList in sync after successful remove", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 901,
      owner_id: 11,
      product_id: 444,
      quantity: 3,
      unit_price_cents: 199,
      created_at_ms: 100,
      updated_at_ms: 100,
    });
    mockDb.runAsync.mockResolvedValueOnce({
      changes: 1,
      lastInsertRowId: 0,
    });
    mockDb.getAllAsync.mockImplementation((query: string) => {
      if (query.includes("SELECT 'purchase' AS kind")) {
        return Promise.resolve([]);
      }
      if (query.includes("FROM shopping_list_item")) {
        return Promise.resolve([]);
      }
      if (query.includes("FROM product")) {
        return Promise.resolve([
          {
            id: 444,
            owner_id: 11,
            name: "Milk",
            barcode: "A-1",
            archived_at_ms: null,
            created_at_ms: 100,
            updated_at_ms: 100,
          },
        ]);
      }
      return Promise.resolve([]);
    });

    const removeResult = await shoppingListService.removeShoppingListItem({
      itemId: 901,
    });
    const listResult = await shoppingListService.listShoppingListItems();
    const snapshotResult = await ownerDataService.getOwnerScopedSnapshot();

    expect(removeResult).toEqual({
      ok: true,
      value: {
        removedItemId: 901,
      },
    });
    expect(listResult).toEqual({
      ok: true,
      value: [],
    });
    expect(snapshotResult.ok).toBe(true);
    if (snapshotResult.ok) {
      expect(snapshotResult.value.shoppingList).toEqual([]);
    }
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
      new Error("UNIQUE constraint failed: index 'idx_product_owner_barcode_unique'"),
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

  it("returns a generic conflict error for unexpected unique constraint failures", async () => {
    mockDb.runAsync.mockRejectedValueOnce(
      new Error("UNIQUE constraint failed: index 'idx_product_owner_id_unique'"),
    );

    const result = await productService.createProduct({
      name: "Milk",
      barcode: "A-1",
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_CONFLICT",
        message: "This operation conflicts with existing owner-scoped data.",
      },
    });
  });

  it("keeps duplicate-barcode uniqueness enforced at the DB index boundary", () => {
    const schema = require("@/db/schema");

    expect(schema.CREATE_PRODUCT_OWNER_BARCODE_UNIQUE_INDEX_SQL).toContain(
      "CREATE UNIQUE INDEX",
    );
    expect(schema.CREATE_PRODUCT_OWNER_BARCODE_UNIQUE_INDEX_SQL).toContain(
      "owner_id, lower(barcode)",
    );
  });

  it("keeps owner/product shopping-list uniqueness enforced at the DB index boundary", () => {
    const schema = require("@/db/schema");

    expect(schema.CREATE_SHOPPING_LIST_ITEM_OWNER_PRODUCT_UNIQUE_INDEX_SQL).toContain(
      "CREATE UNIQUE INDEX",
    );
    expect(schema.CREATE_SHOPPING_LIST_ITEM_OWNER_PRODUCT_UNIQUE_INDEX_SQL).toContain(
      "owner_id, product_id",
    );
  });

  it("keeps shopping-list bundle constraints enforced at the DB schema boundary", () => {
    const schema = require("@/db/schema");

    expect(schema.CREATE_SHOPPING_LIST_ITEM_TABLE_SQL).toContain("bundle_qty INTEGER");
    expect(schema.CREATE_SHOPPING_LIST_ITEM_TABLE_SQL).toContain(
      "bundle_price_cents INTEGER",
    );
    expect(schema.CREATE_SHOPPING_LIST_ITEM_TABLE_SQL).toContain(
      "(bundle_qty IS NULL AND bundle_price_cents IS NULL)",
    );
    expect(schema.CREATE_SHOPPING_LIST_ITEM_TABLE_SQL).toContain(
      "(bundle_qty IS NOT NULL AND bundle_price_cents IS NOT NULL)",
    );
  });

  it("returns deterministic conflict error for duplicate barcode on update (case-insensitive)", async () => {
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 44,
      owner_id: 11,
      name: "Milk",
      barcode: "ABC-1",
      created_at_ms: 100,
      updated_at_ms: 100,
    });
    mockDb.runAsync.mockRejectedValueOnce(
      new Error("UNIQUE constraint failed: index 'idx_product_owner_barcode_unique'"),
    );

    const result = await productService.updateProduct({
      productId: 44,
      name: "Milk Updated",
      barcode: "abc-1",
      nowMs: 300,
    });

    expect(result).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_CONFLICT",
        message: "A product with this barcode already exists for the active owner.",
      },
    });
  });

  it("allows the same barcode across owners without leaking prior conflict state", async () => {
    mockDb.runAsync.mockRejectedValueOnce(
      new Error("UNIQUE constraint failed: index 'idx_product_owner_barcode_unique'"),
    );

    const ownerAConflict = await productService.createProduct({
      name: "Owner A Milk",
      barcode: "A-1",
    });

    expect(ownerAConflict).toEqual({
      ok: false,
      error: {
        code: "OWNER_SCOPE_CONFLICT",
        message: "A product with this barcode already exists for the active owner.",
      },
    });

    session.setActiveOwner({ id: 22, name: "Owner B" });
    mockDb.runAsync.mockResolvedValueOnce({ changes: 1, lastInsertRowId: 55 });
    mockDb.getFirstAsync.mockResolvedValueOnce({
      id: 55,
      owner_id: 22,
      name: "Owner B Milk",
      barcode: "A-1",
      created_at_ms: 200,
      updated_at_ms: 200,
    });

    const ownerBResult = await productService.createProduct({
      name: "Owner B Milk",
      barcode: "A-1",
      nowMs: 200,
    });

    expect(ownerBResult).toEqual({
      ok: true,
      value: {
        id: 55,
        ownerId: 22,
        name: "Owner B Milk",
        barcode: "A-1",
        createdAtMs: 200,
        updatedAtMs: 200,
      },
    });
    expect(mockDb.runAsync).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO product"),
      22,
      "Owner B Milk",
      "A-1",
      200,
      200,
    );
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
