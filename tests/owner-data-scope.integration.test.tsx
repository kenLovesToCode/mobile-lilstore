import { renderRouter, screen, waitFor } from "expo-router/testing-library";
import { act, fireEvent } from "@testing-library/react-native";

import {
  clearAdminSession,
  setActiveOwner,
  setAdminSession,
} from "@/domain/services/admin-session";

const mockGetOwnerScopedSnapshot = jest.fn();
const mockListProducts = jest.fn();
const mockCreateProduct = jest.fn();
const mockUpdateProduct = jest.fn();
const mockCreateShopper = jest.fn();
const mockUpdateShopper = jest.fn();
const originalConsoleError = console.error;

jest.mock("@/domain/services/owner-data-service", () => ({
  getOwnerScopedSnapshot: (...args: unknown[]) =>
    mockGetOwnerScopedSnapshot(...args),
  listProducts: (...args: unknown[]) => mockListProducts(...args),
  createProduct: (...args: unknown[]) => mockCreateProduct(...args),
  createShopper: (...args: unknown[]) => mockCreateShopper(...args),
  addShoppingListItem: jest.fn(),
  recordPurchase: jest.fn(),
  recordPayment: jest.fn(),
  updateProduct: (...args: unknown[]) => mockUpdateProduct(...args),
  updateShopper: (...args: unknown[]) => mockUpdateShopper(...args),
  updateShoppingListItem: jest.fn(),
}));

const ROUTES = {
  "(admin)/_layout": require("../src/app/(admin)/_layout").default,
  "(admin)/owner-data": require("../src/app/(admin)/owner-data").default,
  "(admin)/products": require("../src/app/(admin)/products").default,
};

async function renderOwnerDataRoute() {
  renderRouter(ROUTES, { initialUrl: "/owner-data" });
  await act(async () => {
    await Promise.resolve();
  });
}

async function renderProductsRoute() {
  renderRouter(ROUTES, { initialUrl: "/products" });
  await act(async () => {
    await Promise.resolve();
  });
}

type ProductFixture = {
  id: number;
  ownerId: number;
  name: string;
  barcode: string;
  createdAtMs: number;
  updatedAtMs: number;
};

function createDeferredPromise<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((innerResolve) => {
    resolve = innerResolve;
  });
  return { promise, resolve };
}

describe("owner-data owner-scope integration", () => {
  let consoleErrorSpy: jest.SpyInstance;
  let ownerProducts: Record<number, ProductFixture[]>;

  beforeAll(() => {
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation((...args) => {
      const firstArg = args[0];
      if (
        typeof firstArg === "string" &&
        firstArg.includes("inside a test was not wrapped in act(...)")
      ) {
        return;
      }
      (originalConsoleError as (...params: unknown[]) => void)(...args);
    });
  });

  afterAll(() => {
    consoleErrorSpy.mockRestore();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetOwnerScopedSnapshot.mockReset();
    mockListProducts.mockReset();
    mockCreateProduct.mockReset();
    mockUpdateProduct.mockReset();
    mockCreateShopper.mockReset();
    mockUpdateShopper.mockReset();
    clearAdminSession();
    setAdminSession({ id: 1, username: "admin" });
    setActiveOwner({ id: 101, name: "Owner A" });

    ownerProducts = {
      101: [
        {
          id: 1,
          ownerId: 101,
          name: "Product A",
          barcode: "A-1",
          createdAtMs: 1,
          updatedAtMs: 1,
        },
      ],
      202: [
        {
          id: 2,
          ownerId: 202,
          name: "Product B",
          barcode: "B-1",
          createdAtMs: 2,
          updatedAtMs: 2,
        },
      ],
    };

    mockGetOwnerScopedSnapshot.mockImplementation(() => {
      const activeOwner = require("@/domain/services/admin-session").getActiveOwner();
      if (activeOwner?.id === 101) {
        return Promise.resolve({
          ok: true,
          value: {
            products: [
              {
                id: 1,
                ownerId: 101,
                name: "Product A",
                barcode: "A-1",
                createdAtMs: 1,
                updatedAtMs: 1,
              },
            ],
            shoppers: [],
            shoppingList: [],
            purchases: [],
            payments: [],
            history: [],
          },
        });
      }

      return Promise.resolve({
        ok: true,
        value: {
          products: [
            {
              id: 2,
              ownerId: 202,
              name: "Product B",
              barcode: "B-1",
              createdAtMs: 2,
              updatedAtMs: 2,
            },
          ],
          shoppers: [],
          shoppingList: [],
          purchases: [],
          payments: [],
          history: [],
        },
      });
    });

    mockListProducts.mockImplementation(() => {
      const activeOwner = require("@/domain/services/admin-session").getActiveOwner();
      if (!activeOwner) {
        return Promise.resolve({
          ok: false,
          error: {
            code: "OWNER_SCOPE_REQUIRES_ACTIVE_OWNER",
            message: "Select an active owner before managing owner-scoped data.",
          },
        });
      }

      return Promise.resolve({
        ok: true,
        value: (ownerProducts[activeOwner.id] ?? []).map((product) => ({ ...product })),
      });
    });

    mockCreateProduct.mockImplementation(
      ({ name, barcode }: { name: string; barcode: string }) => {
        const activeOwner = require("@/domain/services/admin-session").getActiveOwner();
        if (!activeOwner) {
          return Promise.resolve({
            ok: false,
            error: {
              code: "OWNER_SCOPE_REQUIRES_ACTIVE_OWNER",
              message: "Select an active owner before managing owner-scoped data.",
            },
          });
        }

        const nowMs = Date.now();
        const ownerId = activeOwner.id;
        const nextId =
          Math.max(0, ...(ownerProducts[ownerId] ?? []).map((product) => product.id)) + 1;
        const created = {
          id: nextId,
          ownerId,
          name,
          barcode,
          createdAtMs: nowMs,
          updatedAtMs: nowMs,
        };
        ownerProducts[ownerId] = [created, ...(ownerProducts[ownerId] ?? [])];

        return Promise.resolve({ ok: true, value: created });
      },
    );

    mockUpdateProduct.mockImplementation(
      ({
        productId,
        name,
        barcode,
      }: {
        productId: number;
        name: string;
        barcode: string;
      }) => {
        const activeOwner = require("@/domain/services/admin-session").getActiveOwner();
        if (!activeOwner) {
          return Promise.resolve({
            ok: false,
            error: {
              code: "OWNER_SCOPE_REQUIRES_ACTIVE_OWNER",
              message: "Select an active owner before managing owner-scoped data.",
            },
          });
        }

        const currentProducts = ownerProducts[activeOwner.id] ?? [];
        const existing = currentProducts.find((product) => product.id === productId);
        if (!existing) {
          return Promise.resolve({
            ok: false,
            error: {
              code: "OWNER_SCOPE_NOT_FOUND",
              message: "Record not found in the active owner scope.",
            },
          });
        }

        const updated = {
          ...existing,
          name,
          barcode,
          updatedAtMs: Date.now(),
        };
        ownerProducts[activeOwner.id] = currentProducts.map((product) =>
          product.id === productId ? updated : product,
        );

        return Promise.resolve({ ok: true, value: updated });
      },
    );

    mockCreateShopper.mockResolvedValue({
      ok: true,
      value: {
        id: 1,
        ownerId: 101,
        name: "Shopper A",
        createdAtMs: 1,
        updatedAtMs: 1,
      },
    });

    mockUpdateShopper.mockResolvedValue({
      ok: true,
      value: {
        id: 1,
        ownerId: 101,
        name: "Renamed Shopper",
        createdAtMs: 1,
        updatedAtMs: 2,
      },
    });
  });

  it("swaps visible data deterministically when active owner changes", async () => {
    await renderOwnerDataRoute();

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner A")).toBeTruthy();
      expect(screen.getByText("Product A")).toBeTruthy();
    });

    act(() => {
      setActiveOwner({ id: 202, name: "Owner B" });
    });

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner B")).toBeTruthy();
      expect(screen.getByText("Product B")).toBeTruthy();
    });

    expect(screen.queryByText("Product A")).toBeFalsy();
  });

  it("validates shopper pin format before create requests", async () => {
    await renderOwnerDataRoute();

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner A")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText("Shopper Name"), "Shopper A");
    fireEvent.changeText(screen.getByLabelText("Shopper PIN"), "12a");
    fireEvent.press(screen.getByText("Create Shopper"));

    expect(mockCreateShopper).not.toHaveBeenCalled();
    expect(
      screen.getByText("Shopper PIN must be at least 4 digits."),
    ).toBeTruthy();
  });

  it("requires shopper pin before create requests", async () => {
    await renderOwnerDataRoute();

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner A")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText("Shopper Name"), "Shopper A");
    fireEvent.press(screen.getByText("Create Shopper"));

    expect(mockCreateShopper).not.toHaveBeenCalled();
    expect(
      screen.getByText("Shopper PIN must be at least 4 digits."),
    ).toBeTruthy();
  });

  it("does not send pin updates for name-only shopper edits", async () => {
    mockGetOwnerScopedSnapshot.mockResolvedValueOnce({
      ok: true,
      value: {
        products: [
          {
            id: 1,
            ownerId: 101,
            name: "Product A",
            barcode: "A-1",
            createdAtMs: 1,
            updatedAtMs: 1,
          },
        ],
        shoppers: [
          {
            id: 77,
            ownerId: 101,
            name: "Shopper A",
            createdAtMs: 1,
            updatedAtMs: 1,
          },
        ],
        shoppingList: [],
        purchases: [],
        payments: [],
        history: [],
      },
    });

    await renderOwnerDataRoute();

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner A")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText("Rename Shopper"), "Renamed Shopper");
    fireEvent.press(screen.getByText("Edit First Shopper"));

    await waitFor(() => {
      expect(mockUpdateShopper).toHaveBeenCalledWith({
        shopperId: 77,
        name: "Renamed Shopper",
      });
    });
  });

  it("shows owner guard copy on products route when no active owner is selected", async () => {
    setAdminSession({ id: 1, username: "admin" });

    await renderProductsRoute();

    await waitFor(() => {
      expect(screen.getByText("Active owner: None selected")).toBeTruthy();
      expect(
        screen.getByText("Select an owner from Owners before managing products."),
      ).toBeTruthy();
    });

    expect(mockListProducts).not.toHaveBeenCalled();
  });

  it("creates and edits products in the active owner scope and refreshes deterministically", async () => {
    await renderProductsRoute();

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner A")).toBeTruthy();
      expect(screen.getByText("Product A")).toBeTruthy();
    });
    await waitFor(() => {
      expect(mockListProducts).toHaveBeenCalledTimes(1);
    });

    fireEvent.changeText(screen.getByLabelText("Product Name"), "  Product C  ");
    fireEvent.changeText(screen.getByLabelText("Product Barcode"), "  C-3  ");
    fireEvent.press(screen.getByLabelText("Submit Create Product"));

    await waitFor(() => {
      expect(mockCreateProduct).toHaveBeenCalledWith({
        name: "Product C",
        barcode: "C-3",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Product C")).toBeTruthy();
      expect(mockListProducts).toHaveBeenCalledTimes(2);
    });
    expect(mockListProducts.mock.invocationCallOrder[1]).toBeGreaterThan(
      mockCreateProduct.mock.invocationCallOrder[0],
    );

    fireEvent.press(screen.getByLabelText("Edit Product Product C"));
    expect(mockListProducts).toHaveBeenCalledTimes(2);
    fireEvent.changeText(screen.getByLabelText("Edit Product Name"), "Product C Updated");
    fireEvent.changeText(screen.getByLabelText("Edit Product Barcode"), "C-33");
    fireEvent.press(screen.getByLabelText("Submit Product Update"));

    await waitFor(() => {
      expect(mockUpdateProduct).toHaveBeenCalledWith({
        productId: expect.any(Number),
        name: "Product C Updated",
        barcode: "C-33",
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Product C Updated")).toBeTruthy();
      expect(mockListProducts).toHaveBeenCalledTimes(3);
    });
    expect(mockListProducts.mock.invocationCallOrder[2]).toBeGreaterThan(
      mockUpdateProduct.mock.invocationCallOrder[0],
    );
  });

  it("enforces synchronous submit locking for rapid create and edit taps", async () => {
    await renderProductsRoute();

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner A")).toBeTruthy();
      expect(screen.getByText("Product A")).toBeTruthy();
    });

    const createResult = createDeferredPromise<{
      ok: true;
      value: ProductFixture;
    }>();
    mockCreateProduct.mockImplementationOnce(() => createResult.promise);

    fireEvent.changeText(screen.getByLabelText("Product Name"), "Product C");
    fireEvent.changeText(screen.getByLabelText("Product Barcode"), "C-3");
    fireEvent.press(screen.getByLabelText("Submit Create Product"));
    fireEvent.press(screen.getByLabelText("Submit Create Product"));

    expect(mockCreateProduct).toHaveBeenCalledTimes(1);

    ownerProducts[101] = [
      {
        id: 3,
        ownerId: 101,
        name: "Product C",
        barcode: "C-3",
        createdAtMs: 10,
        updatedAtMs: 10,
      },
      ...(ownerProducts[101] ?? []),
    ];

    createResult.resolve({
      ok: true,
      value: {
        id: 3,
        ownerId: 101,
        name: "Product C",
        barcode: "C-3",
        createdAtMs: 10,
        updatedAtMs: 10,
      },
    });

    await waitFor(() => {
      expect(screen.getByText("Product C")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Edit Product Product C"));

    const updateResult = createDeferredPromise<{
      ok: true;
      value: ProductFixture;
    }>();
    mockUpdateProduct.mockImplementationOnce(() => updateResult.promise);

    fireEvent.changeText(screen.getByLabelText("Edit Product Name"), "Product C Updated");
    fireEvent.changeText(screen.getByLabelText("Edit Product Barcode"), "C-33");
    fireEvent.press(screen.getByLabelText("Submit Product Update"));
    fireEvent.press(screen.getByLabelText("Submit Product Update"));

    expect(mockUpdateProduct).toHaveBeenCalledTimes(1);

    ownerProducts[101] = (ownerProducts[101] ?? []).map((product) =>
      product.id === 3
        ? {
            ...product,
            name: "Product C Updated",
            barcode: "C-33",
            updatedAtMs: 20,
          }
        : product,
    );

    updateResult.resolve({
      ok: true,
      value: {
        id: 3,
        ownerId: 101,
        name: "Product C Updated",
        barcode: "C-33",
        createdAtMs: 10,
        updatedAtMs: 20,
      },
    });

    await waitFor(() => {
      expect(screen.getByText("Product C Updated")).toBeTruthy();
    });
  });

  it("validates product inputs before submit and preserves inputs on conflict", async () => {
    await renderProductsRoute();

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner A")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText("Product Name"), "   ");
    fireEvent.changeText(screen.getByLabelText("Product Barcode"), "   ");
    fireEvent.press(screen.getByLabelText("Submit Create Product"));

    expect(mockCreateProduct).not.toHaveBeenCalled();
    expect(screen.getByText("Product name and barcode are required.")).toBeTruthy();

    mockCreateProduct.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "OWNER_SCOPE_CONFLICT",
        message: "A product with this barcode already exists for the active owner.",
      },
    });

    fireEvent.changeText(screen.getByLabelText("Product Name"), "Bread");
    fireEvent.changeText(screen.getByLabelText("Product Barcode"), "A-1");
    fireEvent.press(screen.getByLabelText("Submit Create Product"));

    await waitFor(() => {
      expect(
        screen.getByText("A product with this barcode already exists for the active owner."),
      ).toBeTruthy();
    });

    expect(screen.getByDisplayValue("Bread")).toBeTruthy();
    expect(screen.getByDisplayValue("A-1")).toBeTruthy();
  });

  it("allows the same barcode in a different owner after owner switch while keeping conflict handling owner-scoped", async () => {
    mockCreateProduct.mockImplementation(
      ({ name, barcode }: { name: string; barcode: string }) => {
        const activeOwner = require("@/domain/services/admin-session").getActiveOwner();
        if (!activeOwner) {
          return Promise.resolve({
            ok: false,
            error: {
              code: "OWNER_SCOPE_REQUIRES_ACTIVE_OWNER",
              message: "Select an active owner before managing owner-scoped data.",
            },
          });
        }

        const ownerId = activeOwner.id;
        const normalizedBarcode = barcode.trim().toLowerCase();
        const hasDuplicateForOwner = (ownerProducts[ownerId] ?? []).some(
          (product) => product.barcode.toLowerCase() === normalizedBarcode,
        );

        if (hasDuplicateForOwner) {
          return Promise.resolve({
            ok: false,
            error: {
              code: "OWNER_SCOPE_CONFLICT",
              message: "A product with this barcode already exists for the active owner.",
            },
          });
        }

        const nowMs = Date.now();
        const nextId =
          Math.max(0, ...(ownerProducts[ownerId] ?? []).map((product) => product.id)) + 1;
        const created = {
          id: nextId,
          ownerId,
          name,
          barcode,
          createdAtMs: nowMs,
          updatedAtMs: nowMs,
        };
        ownerProducts[ownerId] = [created, ...(ownerProducts[ownerId] ?? [])];

        return Promise.resolve({ ok: true, value: created });
      },
    );

    await renderProductsRoute();

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner A")).toBeTruthy();
      expect(screen.getByText("Product A")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText("Product Name"), "Owner A Duplicate");
    fireEvent.changeText(screen.getByLabelText("Product Barcode"), "a-1");
    fireEvent.press(screen.getByLabelText("Submit Create Product"));

    await waitFor(() => {
      expect(
        screen.getByText("A product with this barcode already exists for the active owner."),
      ).toBeTruthy();
    });

    expect(screen.getByDisplayValue("Owner A Duplicate")).toBeTruthy();
    expect(screen.getByDisplayValue("a-1")).toBeTruthy();

    act(() => {
      setActiveOwner({ id: 202, name: "Owner B" });
    });

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner B")).toBeTruthy();
      expect(screen.getByText("Product B")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText("Product Name"), "Owner B Reuse");
    fireEvent.changeText(screen.getByLabelText("Product Barcode"), "A-1");
    fireEvent.press(screen.getByLabelText("Submit Create Product"));

    await waitFor(() => {
      expect(screen.getByText("Owner B Reuse")).toBeTruthy();
    });

    expect(screen.queryByDisplayValue("Owner A Duplicate")).toBeFalsy();
    expect(ownerProducts[202].some((product) => product.barcode === "A-1")).toBe(true);
  });

  it("preserves visible products and edit state on transient refresh failures", async () => {
    await renderProductsRoute();

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner A")).toBeTruthy();
      expect(screen.getByText("Product A")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Edit Product Product A"));
    fireEvent.changeText(screen.getByLabelText("Edit Product Name"), "Product A Updated");
    fireEvent.changeText(screen.getByLabelText("Edit Product Barcode"), "A-2");

    mockUpdateProduct.mockResolvedValueOnce({
      ok: true,
      value: {
        id: 1,
        ownerId: 101,
        name: "Product A Updated",
        barcode: "A-2",
        createdAtMs: 1,
        updatedAtMs: 10,
      },
    });
    mockListProducts.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "OWNER_SCOPE_REFRESH_FAILED",
        message: "Temporary refresh failure.",
      },
    });

    fireEvent.press(screen.getByLabelText("Submit Product Update"));

    await waitFor(() => {
      expect(screen.getByText("Temporary refresh failure.")).toBeTruthy();
      expect(mockListProducts).toHaveBeenCalledTimes(2);
    });

    expect(screen.getByText("Product A")).toBeTruthy();
    expect(screen.getByLabelText("Edit Product Name").props.value).toBe(
      "Product A Updated",
    );
    expect(screen.getByLabelText("Edit Product Barcode").props.value).toBe("A-2");
  });

  it("clears previous owner products when owner switch refresh fails", async () => {
    await renderProductsRoute();

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner A")).toBeTruthy();
      expect(screen.getByText("Product A")).toBeTruthy();
    });
    fireEvent.press(screen.getByLabelText("Edit Product Product A"));
    fireEvent.changeText(screen.getByLabelText("Edit Product Name"), "Owner A Edited");
    fireEvent.changeText(screen.getByLabelText("Edit Product Barcode"), "A-99");
    fireEvent.changeText(screen.getByLabelText("Product Name"), "Draft Product");
    fireEvent.changeText(screen.getByLabelText("Product Barcode"), "DRAFT-1");

    mockListProducts.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "OWNER_SCOPE_REFRESH_FAILED",
        message: "Owner switch refresh failed.",
      },
    });

    act(() => {
      setActiveOwner({ id: 202, name: "Owner B" });
    });

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner B")).toBeTruthy();
      expect(screen.getByText("Owner switch refresh failed.")).toBeTruthy();
      expect(screen.getByText("No products yet for this owner.")).toBeTruthy();
    });

    expect(screen.queryByText("Product A")).toBeFalsy();
    expect(screen.queryByText("Product B")).toBeFalsy();
    expect(screen.getByLabelText("Product Name").props.value).toBe("");
    expect(screen.getByLabelText("Product Barcode").props.value).toBe("");
    expect(screen.getByLabelText("Edit Product Name").props.value).toBe("");
    expect(screen.getByLabelText("Edit Product Barcode").props.value).toBe("");
  });

  it("ignores stale list/create responses when owner context changes mid-flight", async () => {
    const staleOwnerAList = createDeferredPromise<{
      ok: true;
      value: ProductFixture[];
    }>();
    mockListProducts.mockImplementationOnce(() => staleOwnerAList.promise);

    await renderProductsRoute();

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner A")).toBeTruthy();
    });

    act(() => {
      setActiveOwner({ id: 202, name: "Owner B" });
    });

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner B")).toBeTruthy();
      expect(screen.getByText("Product B")).toBeTruthy();
    });

    staleOwnerAList.resolve({
      ok: true,
      value: [
        {
          id: 1,
          ownerId: 101,
          name: "Product A",
          barcode: "A-1",
          createdAtMs: 1,
          updatedAtMs: 1,
        },
      ],
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText("Product A")).toBeFalsy();
    expect(screen.getByText("Product B")).toBeTruthy();

    const inFlightCreate = createDeferredPromise<{
      ok: true;
      value: ProductFixture;
    }>();
    mockCreateProduct.mockImplementationOnce(() => inFlightCreate.promise);

    fireEvent.changeText(screen.getByLabelText("Product Name"), "Old Owner Product");
    fireEvent.changeText(screen.getByLabelText("Product Barcode"), "OLD-9");
    fireEvent.press(screen.getByLabelText("Submit Create Product"));

    act(() => {
      setActiveOwner({ id: 101, name: "Owner A" });
    });

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner A")).toBeTruthy();
      expect(screen.getByText("Product A")).toBeTruthy();
    });

    const staleCreateRefresh = createDeferredPromise<{
      ok: true;
      value: ProductFixture[];
    }>();
    mockListProducts.mockImplementationOnce(() => staleCreateRefresh.promise);

    inFlightCreate.resolve({
      ok: true,
      value: {
        id: 77,
        ownerId: 202,
        name: "Old Owner Product",
        barcode: "OLD-9",
        createdAtMs: 10,
        updatedAtMs: 10,
      },
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText("Old Owner Product")).toBeFalsy();
    expect(screen.getByLabelText("Edit Product Name").props.value).toBe("");
    expect(screen.getByLabelText("Edit Product Barcode").props.value).toBe("");

    staleCreateRefresh.resolve({
      ok: true,
      value: ownerProducts[101].map((product) => ({ ...product })),
    });
  });

  it("ignores stale update success state when owner context changes mid-flight", async () => {
    await renderProductsRoute();

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner A")).toBeTruthy();
      expect(screen.getByText("Product A")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Edit Product Product A"));
    fireEvent.changeText(screen.getByLabelText("Edit Product Name"), "Owner A Edited");
    fireEvent.changeText(screen.getByLabelText("Edit Product Barcode"), "A-99");

    const inFlightUpdate = createDeferredPromise<{
      ok: true;
      value: ProductFixture;
    }>();
    mockUpdateProduct.mockImplementationOnce(() => inFlightUpdate.promise);
    fireEvent.press(screen.getByLabelText("Submit Product Update"));

    act(() => {
      setActiveOwner({ id: 202, name: "Owner B" });
    });

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner B")).toBeTruthy();
      expect(screen.getByText("Product B")).toBeTruthy();
    });

    const staleUpdateRefresh = createDeferredPromise<{
      ok: true;
      value: ProductFixture[];
    }>();
    mockListProducts.mockImplementationOnce(() => staleUpdateRefresh.promise);

    inFlightUpdate.resolve({
      ok: true,
      value: {
        id: 1,
        ownerId: 101,
        name: "Owner A Edited",
        barcode: "A-99",
        createdAtMs: 1,
        updatedAtMs: 20,
      },
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText("Owner A Edited")).toBeFalsy();
    expect(screen.getByLabelText("Edit Product Name").props.value).toBe("");
    expect(screen.getByLabelText("Edit Product Barcode").props.value).toBe("");

    staleUpdateRefresh.resolve({
      ok: true,
      value: ownerProducts[202].map((product) => ({ ...product })),
    });
  });

  it("keeps products isolated per owner after create and edit when switching owners", async () => {
    await renderProductsRoute();

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner A")).toBeTruthy();
      expect(screen.getByText("Product A")).toBeTruthy();
    });

    fireEvent.changeText(screen.getByLabelText("Product Name"), "Product C");
    fireEvent.changeText(screen.getByLabelText("Product Barcode"), "C-3");
    fireEvent.press(screen.getByLabelText("Submit Create Product"));

    await waitFor(() => {
      expect(screen.getByText("Product C")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Edit Product Product C"));
    fireEvent.changeText(screen.getByLabelText("Edit Product Name"), "Owner A Product C");
    fireEvent.changeText(screen.getByLabelText("Edit Product Barcode"), "A-C3");
    fireEvent.press(screen.getByLabelText("Submit Product Update"));

    await waitFor(() => {
      expect(screen.getByText("Owner A Product C")).toBeTruthy();
    });

    act(() => {
      setActiveOwner({ id: 202, name: "Owner B" });
    });

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner B")).toBeTruthy();
      expect(screen.getByText("Product B")).toBeTruthy();
    });

    expect(screen.queryByText("Owner A Product C")).toBeFalsy();
    expect(screen.queryByText("Product C")).toBeFalsy();
  });

  it("shows update conflict errors and preserves edit inputs", async () => {
    await renderProductsRoute();

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner A")).toBeTruthy();
      expect(screen.getByText("Product A")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Edit Product Product A"));
    fireEvent.changeText(screen.getByLabelText("Edit Product Name"), "Product A Edited");
    fireEvent.changeText(screen.getByLabelText("Edit Product Barcode"), "A-2");

    mockUpdateProduct.mockResolvedValueOnce({
      ok: false,
      error: {
        code: "OWNER_SCOPE_CONFLICT",
        message: "A product with this barcode already exists for the active owner.",
      },
    });

    fireEvent.press(screen.getByLabelText("Submit Product Update"));

    await waitFor(() => {
      expect(
        screen.getByText("A product with this barcode already exists for the active owner."),
      ).toBeTruthy();
    });

    expect(screen.getByDisplayValue("Product A Edited")).toBeTruthy();
    expect(screen.getByDisplayValue("A-2")).toBeTruthy();
  });
});
