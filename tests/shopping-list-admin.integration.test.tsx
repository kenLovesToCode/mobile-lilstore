import { renderRouter, screen, waitFor } from "expo-router/testing-library";
import { act, fireEvent } from "@testing-library/react-native";

import {
  clearAdminSession,
  setActiveOwner,
  setAdminSession,
} from "@/domain/services/admin-session";

const mockListProducts = jest.fn();
const mockListShoppingListItems = jest.fn();
const mockAddShoppingListItem = jest.fn();
const mockUpdateShoppingListItem = jest.fn();
const mockRemoveShoppingListItem = jest.fn();
const originalConsoleError = console.error;

jest.mock("@/domain/services/owner-data-service", () => ({
  listProducts: (...args: unknown[]) => mockListProducts(...args),
  listShoppingListItems: (...args: unknown[]) => mockListShoppingListItems(...args),
  addShoppingListItem: (...args: unknown[]) => mockAddShoppingListItem(...args),
  updateShoppingListItem: (...args: unknown[]) => mockUpdateShoppingListItem(...args),
  removeShoppingListItem: (...args: unknown[]) => mockRemoveShoppingListItem(...args),
}));

const ROUTES = {
  "(admin)/_layout": require("../src/app/(admin)/_layout").default,
  "(admin)/shopping-list": require("../src/app/(admin)/shopping-list").default,
};

async function renderShoppingListRoute() {
  renderRouter(ROUTES, { initialUrl: "/shopping-list" });
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

type ShoppingListItemFixture = {
  id: number;
  ownerId: number;
  productId: number;
  quantity: number;
  unitPriceCents: number;
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

describe("shopping-list admin route integration", () => {
  let consoleErrorSpy: jest.SpyInstance;
  let ownerProducts: Record<number, ProductFixture[]>;
  let ownerShoppingList: Record<number, ShoppingListItemFixture[]>;

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
    clearAdminSession();
    setAdminSession({ id: 1, username: "admin" });
    setActiveOwner({ id: 101, name: "Owner A" });

    ownerProducts = {
      101: [
        {
          id: 1,
          ownerId: 101,
          name: "Milk",
          barcode: "A-1",
          createdAtMs: 1,
          updatedAtMs: 1,
        },
      ],
      202: [
        {
          id: 2,
          ownerId: 202,
          name: "Juice",
          barcode: "B-1",
          createdAtMs: 2,
          updatedAtMs: 2,
        },
      ],
    };

    ownerShoppingList = {
      101: [
        {
          id: 10,
          ownerId: 101,
          productId: 1,
          quantity: 2,
          unitPriceCents: 100,
          createdAtMs: 1,
          updatedAtMs: 1,
        },
      ],
      202: [
        {
          id: 20,
          ownerId: 202,
          productId: 2,
          quantity: 1,
          unitPriceCents: 300,
          createdAtMs: 2,
          updatedAtMs: 2,
        },
      ],
    };

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
        value: ownerProducts[activeOwner.id] ?? [],
      });
    });

    mockListShoppingListItems.mockImplementation(() => {
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
        value: ownerShoppingList[activeOwner.id] ?? [],
      });
    });

    mockAddShoppingListItem.mockImplementation(
      ({ productId, quantity, unitPriceCents }: { productId: number; quantity: number; unitPriceCents: number }) => {
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
          Math.max(0, ...(ownerShoppingList[ownerId] ?? []).map((item) => item.id)) + 1;
        const created = {
          id: nextId,
          ownerId,
          productId,
          quantity,
          unitPriceCents,
          createdAtMs: nowMs,
          updatedAtMs: nowMs,
        };
        ownerShoppingList[ownerId] = [created, ...(ownerShoppingList[ownerId] ?? [])];
        return Promise.resolve({ ok: true, value: created });
      },
    );

    mockUpdateShoppingListItem.mockImplementation(
      ({ itemId, quantity, unitPriceCents }: { itemId: number; quantity: number; unitPriceCents: number }) => {
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
        const currentItems = ownerShoppingList[ownerId] ?? [];
        const existing = currentItems.find((item) => item.id === itemId);
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
          quantity,
          unitPriceCents,
          updatedAtMs: Date.now(),
        };
        ownerShoppingList[ownerId] = currentItems.map((item) =>
          item.id === itemId ? updated : item,
        );
        return Promise.resolve({ ok: true, value: updated });
      },
    );

    mockRemoveShoppingListItem.mockImplementation(({ itemId }: { itemId: number }) => {
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
      ownerShoppingList[ownerId] = (ownerShoppingList[ownerId] ?? []).filter(
        (item) => item.id !== itemId,
      );
      return Promise.resolve({
        ok: true,
        value: {
          removedItemId: itemId,
        },
      });
    });
  });

  it("creates shopping-list items with explicit unit price and quantity", async () => {
    await renderShoppingListRoute();

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner A")).toBeTruthy();
      expect(screen.getByLabelText("Select Product Milk")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Select Product Milk"));
    fireEvent.changeText(screen.getByLabelText("Unit Price (Centavos)"), "250");
    fireEvent.changeText(screen.getByLabelText("Available Quantity"), "3");
    fireEvent.press(screen.getByLabelText("Submit Create Shopping List Item"));

    await waitFor(() => {
      expect(mockAddShoppingListItem).toHaveBeenCalledWith({
        productId: 1,
        unitPriceCents: 250,
        quantity: 3,
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Qty 3 · ₱2.50")).toBeTruthy();
    });
  });

  it("updates selected shopping-list item pricing and quantity", async () => {
    await renderShoppingListRoute();

    await waitFor(() => {
      expect(screen.getByText("Qty 2 · ₱1.00")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Edit Shopping List Item #10"));
    fireEvent.changeText(screen.getByLabelText("Edit Unit Price (Centavos)"), "180");
    fireEvent.changeText(screen.getByLabelText("Edit Available Quantity"), "4");
    fireEvent.press(screen.getByLabelText("Submit Shopping List Item Update"));

    await waitFor(() => {
      expect(mockUpdateShoppingListItem).toHaveBeenCalledWith({
        itemId: 10,
        unitPriceCents: 180,
        quantity: 4,
      });
    });

    await waitFor(() => {
      expect(screen.getByText("Qty 4 · ₱1.80")).toBeTruthy();
    });
  });

  it("requires explicit remove confirmation and then removes the selected item", async () => {
    await renderShoppingListRoute();

    await waitFor(() => {
      expect(screen.getByText("Qty 2 · ₱1.00")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Edit Shopping List Item #10"));
    fireEvent.press(screen.getByLabelText("Remove Selected Shopping List Item"));

    expect(mockRemoveShoppingListItem).not.toHaveBeenCalled();
    expect(
      screen.getAllByText("Press Remove Shopping List Item again to confirm.").length,
    ).toBe(1);

    fireEvent.press(screen.getByLabelText("Remove Selected Shopping List Item"));

    await waitFor(() => {
      expect(mockRemoveShoppingListItem).toHaveBeenCalledWith({
        itemId: 10,
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("Qty 2 · ₱1.00")).toBeFalsy();
    });
  });

  it("blocks create submits when numeric inputs are invalid", async () => {
    await renderShoppingListRoute();

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner A")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Select Product Milk"));
    fireEvent.changeText(screen.getByLabelText("Unit Price (Centavos)"), "-1");
    fireEvent.changeText(screen.getByLabelText("Available Quantity"), "0");
    fireEvent.press(screen.getByLabelText("Submit Create Shopping List Item"));

    expect(mockAddShoppingListItem).not.toHaveBeenCalled();
    expect(
      screen.getByText(
        "Select a product, set a non-negative unit price, and set quantity above zero.",
      ),
    ).toBeTruthy();
  });

  it("does not trigger list refetch when selecting a product", async () => {
    await renderShoppingListRoute();

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner A")).toBeTruthy();
      expect(screen.getByLabelText("Select Product Milk")).toBeTruthy();
    });

    const listProductsCallCount = mockListProducts.mock.calls.length;
    const listShoppingListCallCount = mockListShoppingListItems.mock.calls.length;

    fireEvent.press(screen.getByLabelText("Select Product Milk"));

    await act(async () => {
      await Promise.resolve();
    });

    expect(mockListProducts).toHaveBeenCalledTimes(listProductsCallCount);
    expect(mockListShoppingListItems).toHaveBeenCalledTimes(
      listShoppingListCallCount,
    );
  });

  it("ignores stale refresh responses after owner switch and resets item selection state", async () => {
    await renderShoppingListRoute();

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner A")).toBeTruthy();
      expect(screen.getByText("Qty 2 · ₱1.00")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Edit Shopping List Item #10"));
    fireEvent.changeText(screen.getByLabelText("Edit Unit Price (Centavos)"), "999");
    fireEvent.changeText(screen.getByLabelText("Edit Available Quantity"), "9");

    const staleOwnerAItems = createDeferredPromise<{
      ok: true;
      value: ShoppingListItemFixture[];
    }>();
    mockListShoppingListItems.mockImplementationOnce(() => staleOwnerAItems.promise);

    fireEvent.press(screen.getByLabelText("Refresh Shopping List"));

    act(() => {
      setActiveOwner({ id: 202, name: "Owner B" });
    });

    await waitFor(() => {
      expect(screen.getByText("Active owner: Owner B")).toBeTruthy();
      expect(screen.getByText("Qty 1 · ₱3.00")).toBeTruthy();
    });

    expect(screen.getByLabelText("Edit Unit Price (Centavos)").props.value).toBe("");
    expect(screen.getByLabelText("Edit Available Quantity").props.value).toBe("");

    staleOwnerAItems.resolve({
      ok: true,
      value: [
        {
          id: 10,
          ownerId: 101,
          productId: 1,
          quantity: 2,
          unitPriceCents: 100,
          createdAtMs: 1,
          updatedAtMs: 1,
        },
      ],
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.queryByText("Qty 2 · ₱1.00")).toBeFalsy();
    expect(screen.getByText("Qty 1 · ₱3.00")).toBeTruthy();
  });
});
