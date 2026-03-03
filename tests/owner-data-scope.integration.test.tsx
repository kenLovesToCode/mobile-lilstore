import { renderRouter, screen, waitFor } from "expo-router/testing-library";
import { act, fireEvent } from "@testing-library/react-native";

import {
  clearAdminSession,
  setActiveOwner,
  setAdminSession,
} from "@/domain/services/admin-session";

const mockGetOwnerScopedSnapshot = jest.fn();
const mockCreateShopper = jest.fn();
const mockUpdateShopper = jest.fn();

jest.mock("@/domain/services/owner-data-service", () => ({
  getOwnerScopedSnapshot: (...args: unknown[]) =>
    mockGetOwnerScopedSnapshot(...args),
  createProduct: jest.fn(),
  createShopper: (...args: unknown[]) => mockCreateShopper(...args),
  addShoppingListItem: jest.fn(),
  recordPurchase: jest.fn(),
  recordPayment: jest.fn(),
  updateProduct: jest.fn(),
  updateShopper: (...args: unknown[]) => mockUpdateShopper(...args),
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

  it("validates shopper pin format before create requests", async () => {
    renderRouter(ROUTES, { initialUrl: "/owner-data" });

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
    renderRouter(ROUTES, { initialUrl: "/owner-data" });

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

    renderRouter(ROUTES, { initialUrl: "/owner-data" });

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
});
