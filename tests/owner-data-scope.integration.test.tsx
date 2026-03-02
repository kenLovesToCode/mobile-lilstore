import { renderRouter, screen, waitFor } from "expo-router/testing-library";
import { act } from "@testing-library/react-native";

import {
  clearAdminSession,
  setActiveOwner,
  setAdminSession,
} from "@/domain/services/admin-session";

const mockGetOwnerScopedSnapshot = jest.fn();

jest.mock("@/domain/services/owner-data-service", () => ({
  getOwnerScopedSnapshot: (...args: unknown[]) =>
    mockGetOwnerScopedSnapshot(...args),
  createProduct: jest.fn(),
  createShopper: jest.fn(),
  addShoppingListItem: jest.fn(),
  recordPurchase: jest.fn(),
  recordPayment: jest.fn(),
  updateProduct: jest.fn(),
  updateShopper: jest.fn(),
  updateShoppingListItem: jest.fn(),
}));

const ROUTES = {
  "(admin)/_layout": require("../src/app/(admin)/_layout").default,
  "(admin)/owner-data": require("../src/app/(admin)/owner-data").default,
};

describe("owner-data owner-scope integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAdminSession();
    setAdminSession({ id: 1, username: "admin" });
    setActiveOwner({ id: 101, name: "Owner A" });

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
  });

  it("swaps visible data deterministically when active owner changes", async () => {
    renderRouter(ROUTES, { initialUrl: "/owner-data" });

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
});
