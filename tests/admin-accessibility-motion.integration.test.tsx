import React from "react";
import { fireEvent, renderRouter, screen, waitFor } from "expo-router/testing-library";

import {
  clearAdminSession,
  setActiveOwner,
  setAdminSession,
} from "@/domain/services/admin-session";

const mockListProducts = jest.fn();
const mockListShoppingListItems = jest.fn();
const mockAddShoppingListItem = jest.fn();
const mockCreateAssortedShoppingListItem = jest.fn();
const mockUpdateShoppingListItem = jest.fn();
const mockUpdateAssortedShoppingListItem = jest.fn();
const mockRemoveShoppingListItem = jest.fn();
const mockRemoveAssortedShoppingListItem = jest.fn();
const mockValidateBackupFromJsonFile = jest.fn();
const mockRestoreFullBackupFromJsonFile = jest.fn();
const mockGetDocumentAsync = jest.fn();

jest.mock("@/domain/services/owner-data-service", () => ({
  listProducts: (...args: unknown[]) => mockListProducts(...args),
  listShoppingListItems: (...args: unknown[]) => mockListShoppingListItems(...args),
  addShoppingListItem: (...args: unknown[]) => mockAddShoppingListItem(...args),
  createAssortedShoppingListItem: (...args: unknown[]) =>
    mockCreateAssortedShoppingListItem(...args),
  updateShoppingListItem: (...args: unknown[]) => mockUpdateShoppingListItem(...args),
  updateAssortedShoppingListItem: (...args: unknown[]) =>
    mockUpdateAssortedShoppingListItem(...args),
  removeShoppingListItem: (...args: unknown[]) => mockRemoveShoppingListItem(...args),
  removeAssortedShoppingListItem: (...args: unknown[]) =>
    mockRemoveAssortedShoppingListItem(...args),
}));

jest.mock("@/domain/services/backup-service", () => ({
  validateBackupFromJsonFile: (...args: unknown[]) => mockValidateBackupFromJsonFile(...args),
  restoreFullBackupFromJsonFile: (...args: unknown[]) =>
    mockRestoreFullBackupFromJsonFile(...args),
}));

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: (...args: unknown[]) => mockGetDocumentAsync(...args),
}));

const ROUTES = {
  "(admin)/_layout": require("../src/app/(admin)/_layout").default,
  "(admin)/(tabs)/_layout": require("../src/app/(admin)/(tabs)/_layout").default,
  "(admin)/(tabs)/dashboard": () => null,
  "(admin)/(tabs)/products": require("../src/app/(admin)/(tabs)/products").default,
  "(admin)/(tabs)/shopping-list": require("../src/app/(admin)/(tabs)/shopping-list").default,
  "(admin)/(tabs)/more": () => null,
  "(admin)/(tabs)/owners": () => null,
  "(admin)/(tabs)/owner-data": () => null,
  "(admin)/(tabs)/history": () => null,
  "(admin)/(tabs)/data/export": () => null,
  "(admin)/(tabs)/data/restore": require("../src/app/(admin)/(tabs)/data/restore").default,
  "(admin)/login": () => null,
};

describe("admin motion and accessibility semantics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAdminSession();
    setAdminSession({ id: 1, username: "admin" });
    setActiveOwner({ id: 101, name: "Owner A" });

    mockListProducts.mockResolvedValue({
      ok: true,
      value: [
        {
          id: 1,
          ownerId: 101,
          name: "Milk",
          barcode: "MILK-001",
          createdAtMs: 1,
          updatedAtMs: 1,
        },
        {
          id: 2,
          ownerId: 101,
          name: "Rice",
          barcode: "RICE-001",
          createdAtMs: 2,
          updatedAtMs: 2,
        },
      ],
    });
    mockListShoppingListItems.mockResolvedValue({
      ok: true,
      value: [
        {
          itemType: "standard",
          id: 10,
          ownerId: 101,
          productId: 1,
          quantity: 2,
          unitPriceCents: 100,
          bundleQty: null,
          bundlePriceCents: null,
          createdAtMs: 10,
          updatedAtMs: 10,
        },
        {
          itemType: "assorted",
          id: 20,
          ownerId: 101,
          name: "Breakfast Combo",
          quantity: 1,
          unitPriceCents: 180,
          bundleQty: null,
          bundlePriceCents: null,
          memberProductIds: [1, 2],
          memberCount: 2,
          createdAtMs: 20,
          updatedAtMs: 20,
        },
      ],
    });
    mockAddShoppingListItem.mockResolvedValue({ ok: true });
    mockCreateAssortedShoppingListItem.mockResolvedValue({ ok: true });
    mockUpdateShoppingListItem.mockResolvedValue({ ok: true });
    mockUpdateAssortedShoppingListItem.mockResolvedValue({ ok: true });
    mockRemoveShoppingListItem.mockResolvedValue({ ok: true });
    mockRemoveAssortedShoppingListItem.mockResolvedValue({ ok: true });

    mockGetDocumentAsync.mockResolvedValue({
      canceled: false,
      assets: [
        {
          name: "backup.json",
          uri: "file:///cache/backup.json",
          mimeType: "application/json",
          size: 256,
        },
      ],
    });
    mockValidateBackupFromJsonFile.mockResolvedValue({
      ok: true,
      value: {
        schemaVersion: 1,
        exportedAt: "2026-03-09T08:00:00.000Z",
        counts: {
          admin: 1,
          appSecret: 1,
          storeOwner: 1,
          product: 2,
          shopper: 1,
          shoppingListItem: 1,
          shoppingListAssortedItem: 1,
          shoppingListAssortedMember: 2,
          purchase: 0,
          purchaseLineItem: 0,
          payment: 0,
        },
      },
    });
    mockRestoreFullBackupFromJsonFile.mockResolvedValue({
      ok: true,
      value: {
        schemaVersion: 1,
        exportedAt: "2026-03-09T08:00:00.000Z",
        restoredAt: "2026-03-09T08:05:00.000Z",
        counts: {
          admin: 1,
          appSecret: 1,
          storeOwner: 1,
          product: 2,
          shopper: 1,
          shoppingListItem: 1,
          shoppingListAssortedItem: 1,
          shoppingListAssortedMember: 2,
          purchase: 0,
          purchaseLineItem: 0,
          payment: 0,
        },
      },
    });
  });

  it("marks the active tab and segmented lane with explicit selected state", async () => {
    renderRouter(ROUTES, { initialUrl: "/products" });

    await waitFor(() => {
      expect(screen.getByText("Catalog workspace")).toBeTruthy();
    });

    expect(screen.getByLabelText("Open Products tab").props.accessibilityRole).toBe("tab");
    expect(screen.getByLabelText("Open Products tab").props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByLabelText("Show Active Products").props.accessibilityRole).toBe("tab");
    expect(screen.getByLabelText("Show Active Products").props.accessibilityState).toMatchObject({
      selected: true,
    });

    fireEvent.press(screen.getByLabelText("Show Archived Products"));

    await waitFor(() => {
      expect(
        screen.getByLabelText("Show Archived Products").props.accessibilityState,
      ).toMatchObject({ selected: true });
    });
  });

  it("exposes shopping selection rows and assorted member toggles with stable state", async () => {
    renderRouter(ROUTES, { initialUrl: "/shopping-list" });

    await waitFor(() => {
      expect(screen.getByText("Sellable inventory")).toBeTruthy();
    });

    fireEvent.press(screen.getByLabelText("Select Product Milk"));

    await waitFor(() => {
      expect(screen.getByLabelText("Select Product Milk").props.accessibilityState).toMatchObject({
        selected: true,
      });
    });

    fireEvent.press(screen.getByLabelText("Edit Shopping List Item #10"));

    await waitFor(() => {
      expect(
        screen.getByLabelText("Edit Shopping List Item #10").props.accessibilityState,
      ).toMatchObject({ selected: true });
    });

    fireEvent.press(screen.getByLabelText("Focus Assorted Shopping Workspace"));

    await waitFor(() => {
      expect(
        screen.getByLabelText("Focus Assorted Shopping Workspace").props.accessibilityState,
      ).toMatchObject({ selected: true });
    });

    expect(screen.getByLabelText("Toggle Assorted Member Milk").props.accessibilityRole).toBe(
      "checkbox",
    );
    expect(screen.getByLabelText("Toggle Assorted Member Milk").props.accessibilityState).toMatchObject(
      { checked: false },
    );

    fireEvent.press(screen.getByLabelText("Toggle Assorted Member Milk"));

    await waitFor(() => {
      expect(
        screen.getByLabelText("Toggle Assorted Member Milk").props.accessibilityState,
      ).toMatchObject({ checked: true });
    });
  });

  it("keeps restore confirmation on explicit checkbox semantics before enabling the destructive action", async () => {
    renderRouter(ROUTES, { initialUrl: "/data/restore" });

    fireEvent.press(screen.getByLabelText("Pick Backup File"));

    await waitFor(() => {
      expect(screen.getByTestId("restore-preview")).toBeTruthy();
    });

    expect(screen.getByLabelText("Confirm Replace All Restore").props.accessibilityRole).toBe(
      "checkbox",
    );
    expect(screen.getByLabelText("Confirm Replace All Restore").props.accessibilityState).toMatchObject(
      { checked: false },
    );
    expect(screen.getByLabelText("Run Restore")).toBeDisabled();

    fireEvent.press(screen.getByLabelText("Confirm Replace All Restore"));

    await waitFor(() => {
      expect(
        screen.getByLabelText("Confirm Replace All Restore").props.accessibilityState,
      ).toMatchObject({ checked: true });
      expect(screen.getByLabelText("Run Restore")).not.toBeDisabled();
    });
  });
});
