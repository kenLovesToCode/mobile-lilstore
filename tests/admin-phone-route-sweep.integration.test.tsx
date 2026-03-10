const mockUseWindowDimensions = jest.fn(() => ({
  width: 390,
  height: 844,
  scale: 3,
  fontScale: 1,
}));
const mockIsReduceMotionEnabled = jest.fn<Promise<boolean>, []>();
const mockAddEventListener = jest.fn();

jest.mock("react-native", () => {
  const actual = jest.requireActual("react-native");
  actual.AccessibilityInfo = {
    ...actual.AccessibilityInfo,
    addEventListener: (...args: unknown[]) => mockAddEventListener(...args),
    isReduceMotionEnabled: () => mockIsReduceMotionEnabled(),
  };
  actual.useWindowDimensions = () => mockUseWindowDimensions();
  return actual;
});

jest.mock("react-native-reanimated", () => {
  const React = require("react");
  const { View } = require("react-native");

  function createAnimationBuilder() {
    return {
      delay() {
        return this;
      },
      reduceMotion() {
        return this;
      },
    };
  }

  const animationFactory = {
    duration() {
      return createAnimationBuilder();
    },
  };

  return {
    __esModule: true,
    default: {
      View: React.forwardRef((props: Record<string, unknown>, ref: unknown) => (
        <View ref={ref} {...props} />
      )),
    },
    FadeIn: animationFactory,
    FadeInDown: animationFactory,
    ReduceMotion: {
      System: "system",
    },
  };
});

import React from "react";
import { screen, waitFor } from "@testing-library/react-native";
import { renderRouter } from "expo-router/testing-library";

import { resolveMotionPressableTransform } from "@/components/ui/motion-pressable";
import {
  clearAdminSession,
  setActiveOwner,
  setAdminSession,
} from "@/domain/services/admin-session";
import { adminDesignTokens } from "@/tamagui";

const mockGetDashboardAlertsSnapshot = jest.fn();
const mockListOwners = jest.fn();
const mockSwitchActiveOwner = jest.fn();
const mockCreateOwner = jest.fn();
const mockListProducts = jest.fn();
const mockListShoppingListItems = jest.fn();
const mockArchiveProduct = jest.fn();
const mockCreateProduct = jest.fn();
const mockDeleteProduct = jest.fn();
const mockRestoreProduct = jest.fn();
const mockUpdateProduct = jest.fn();
const mockAddShoppingListItem = jest.fn();
const mockCreateAssortedShoppingListItem = jest.fn();
const mockRemoveAssortedShoppingListItem = jest.fn();
const mockRemoveShoppingListItem = jest.fn();
const mockUpdateAssortedShoppingListItem = jest.fn();
const mockUpdateShoppingListItem = jest.fn();
const mockGetOwnerScopedSnapshot = jest.fn();
const mockCreateShopper = jest.fn();
const mockUpdateShopper = jest.fn();
const mockRecordPayment = jest.fn();
const mockRecordPurchase = jest.fn();
const mockGetOwnerScopedHistorySnapshot = jest.fn();
const mockGetOwnerScopedPurchaseHistoryDetail = jest.fn();
const mockListShoppers = jest.fn();
const mockExportFullBackupToJsonFileAndShare = jest.fn();
const mockValidateBackupFromJsonFile = jest.fn();
const mockRestoreFullBackupFromJsonFile = jest.fn();

jest.mock("@/domain/services/dashboard-alerts-service", () => ({
  getDashboardAlertsSnapshot: (...args: unknown[]) =>
    mockGetDashboardAlertsSnapshot(...args),
}));

jest.mock("@/domain/services/owner-service", () => ({
  createOwner: (...args: unknown[]) => mockCreateOwner(...args),
  listOwners: (...args: unknown[]) => mockListOwners(...args),
  switchActiveOwner: (...args: unknown[]) => mockSwitchActiveOwner(...args),
}));

jest.mock("@/domain/services/owner-data-service", () => ({
  addShoppingListItem: (...args: unknown[]) => mockAddShoppingListItem(...args),
  archiveProduct: (...args: unknown[]) => mockArchiveProduct(...args),
  createAssortedShoppingListItem: (...args: unknown[]) =>
    mockCreateAssortedShoppingListItem(...args),
  createProduct: (...args: unknown[]) => mockCreateProduct(...args),
  createShopper: (...args: unknown[]) => mockCreateShopper(...args),
  deleteProduct: (...args: unknown[]) => mockDeleteProduct(...args),
  getOwnerScopedHistorySnapshot: (...args: unknown[]) =>
    mockGetOwnerScopedHistorySnapshot(...args),
  getOwnerScopedPurchaseHistoryDetail: (...args: unknown[]) =>
    mockGetOwnerScopedPurchaseHistoryDetail(...args),
  getOwnerScopedSnapshot: (...args: unknown[]) => mockGetOwnerScopedSnapshot(...args),
  listProducts: (...args: unknown[]) => mockListProducts(...args),
  listShoppingListItems: (...args: unknown[]) => mockListShoppingListItems(...args),
  listShoppers: (...args: unknown[]) => mockListShoppers(...args),
  recordPayment: (...args: unknown[]) => mockRecordPayment(...args),
  recordPurchase: (...args: unknown[]) => mockRecordPurchase(...args),
  removeAssortedShoppingListItem: (...args: unknown[]) =>
    mockRemoveAssortedShoppingListItem(...args),
  removeShoppingListItem: (...args: unknown[]) => mockRemoveShoppingListItem(...args),
  restoreProduct: (...args: unknown[]) => mockRestoreProduct(...args),
  updateAssortedShoppingListItem: (...args: unknown[]) =>
    mockUpdateAssortedShoppingListItem(...args),
  updateProduct: (...args: unknown[]) => mockUpdateProduct(...args),
  updateShopper: (...args: unknown[]) => mockUpdateShopper(...args),
  updateShoppingListItem: (...args: unknown[]) => mockUpdateShoppingListItem(...args),
}));

jest.mock("@/domain/services/backup-service", () => ({
  exportFullBackupToJsonFileAndShare: (...args: unknown[]) =>
    mockExportFullBackupToJsonFileAndShare(...args),
  restoreFullBackupFromJsonFile: (...args: unknown[]) =>
    mockRestoreFullBackupFromJsonFile(...args),
  validateBackupFromJsonFile: (...args: unknown[]) =>
    mockValidateBackupFromJsonFile(...args),
}));

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

type ScreenCase = {
  key: string;
  initialUrl: string;
  title: string;
  assertion: () => void;
};

const ROUTES = {
  "(admin)/_layout": require("../src/app/(admin)/_layout").default,
  "(admin)/(tabs)/_layout": require("../src/app/(admin)/(tabs)/_layout").default,
  "(admin)/(tabs)/dashboard": require("../src/app/(admin)/(tabs)/dashboard").default,
  "(admin)/(tabs)/products": require("../src/app/(admin)/(tabs)/products").default,
  "(admin)/(tabs)/shopping-list": require("../src/app/(admin)/(tabs)/shopping-list").default,
  "(admin)/(tabs)/more": require("../src/app/(admin)/(tabs)/more").default,
  "(admin)/(tabs)/owners": require("../src/app/(admin)/(tabs)/owners").default,
  "(admin)/(tabs)/owner-data": require("../src/app/(admin)/(tabs)/owner-data").default,
  "(admin)/(tabs)/history": require("../src/app/(admin)/(tabs)/history").default,
  "(admin)/(tabs)/data/export": require("../src/app/(admin)/(tabs)/data/export").default,
  "(admin)/(tabs)/data/restore": require("../src/app/(admin)/(tabs)/data/restore").default,
  "(admin)/login": () => null,
};

const SCREEN_CASES: ScreenCase[] = [
  {
    key: "dashboard",
    initialUrl: "/dashboard",
    title: "Store pulse",
    assertion: () => {
      expect(screen.getByTestId("offline-ready-section")).toBeTruthy();
    },
  },
  {
    key: "products",
    initialUrl: "/products",
    title: "Catalog workspace",
    assertion: () => {
      expect(screen.getByLabelText("Show Active Products")).toBeTruthy();
    },
  },
  {
    key: "shopping-list",
    initialUrl: "/shopping-list",
    title: "Sellable inventory",
    assertion: () => {
      expect(screen.getByLabelText("Focus Standard Shopping Workspace")).toBeTruthy();
    },
  },
  {
    key: "more",
    initialUrl: "/more",
    title: "More",
    assertion: () => {
      expect(screen.getByText("Owner tools and backups")).toBeTruthy();
    },
  },
  {
    key: "owners",
    initialUrl: "/owners",
    title: "Owners",
    assertion: () => {
      expect(screen.getByText("Switch active owner")).toBeTruthy();
    },
  },
  {
    key: "owner-data",
    initialUrl: "/owner-data",
    title: "Owner-Scoped Data",
    assertion: () => {
      expect(screen.getByText("Product actions")).toBeTruthy();
    },
  },
  {
    key: "history",
    initialUrl: "/history",
    title: "Purchase & Payment History",
    assertion: () => {
      expect(screen.getByText("History mode")).toBeTruthy();
    },
  },
  {
    key: "export",
    initialUrl: "/data/export",
    title: "Export Full Backup",
    assertion: () => {
      expect(screen.getByLabelText("Export Full Backup")).toBeTruthy();
    },
  },
  {
    key: "restore",
    initialUrl: "/data/restore",
    title: "Restore Full Backup",
    assertion: () => {
      expect(screen.getByLabelText("Confirm Replace All Restore")).toBeTruthy();
    },
  },
];

describe.each([
  { label: "reduced motion enabled", reduceMotion: true },
  { label: "reduced motion disabled", reduceMotion: false },
])("admin phone-sized route sweep with $label", ({ reduceMotion }) => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAdminSession();
    setAdminSession({ id: 1, username: "admin" });
    setActiveOwner({ id: 101, name: "Owner A" });

    mockUseWindowDimensions.mockReturnValue({
      width: 390,
      height: 844,
      scale: 3,
      fontScale: 1,
    });
    mockIsReduceMotionEnabled.mockResolvedValue(reduceMotion);
    mockAddEventListener.mockImplementation(() => ({ remove: jest.fn() }));

    mockGetDashboardAlertsSnapshot.mockResolvedValue({
      ok: true,
      value: {
        inventory: {
          totalCount: 1,
          zeroCount: 0,
          lowCount: 1,
          truncatedCount: 0,
          previewAlerts: [
            {
              itemType: "standard",
              itemId: 10,
              name: "Milk",
              quantity: 2,
              severity: "low",
              memberCount: 0,
            },
          ],
        },
        backupFreshness: {
          state: "fresh",
          stale: false,
          ageLabel: "5 minutes ago",
          lastBackupAtLabel: "2026-03-10T08:00:00.000Z",
          reminderText: "Backup is recent.",
        },
      },
    });

    mockListOwners.mockResolvedValue({
      ok: true,
      value: [
        { id: 101, name: "Owner A", createdAtMs: 1, updatedAtMs: 1 },
        { id: 102, name: "Owner B", createdAtMs: 2, updatedAtMs: 2 },
      ],
    });
    mockSwitchActiveOwner.mockResolvedValue({ ok: true, value: undefined });
    mockCreateOwner.mockResolvedValue({
      ok: true,
      value: { id: 103, name: "Owner C", createdAtMs: 3, updatedAtMs: 3 },
    });

    mockListProducts.mockResolvedValue({
      ok: true,
      value: [
        {
          id: 1,
          ownerId: 101,
          name: "Milk",
          barcode: "MILK-001",
          archivedAtMs: null,
          createdAtMs: 1,
          updatedAtMs: 1,
        },
        {
          id: 2,
          ownerId: 101,
          name: "Rice",
          barcode: "RICE-001",
          archivedAtMs: null,
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
    mockArchiveProduct.mockResolvedValue({ ok: true, value: undefined });
    mockCreateProduct.mockResolvedValue({
      ok: true,
      value: { id: 3, ownerId: 101, name: "Bread", barcode: "BREAD-001" },
    });
    mockDeleteProduct.mockResolvedValue({ ok: true, value: undefined });
    mockRestoreProduct.mockResolvedValue({ ok: true, value: undefined });
    mockUpdateProduct.mockResolvedValue({ ok: true, value: undefined });
    mockAddShoppingListItem.mockResolvedValue({ ok: true, value: undefined });
    mockCreateAssortedShoppingListItem.mockResolvedValue({ ok: true, value: undefined });
    mockRemoveAssortedShoppingListItem.mockResolvedValue({ ok: true, value: undefined });
    mockRemoveShoppingListItem.mockResolvedValue({ ok: true, value: undefined });
    mockUpdateAssortedShoppingListItem.mockResolvedValue({ ok: true, value: undefined });
    mockUpdateShoppingListItem.mockResolvedValue({ ok: true, value: undefined });

    mockGetOwnerScopedSnapshot.mockResolvedValue({
      ok: true,
      value: {
        products: [
          {
            id: 1,
            ownerId: 101,
            name: "Milk",
            barcode: "MILK-001",
            archivedAtMs: null,
            createdAtMs: 1,
            updatedAtMs: 1,
          },
          {
            id: 2,
            ownerId: 101,
            name: "Rice",
            barcode: "RICE-001",
            archivedAtMs: null,
            createdAtMs: 2,
            updatedAtMs: 2,
          },
        ],
        shoppers: [
          { id: 11, name: "Alice", pin: "1111", createdAtMs: 1, updatedAtMs: 1 },
          { id: 12, name: "Bob", pin: "2222", createdAtMs: 2, updatedAtMs: 2 },
        ],
        shoppingList: [
          {
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
        ],
        purchases: [
          {
            id: 401,
            ownerId: 101,
            shopperId: 11,
            totalCents: 350,
            createdAtMs: 1_700_000_000_000,
            updatedAtMs: 1_700_000_000_000,
          },
        ],
        payments: [
          {
            id: 501,
            ownerId: 101,
            shopperId: 11,
            amountCents: 200,
            createdAtMs: 1_700_000_100_000,
            updatedAtMs: 1_700_000_100_000,
          },
        ],
        history: [
          {
            kind: "purchase",
            id: 401,
            ownerId: 101,
            shopperId: 11,
            createdAtMs: 1_700_000_000_000,
          },
          {
            kind: "payment",
            id: 501,
            ownerId: 101,
            shopperId: 11,
            createdAtMs: 1_700_000_100_000,
          },
        ],
        shopperBalances: [
          {
            shopperId: 11,
            shopperName: "Alice",
            balanceCents: 350,
            updatedAtMs: 1,
          },
        ],
      },
    });
    mockCreateShopper.mockResolvedValue({ ok: true, value: undefined });
    mockUpdateShopper.mockResolvedValue({ ok: true, value: undefined });
    mockRecordPayment.mockResolvedValue({
      ok: true,
      value: { createdAtMs: 1 },
    });
    mockRecordPurchase.mockResolvedValue({ ok: true, value: undefined });

    mockListShoppers.mockResolvedValue({
      ok: true,
      value: [
        { id: 11, ownerId: 101, name: "Alice", createdAtMs: 1, updatedAtMs: 1 },
        { id: 12, ownerId: 101, name: "Bob", createdAtMs: 2, updatedAtMs: 2 },
      ],
    });
    mockGetOwnerScopedHistorySnapshot.mockResolvedValue({
      ok: true,
      value: {
        purchases: [
          {
            id: 401,
            shopperId: 11,
            shopperName: "Alice",
            totalCents: 350,
            itemCount: 2,
            createdAtMs: 1_700_000_000_000,
          },
        ],
        payments: [
          {
            id: 501,
            shopperId: 11,
            shopperName: "Alice",
            amountCents: 200,
            createdAtMs: 1_700_000_100_000,
          },
        ],
      },
    });
    mockGetOwnerScopedPurchaseHistoryDetail.mockResolvedValue({
      ok: true,
      value: {
        purchase: {
          id: 401,
          shopperId: 11,
          shopperName: "Alice",
          totalCents: 350,
          createdAtMs: 1_700_000_000_000,
        },
        lines: [
          {
            id: 1,
            itemName: "Milk",
            quantity: 2,
            lineTotalCents: 350,
            unitPriceCents: 175,
            bundleQty: null,
            bundlePriceCents: null,
          },
        ],
      },
    });

    mockExportFullBackupToJsonFileAndShare.mockResolvedValue({
      ok: true,
      value: {
        fileName: "lilstore-backup.json",
        exportedAt: "2026-03-10T08:00:00.000Z",
        shareTriggered: true,
        shareMessage: "Share sheet opened.",
      },
    });
    mockValidateBackupFromJsonFile.mockResolvedValue({
      ok: true,
      value: {
        schemaVersion: 1,
        exportedAt: "2026-03-10T08:00:00.000Z",
        counts: {
          admin: 1,
          appSecret: 1,
          storeOwner: 2,
          product: 2,
          shopper: 2,
          shoppingListItem: 1,
          shoppingListAssortedItem: 1,
          shoppingListAssortedMember: 2,
          purchase: 1,
          purchaseLineItem: 1,
          payment: 1,
        },
      },
    });
    mockRestoreFullBackupFromJsonFile.mockResolvedValue({
      ok: true,
      value: {
        schemaVersion: 1,
        exportedAt: "2026-03-10T08:00:00.000Z",
        restoredAt: "2026-03-10T08:05:00.000Z",
        counts: {
          admin: 1,
          appSecret: 1,
          storeOwner: 2,
          product: 2,
          shopper: 2,
          shoppingListItem: 1,
          shoppingListAssortedItem: 1,
          shoppingListAssortedMember: 2,
          purchase: 1,
          purchaseLineItem: 1,
          payment: 1,
        },
      },
    });
  });

  it("resolves shared press transform only when reduced motion is off", async () => {
    const pressedTransform = resolveMotionPressableTransform(true, reduceMotion);
    const idleTransform = resolveMotionPressableTransform(false, reduceMotion);

    if (reduceMotion) {
      expect(pressedTransform).toBeUndefined();
    } else {
      expect(pressedTransform).toEqual([
        { scale: adminDesignTokens.motion.pressScale },
      ]);
    }

    expect(idleTransform).toBeUndefined();
  });

  it.each(SCREEN_CASES)(
    "renders $key on a phone-sized layout without motion-preference regressions",
    async ({ initialUrl, title, assertion }) => {
      const view = renderRouter(ROUTES, { initialUrl });

      await waitFor(() => {
        expect(screen.getAllByText(title).length).toBeGreaterThan(0);
      });

      expect(screen.getByTestId("admin-shell-owner")).toBeTruthy();
      assertion();

      view.unmount();
    },
  );
});
