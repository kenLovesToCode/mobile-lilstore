import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from "react-native";

import { AdminShell } from "@/components/ui/admin-shell";
import { ContextualEditorSurface } from "@/components/ui/contextual-editor-surface";
import { DashboardStatCard } from "@/components/ui/dashboard-stat-card";
import { IllustratedStateCard } from "@/components/ui/illustrated-state-card";
import { MotionPressable } from "@/components/ui/motion-pressable";
import { SegmentedModeToggle } from "@/components/ui/segmented-mode-toggle";
import { SelectionListCard } from "@/components/ui/selection-list-card";
import { SoftCard } from "@/components/ui/soft-card";
import { StatusChip } from "@/components/ui/status-chip";
import {
  getActiveOwner,
  getAdminSession,
  subscribeToAdminSession,
} from "@/domain/services/admin-session";
import {
  addShoppingListItem,
  createAssortedShoppingListItem,
  listProducts,
  listShoppingListItems,
  removeAssortedShoppingListItem,
  removeShoppingListItem,
  updateAssortedShoppingListItem,
  updateShoppingListItem,
} from "@/domain/services/owner-data-service";
import { adminDesignTokens, useAdminPalette } from "@/tamagui";

type ProductListItem = {
  id: number;
  name: string;
  barcode: string;
};

type StandardShoppingListRow = {
  itemType: "standard";
  id: number;
  productId: number;
  quantity: number;
  unitPriceCents: number;
  bundleQty: number | null;
  bundlePriceCents: number | null;
  createdAtMs: number;
  updatedAtMs: number;
};

type AssortedShoppingListRow = {
  itemType: "assorted";
  id: number;
  name: string;
  quantity: number;
  unitPriceCents: number;
  bundleQty: number | null;
  bundlePriceCents: number | null;
  memberProductIds: number[];
  memberCount: number;
  createdAtMs: number;
  updatedAtMs: number;
};

type ShoppingListRow = StandardShoppingListRow | AssortedShoppingListRow;

type ProductSectionRowProps = {
  product: ProductListItem;
  isSelected: boolean;
  onSelect: (productId: number) => void;
};

type StandardShoppingItemRowProps = {
  item: StandardShoppingListRow;
  isSelected: boolean;
  productName: string;
  onSelect: (item: StandardShoppingListRow) => void;
};

type AssortedShoppingItemRowProps = {
  item: AssortedShoppingListRow;
  isSelected: boolean;
  onSelect: (item: AssortedShoppingListRow) => void;
};

type MemberChipProps = {
  productId: number;
  label: string;
  selected: boolean;
  accessibilityLabel: string;
  disabled?: boolean;
  onToggle: (productId: number) => void;
};

const SHOPPING_LIST_FORM_INVALID_MESSAGE =
  "Select a product, set a non-negative unit price, set quantity above zero, and provide both bundle fields together when using bundle offers.";
const ASSORTED_FORM_INVALID_MESSAGE =
  "Assorted entry requires a name, at least two unique member products, non-negative unit price, positive quantity, and valid optional bundle fields.";
const REMOVE_CONFIRM_MESSAGE =
  "Press Remove Selected Shopping List Item again to confirm.";
const SELECTION_LIST_MAX_HEIGHT = 420;
const PERF_LOG_PREFIX = "[shopping-list-perf]";
const PERF_LOGGING_ENABLED = process.env.EXPO_PUBLIC_SHOPPING_LIST_PERF === "1";
const PERF_PROFILE_LABEL = process.env.EXPO_PUBLIC_SHOPPING_LIST_PERF_LABEL?.trim() || null;

type SelectionMetricTarget = "product" | "standard" | "assorted";

type PendingSelectionMetric = {
  target: SelectionMetricTarget;
  id: number;
  startedAtMs: number;
};

type ShoppingEditorIntent = "standard" | "assorted";

function getNowMs() {
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return performance.now();
  }
  return Date.now();
}

function toMetricMs(value: number) {
  return Number(value.toFixed(2));
}

function logPerfMetric(
  metric: string,
  payload: Record<string, number | string | boolean | null>,
) {
  if (!PERF_LOGGING_ENABLED) {
    return;
  }
  console.log(
    `${PERF_LOG_PREFIX} ${JSON.stringify({
      metric,
      timestamp: new Date().toISOString(),
      profileLabel: PERF_PROFILE_LABEL,
      ...payload,
    })}`,
  );
}

function parseIntegerInput(value: string): number | null {
  const normalized = value.trim();
  if (!/^-?\d+$/.test(normalized)) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isInteger(parsed) ? parsed : null;
}

function formatCurrencyFromCents(value: number) {
  return `₱${(value / 100).toFixed(2)}`;
}

function parseBundleInputs(
  quantityInput: string,
  priceInput: string,
): { bundleQty: number | null; bundlePriceCents: number | null } | null {
  const normalizedQuantity = quantityInput.trim();
  const normalizedPrice = priceInput.trim();

  if (normalizedQuantity.length === 0 && normalizedPrice.length === 0) {
    return { bundleQty: null, bundlePriceCents: null };
  }
  if (normalizedQuantity.length === 0 || normalizedPrice.length === 0) {
    return null;
  }

  const bundleQty = parseIntegerInput(normalizedQuantity);
  const bundlePriceCents = parseIntegerInput(normalizedPrice);
  if (
    bundleQty == null ||
    bundleQty < 2 ||
    bundlePriceCents == null ||
    bundlePriceCents <= 0
  ) {
    return null;
  }

  return {
    bundleQty,
    bundlePriceCents,
  };
}

function formatShoppingListMeta(item: StandardShoppingListRow) {
  const pricing = `Qty ${item.quantity} · ${formatCurrencyFromCents(item.unitPriceCents)}`;
  if (item.bundleQty == null || item.bundlePriceCents == null) {
    return pricing;
  }
  return `${pricing} · Bundle ${item.bundleQty} for ${formatCurrencyFromCents(item.bundlePriceCents)}`;
}

function formatAssortedMeta(item: AssortedShoppingListRow) {
  const pricing = `Qty ${item.quantity} · ${formatCurrencyFromCents(item.unitPriceCents)}`;
  if (item.bundleQty == null || item.bundlePriceCents == null) {
    return pricing;
  }
  return `${pricing} · Bundle ${item.bundleQty} for ${formatCurrencyFromCents(item.bundlePriceCents)}`;
}

function toggleMember(memberIds: number[], memberId: number) {
  if (memberIds.includes(memberId)) {
    return memberIds.filter((id) => id !== memberId);
  }
  return [...memberIds, memberId];
}

function normalizeSearchInput(value: string) {
  return value.trim().toLowerCase();
}

function mapStandardShoppingRow(item: {
  id: number;
  productId: number;
  quantity: number;
  unitPriceCents: number;
  bundleQty: number | null;
  bundlePriceCents: number | null;
  createdAtMs: number;
  updatedAtMs: number;
}): StandardShoppingListRow {
  return {
    itemType: "standard",
    id: item.id,
    productId: item.productId,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    bundleQty: item.bundleQty,
    bundlePriceCents: item.bundlePriceCents,
    createdAtMs: item.createdAtMs,
    updatedAtMs: item.updatedAtMs,
  };
}

function mapAssortedShoppingRow(item: {
  id: number;
  name: string;
  quantity: number;
  unitPriceCents: number;
  bundleQty: number | null;
  bundlePriceCents: number | null;
  memberProductIds: number[];
  memberCount: number;
  createdAtMs: number;
  updatedAtMs: number;
}): AssortedShoppingListRow {
  return {
    itemType: "assorted",
    id: item.id,
    name: item.name,
    quantity: item.quantity,
    unitPriceCents: item.unitPriceCents,
    bundleQty: item.bundleQty,
    bundlePriceCents: item.bundlePriceCents,
    memberProductIds: [...item.memberProductIds],
    memberCount: item.memberCount,
    createdAtMs: item.createdAtMs,
    updatedAtMs: item.updatedAtMs,
  };
}

const ProductSectionRow = React.memo(function ProductSectionRow({
  product,
  isSelected,
  onSelect,
}: ProductSectionRowProps) {
  const palette = useAdminPalette();

  return (
    <Pressable
      accessibilityLabel={`Select Product ${product.name}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={() => onSelect(product.id)}
      style={({ pressed }) => [
        styles.listItem,
        {
          backgroundColor: isSelected ? palette.primarySoft : palette.surface,
          borderColor: isSelected ? palette.primary : palette.borderSoft,
        },
        pressed && styles.listItemPressed,
      ]}
    >
      <Text style={[styles.listItemName, { color: palette.textStrong }]}>{product.name}</Text>
      <Text style={[styles.listItemMeta, { color: palette.text }]}>{product.barcode}</Text>
    </Pressable>
  );
});

const StandardShoppingItemRow = React.memo(function StandardShoppingItemRow({
  item,
  isSelected,
  productName,
  onSelect,
}: StandardShoppingItemRowProps) {
  const palette = useAdminPalette();

  return (
    <Pressable
      accessibilityLabel={`Edit Shopping List Item #${item.id}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={() => onSelect(item)}
      style={({ pressed }) => [
        styles.listItem,
        {
          backgroundColor: isSelected ? palette.primarySoft : palette.surface,
          borderColor: isSelected ? palette.primary : palette.borderSoft,
        },
        pressed && styles.listItemPressed,
      ]}
    >
      <Text style={[styles.listItemName, { color: palette.textStrong }]}>{productName}</Text>
      <Text style={[styles.listItemMeta, { color: palette.text }]}>
        {formatShoppingListMeta(item)}
      </Text>
    </Pressable>
  );
});

const AssortedShoppingItemRow = React.memo(function AssortedShoppingItemRow({
  item,
  isSelected,
  onSelect,
}: AssortedShoppingItemRowProps) {
  const palette = useAdminPalette();

  return (
    <Pressable
      accessibilityLabel={`Edit Assorted Shopping List Item #${item.id}`}
      accessibilityRole="button"
      accessibilityState={{ selected: isSelected }}
      onPress={() => onSelect(item)}
      style={({ pressed }) => [
        styles.listItem,
        {
          backgroundColor: isSelected ? palette.primarySoft : palette.surface,
          borderColor: isSelected ? palette.primary : palette.borderSoft,
        },
        pressed && styles.listItemPressed,
      ]}
    >
      <Text style={[styles.listItemName, { color: palette.textStrong }]}>
        {`${item.name} · ${item.memberCount} members`}
      </Text>
      <Text style={[styles.listItemMeta, { color: palette.text }]}>
        {formatAssortedMeta(item)}
      </Text>
    </Pressable>
  );
});

const MemberChip = React.memo(function MemberChip({
  productId,
  label,
  selected,
  accessibilityLabel,
  disabled,
  onToggle,
}: MemberChipProps) {
  const palette = useAdminPalette();

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected, disabled: Boolean(disabled) }}
      disabled={disabled}
      onPress={() => onToggle(productId)}
      style={({ pressed }) => [
        styles.memberChip,
        {
          backgroundColor: selected ? palette.primarySoft : palette.surface,
          borderColor: selected ? palette.primary : palette.borderSoft,
        },
        disabled && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={[styles.memberChipLabel, { color: palette.textStrong }]}>{label}</Text>
    </Pressable>
  );
});

export default function ShoppingListScreen() {
  const palette = useAdminPalette();
  const { width } = useWindowDimensions();
  const activeOwner = useSyncExternalStore(
    subscribeToAdminSession,
    getActiveOwner,
    () => null,
  );
  const adminSession = useSyncExternalStore(
    subscribeToAdminSession,
    getAdminSession,
    () => null,
  );
  const activeOwnerId = activeOwner?.id ?? null;
  const isWideLayout = width >= 1080;
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [shoppingList, setShoppingList] = useState<ShoppingListRow[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [selectedStandardItemId, setSelectedStandardItemId] = useState<number | null>(null);
  const [selectedAssortedItemId, setSelectedAssortedItemId] = useState<number | null>(null);
  const [createUnitPrice, setCreateUnitPrice] = useState("");
  const [createQuantity, setCreateQuantity] = useState("");
  const [createBundleQty, setCreateBundleQty] = useState("");
  const [createBundlePrice, setCreateBundlePrice] = useState("");
  const [editUnitPrice, setEditUnitPrice] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [editBundleQty, setEditBundleQty] = useState("");
  const [editBundlePrice, setEditBundlePrice] = useState("");

  const [createAssortedName, setCreateAssortedName] = useState("");
  const [createAssortedUnitPrice, setCreateAssortedUnitPrice] = useState("");
  const [createAssortedQuantity, setCreateAssortedQuantity] = useState("");
  const [createAssortedBundleQty, setCreateAssortedBundleQty] = useState("");
  const [createAssortedBundlePrice, setCreateAssortedBundlePrice] = useState("");
  const [createAssortedMemberIds, setCreateAssortedMemberIds] = useState<number[]>([]);

  const [editAssortedName, setEditAssortedName] = useState("");
  const [editAssortedUnitPrice, setEditAssortedUnitPrice] = useState("");
  const [editAssortedQuantity, setEditAssortedQuantity] = useState("");
  const [editAssortedBundleQty, setEditAssortedBundleQty] = useState("");
  const [editAssortedBundlePrice, setEditAssortedBundlePrice] = useState("");
  const [editAssortedMemberIds, setEditAssortedMemberIds] = useState<number[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const [shoppingSearchQuery, setShoppingSearchQuery] = useState("");
  const [shoppingViewMode, setShoppingViewMode] = useState<"all" | "standard" | "assorted">(
    "all",
  );
  const [shoppingEditorIntent, setShoppingEditorIntent] =
    useState<ShoppingEditorIntent>("standard");

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isCreatingAssorted, setIsCreatingAssorted] = useState(false);
  const [isUpdatingAssorted, setIsUpdatingAssorted] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeConfirmSelectionKey, setRemoveConfirmSelectionKey] = useState<string | null>(
    null,
  );
  const submitLockRef = useRef<
    "create" | "update" | "remove" | "create-assorted" | "update-assorted" | null
  >(null);
  const ownerContextVersionRef = useRef(0);
  const latestRefreshRequestRef = useRef(0);
  const selectedProductIdRef = useRef<number | null>(null);
  const selectedStandardItemIdRef = useRef<number | null>(null);
  const selectedAssortedItemIdRef = useRef<number | null>(null);
  const lastOwnerIdRef = useRef<number | null>(null);
  const pendingSelectionMetricRef = useRef<PendingSelectionMetric | null>(null);

  useEffect(() => {
    ownerContextVersionRef.current += 1;
  }, [activeOwnerId]);

  useEffect(() => {
    selectedProductIdRef.current = selectedProductId;
  }, [selectedProductId]);

  useEffect(() => {
    selectedStandardItemIdRef.current = selectedStandardItemId;
  }, [selectedStandardItemId]);

  useEffect(() => {
    selectedAssortedItemIdRef.current = selectedAssortedItemId;
  }, [selectedAssortedItemId]);

  const startSelectionMetric = useCallback((target: SelectionMetricTarget, id: number) => {
    if (!PERF_LOGGING_ENABLED) {
      return;
    }
    pendingSelectionMetricRef.current = {
      target,
      id,
      startedAtMs: getNowMs(),
    };
  }, []);

  useEffect(() => {
    const pendingMetric = pendingSelectionMetricRef.current;
    if (!pendingMetric) {
      return;
    }

    const isCompleted =
      (pendingMetric.target === "product" && selectedProductId === pendingMetric.id) ||
      (pendingMetric.target === "standard" && selectedStandardItemId === pendingMetric.id) ||
      (pendingMetric.target === "assorted" && selectedAssortedItemId === pendingMetric.id);
    if (!isCompleted) {
      return;
    }

    logPerfMetric("select_latency", {
      target: pendingMetric.target,
      selectedId: pendingMetric.id,
      durationMs: toMetricMs(getNowMs() - pendingMetric.startedAtMs),
      ownerId: activeOwnerId,
    });
    pendingSelectionMetricRef.current = null;
  }, [activeOwnerId, selectedAssortedItemId, selectedProductId, selectedStandardItemId]);

  const productsById = useMemo(() => {
    const map = new Map<number, ProductListItem>();
    for (const product of products) {
      map.set(product.id, product);
    }
    return map;
  }, [products]);

  const selectedStandardItem = useMemo(
    () =>
      shoppingList.find(
        (item): item is StandardShoppingListRow =>
          item.itemType === "standard" && item.id === selectedStandardItemId,
      ) ?? null,
    [shoppingList, selectedStandardItemId],
  );

  const selectedAssortedItem = useMemo(
    () =>
      shoppingList.find(
        (item): item is AssortedShoppingListRow =>
          item.itemType === "assorted" && item.id === selectedAssortedItemId,
      ) ?? null,
    [shoppingList, selectedAssortedItemId],
  );

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const normalizedProductSearchQuery = useMemo(
    () => normalizeSearchInput(productSearchQuery),
    [productSearchQuery],
  );
  const normalizedShoppingSearchQuery = useMemo(
    () => normalizeSearchInput(shoppingSearchQuery),
    [shoppingSearchQuery],
  );

  const filteredProducts = useMemo(() => {
    if (normalizedProductSearchQuery.length === 0) {
      return products;
    }

    return products.filter((product) =>
      `${product.name} ${product.barcode}`
        .toLowerCase()
        .includes(normalizedProductSearchQuery),
    );
  }, [normalizedProductSearchQuery, products]);

  const filteredShoppingList = useMemo(() => {
    const scopedRows =
      shoppingViewMode === "all"
        ? shoppingList
        : shoppingList.filter((item) => item.itemType === shoppingViewMode);
    if (normalizedShoppingSearchQuery.length === 0) {
      return scopedRows;
    }

    return scopedRows.filter((item) => {
      if (item.itemType === "standard") {
        const product = productsById.get(item.productId);
        const searchValue = `${product?.name ?? `Product #${item.productId}`} ${
          product?.barcode ?? ""
        } ${formatShoppingListMeta(item)}`.toLowerCase();
        return searchValue.includes(normalizedShoppingSearchQuery);
      }

      const memberNames = item.memberProductIds
        .map((memberId) => productsById.get(memberId)?.name ?? `Product #${memberId}`)
        .join(" ");
      const searchValue = `${item.name} ${memberNames} members ${item.memberCount} ${formatAssortedMeta(
        item,
      )}`.toLowerCase();
      return searchValue.includes(normalizedShoppingSearchQuery);
    });
  }, [normalizedShoppingSearchQuery, productsById, shoppingList, shoppingViewMode]);

  useEffect(() => {
    if (selectedStandardItemId != null) {
      const standardSelectionStillVisible = filteredShoppingList.some(
        (item) => item.itemType === "standard" && item.id === selectedStandardItemId,
      );
      if (!standardSelectionStillVisible) {
        setSelectedStandardItemId(null);
        setEditUnitPrice("");
        setEditQuantity("");
        setEditBundleQty("");
        setEditBundlePrice("");
        setRemoveConfirmSelectionKey((currentSelectionKey) =>
          currentSelectionKey?.startsWith("standard:") ? null : currentSelectionKey,
        );
      }
    }

    if (selectedAssortedItemId != null) {
      const assortedSelectionStillVisible = filteredShoppingList.some(
        (item) => item.itemType === "assorted" && item.id === selectedAssortedItemId,
      );
      if (!assortedSelectionStillVisible) {
        setSelectedAssortedItemId(null);
        setEditAssortedName("");
        setEditAssortedUnitPrice("");
        setEditAssortedQuantity("");
        setEditAssortedBundleQty("");
        setEditAssortedBundlePrice("");
        setEditAssortedMemberIds([]);
        setRemoveConfirmSelectionKey((currentSelectionKey) =>
          currentSelectionKey?.startsWith("assorted:") ? null : currentSelectionKey,
        );
      }
    }
  }, [filteredShoppingList, selectedAssortedItemId, selectedStandardItemId]);

  const refreshData = useCallback(async () => {
    if (activeOwnerId == null) {
      return;
    }

    const ownerContextVersion = ownerContextVersionRef.current;
    const refreshRequestId = latestRefreshRequestRef.current + 1;
    latestRefreshRequestRef.current = refreshRequestId;

    setIsRefreshing(true);
    try {
      const [productsResult, shoppingListResult] = await Promise.all([
        listProducts(),
        listShoppingListItems(),
      ]);
      if (
        ownerContextVersion !== ownerContextVersionRef.current ||
        refreshRequestId !== latestRefreshRequestRef.current
      ) {
        return;
      }

      if (!productsResult.ok) {
        setErrorMessage(productsResult.error.message);
        return;
      }
      if (!shoppingListResult.ok) {
        setErrorMessage(shoppingListResult.error.message);
        return;
      }
      const nextProducts = productsResult.value.map((product) => ({
        id: product.id,
        name: product.name,
        barcode: product.barcode,
      }));

      const standardRows: StandardShoppingListRow[] = [];
      const assortedRows: AssortedShoppingListRow[] = [];
      for (const item of shoppingListResult.value) {
        if ((item as { itemType?: string }).itemType === "assorted") {
          assortedRows.push(
            mapAssortedShoppingRow(
              item as {
                id: number;
                name: string;
                quantity: number;
                unitPriceCents: number;
                bundleQty: number | null;
                bundlePriceCents: number | null;
                memberProductIds: number[];
                memberCount: number;
                createdAtMs: number;
                updatedAtMs: number;
              },
            ),
          );
          continue;
        }

        if (typeof (item as { productId?: unknown }).productId === "number") {
          standardRows.push(
            mapStandardShoppingRow(
              item as {
                id: number;
                productId: number;
                quantity: number;
                unitPriceCents: number;
                bundleQty: number | null;
                bundlePriceCents: number | null;
                createdAtMs: number;
                updatedAtMs: number;
              },
            ),
          );
        }
      }

      const nextShoppingList: ShoppingListRow[] = [
        ...standardRows,
        ...assortedRows,
      ].sort((a, b) => {
        if (b.createdAtMs !== a.createdAtMs) {
          return b.createdAtMs - a.createdAtMs;
        }
        return b.id - a.id;
      });

      setProducts(nextProducts);
      setShoppingList(nextShoppingList);
      setErrorMessage(null);

      const currentSelectedProductId = selectedProductIdRef.current;
      if (
        currentSelectedProductId != null &&
        !nextProducts.some((product) => product.id === currentSelectedProductId)
      ) {
        setSelectedProductId(null);
      }

      const currentSelectedStandardItemId = selectedStandardItemIdRef.current;
      if (
        currentSelectedStandardItemId != null &&
        !nextShoppingList.some(
          (item) => item.itemType === "standard" && item.id === currentSelectedStandardItemId,
        )
      ) {
        setSelectedStandardItemId(null);
        setRemoveConfirmSelectionKey(null);
        setEditUnitPrice("");
        setEditQuantity("");
        setEditBundleQty("");
        setEditBundlePrice("");
      }

      const currentSelectedAssortedItemId = selectedAssortedItemIdRef.current;
      if (
        currentSelectedAssortedItemId != null &&
        !nextShoppingList.some(
          (item) => item.itemType === "assorted" && item.id === currentSelectedAssortedItemId,
        )
      ) {
        setSelectedAssortedItemId(null);
        setEditAssortedName("");
        setEditAssortedQuantity("");
        setEditAssortedUnitPrice("");
        setEditAssortedBundleQty("");
        setEditAssortedBundlePrice("");
        setEditAssortedMemberIds([]);
      }
    } catch {
      if (
        ownerContextVersion !== ownerContextVersionRef.current ||
        refreshRequestId !== latestRefreshRequestRef.current
      ) {
        return;
      }
      setErrorMessage("Unable to refresh shopping list right now. Please try again.");
    } finally {
      if (
        ownerContextVersion === ownerContextVersionRef.current &&
        refreshRequestId === latestRefreshRequestRef.current
      ) {
        setIsRefreshing(false);
      }
    }
  }, [activeOwnerId]);

  useEffect(() => {
    if (activeOwnerId == null) {
      setProducts([]);
      setShoppingList([]);
      setShoppingEditorIntent("standard");
      setShoppingViewMode("all");
      setSelectedProductId(null);
      setSelectedStandardItemId(null);
      setSelectedAssortedItemId(null);
      setCreateUnitPrice("");
      setCreateQuantity("");
      setCreateBundleQty("");
      setCreateBundlePrice("");
      setEditUnitPrice("");
      setEditQuantity("");
      setEditBundleQty("");
      setEditBundlePrice("");
      setCreateAssortedName("");
      setCreateAssortedUnitPrice("");
      setCreateAssortedQuantity("");
      setCreateAssortedBundleQty("");
      setCreateAssortedBundlePrice("");
      setCreateAssortedMemberIds([]);
      setEditAssortedName("");
      setEditAssortedUnitPrice("");
      setEditAssortedQuantity("");
      setEditAssortedBundleQty("");
      setEditAssortedBundlePrice("");
      setEditAssortedMemberIds([]);
      setProductSearchQuery("");
      setShoppingSearchQuery("");
      setErrorMessage(null);
      setIsRefreshing(false);
      setIsCreating(false);
      setIsUpdating(false);
      setIsCreatingAssorted(false);
      setIsUpdatingAssorted(false);
      setIsRemoving(false);
      setRemoveConfirmSelectionKey(null);
      lastOwnerIdRef.current = null;
      return;
    }

    if (lastOwnerIdRef.current !== activeOwnerId) {
      setProducts([]);
      setShoppingList([]);
      setShoppingEditorIntent("standard");
      setShoppingViewMode("all");
      setSelectedProductId(null);
      setSelectedStandardItemId(null);
      setSelectedAssortedItemId(null);
      setCreateUnitPrice("");
      setCreateQuantity("");
      setCreateBundleQty("");
      setCreateBundlePrice("");
      setEditUnitPrice("");
      setEditQuantity("");
      setEditBundleQty("");
      setEditBundlePrice("");
      setCreateAssortedName("");
      setCreateAssortedUnitPrice("");
      setCreateAssortedQuantity("");
      setCreateAssortedBundleQty("");
      setCreateAssortedBundlePrice("");
      setCreateAssortedMemberIds([]);
      setEditAssortedName("");
      setEditAssortedUnitPrice("");
      setEditAssortedQuantity("");
      setEditAssortedBundleQty("");
      setEditAssortedBundlePrice("");
      setEditAssortedMemberIds([]);
      setProductSearchQuery("");
      setShoppingSearchQuery("");
      setRemoveConfirmSelectionKey(null);
      setErrorMessage(null);
      lastOwnerIdRef.current = activeOwnerId;
    }

    void refreshData();
  }, [activeOwnerId, refreshData]);

  const onSelectProduct = useCallback((productId: number) => {
    startSelectionMetric("product", productId);
    setShoppingEditorIntent("standard");
    setSelectedProductId(productId);
    setSelectedStandardItemId(null);
    setSelectedAssortedItemId(null);
    setEditUnitPrice("");
    setEditQuantity("");
    setEditBundleQty("");
    setEditBundlePrice("");
    setEditAssortedName("");
    setEditAssortedUnitPrice("");
    setEditAssortedQuantity("");
    setEditAssortedBundleQty("");
    setEditAssortedBundlePrice("");
    setEditAssortedMemberIds([]);
    setRemoveConfirmSelectionKey(null);
    setErrorMessage(null);
  }, [startSelectionMetric]);

  const onSelectStandardItem = useCallback((item: StandardShoppingListRow) => {
    startSelectionMetric("standard", item.id);
    setShoppingEditorIntent("standard");
    setSelectedStandardItemId(item.id);
    setSelectedAssortedItemId(null);
    setSelectedProductId(item.productId);
    setEditUnitPrice(String(item.unitPriceCents));
    setEditQuantity(String(item.quantity));
    setEditBundleQty(item.bundleQty == null ? "" : String(item.bundleQty));
    setEditBundlePrice(item.bundlePriceCents == null ? "" : String(item.bundlePriceCents));
    setRemoveConfirmSelectionKey(null);
    setErrorMessage(null);
  }, [startSelectionMetric]);

  const onSelectAssortedItem = useCallback((item: AssortedShoppingListRow) => {
    startSelectionMetric("assorted", item.id);
    setShoppingEditorIntent("assorted");
    setSelectedAssortedItemId(item.id);
    setSelectedStandardItemId(null);
    setRemoveConfirmSelectionKey(null);
    setEditAssortedName(item.name);
    setEditAssortedUnitPrice(String(item.unitPriceCents));
    setEditAssortedQuantity(String(item.quantity));
    setEditAssortedBundleQty(item.bundleQty == null ? "" : String(item.bundleQty));
    setEditAssortedBundlePrice(
      item.bundlePriceCents == null ? "" : String(item.bundlePriceCents),
    );
    setEditAssortedMemberIds([...item.memberProductIds]);
    setErrorMessage(null);
  }, [startSelectionMetric]);

  const clearProductSearch = useCallback(() => {
    setProductSearchQuery("");
  }, []);

  const clearShoppingSearch = useCallback(() => {
    setShoppingSearchQuery("");
  }, []);

  const toggleCreateAssortedMember = useCallback((productId: number) => {
    setCreateAssortedMemberIds((current) => toggleMember(current, productId));
    setErrorMessage(null);
  }, []);

  const toggleEditAssortedMember = useCallback(
    (productId: number) => {
      if (selectedAssortedItemId == null) {
        return;
      }
      setEditAssortedMemberIds((current) => toggleMember(current, productId));
      setErrorMessage(null);
    },
    [selectedAssortedItemId],
  );

  const clearStandardSelection = useCallback(() => {
    setSelectedStandardItemId(null);
    setRemoveConfirmSelectionKey((currentSelectionKey) =>
      currentSelectionKey?.startsWith("standard:") ? null : currentSelectionKey,
    );
    setEditUnitPrice("");
    setEditQuantity("");
    setEditBundleQty("");
    setEditBundlePrice("");
  }, []);

  const clearAssortedSelection = useCallback(() => {
    setSelectedAssortedItemId(null);
    setRemoveConfirmSelectionKey((currentSelectionKey) =>
      currentSelectionKey?.startsWith("assorted:") ? null : currentSelectionKey,
    );
    setEditAssortedName("");
    setEditAssortedUnitPrice("");
    setEditAssortedQuantity("");
    setEditAssortedBundleQty("");
    setEditAssortedBundlePrice("");
    setEditAssortedMemberIds([]);
  }, []);

  const resetCreateAssortedDraft = useCallback(() => {
    setCreateAssortedName("");
    setCreateAssortedUnitPrice("");
    setCreateAssortedQuantity("");
    setCreateAssortedBundleQty("");
    setCreateAssortedBundlePrice("");
    setCreateAssortedMemberIds([]);
  }, []);

  const onSelectEditorIntent = useCallback(
    (nextIntent: ShoppingEditorIntent) => {
      setShoppingEditorIntent(nextIntent);
      setErrorMessage(null);
      if (nextIntent === "standard") {
        clearAssortedSelection();
        return;
      }
      clearStandardSelection();
    },
    [clearAssortedSelection, clearStandardSelection],
  );

  const onStartNewStandardDraft = useCallback(() => {
    setShoppingEditorIntent("standard");
    clearStandardSelection();
    setErrorMessage(null);
  }, [clearStandardSelection]);

  const onStartNewAssortedDraft = useCallback(() => {
    setShoppingEditorIntent("assorted");
    clearAssortedSelection();
    resetCreateAssortedDraft();
    setErrorMessage(null);
  }, [clearAssortedSelection, resetCreateAssortedDraft]);

  async function onCreateItem() {
    if (
      !activeOwner ||
      !selectedProductId ||
      isCreating ||
      isUpdating ||
      isCreatingAssorted ||
      isUpdatingAssorted ||
      isRemoving ||
      submitLockRef.current !== null
    ) {
      return;
    }

    const unitPriceCents = parseIntegerInput(createUnitPrice);
    const quantity = parseIntegerInput(createQuantity);
    const bundleInputs = parseBundleInputs(createBundleQty, createBundlePrice);
    if (
      unitPriceCents == null ||
      unitPriceCents < 0 ||
      quantity == null ||
      quantity <= 0 ||
      !bundleInputs
    ) {
      setErrorMessage(SHOPPING_LIST_FORM_INVALID_MESSAGE);
      return;
    }

    submitLockRef.current = "create";
    const ownerContextVersion = ownerContextVersionRef.current;
    setIsCreating(true);
    try {
      const result = await addShoppingListItem({
        productId: selectedProductId,
        unitPriceCents,
        quantity,
        bundleQty: bundleInputs.bundleQty,
        bundlePriceCents: bundleInputs.bundlePriceCents,
      });
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }

      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }

      setCreateUnitPrice("");
      setCreateQuantity("");
      setCreateBundleQty("");
      setCreateBundlePrice("");
      setShoppingEditorIntent("standard");
      setSelectedStandardItemId(result.value.id);
      setSelectedAssortedItemId(null);
      setEditUnitPrice(String(result.value.unitPriceCents));
      setEditQuantity(String(result.value.quantity));
      setEditBundleQty(result.value.bundleQty == null ? "" : String(result.value.bundleQty));
      setEditBundlePrice(
        result.value.bundlePriceCents == null ? "" : String(result.value.bundlePriceCents),
      );
      await refreshData();
    } catch {
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }
      setErrorMessage("Unable to create shopping-list item right now. Please try again.");
    } finally {
      if (submitLockRef.current === "create") {
        submitLockRef.current = null;
      }
      setIsCreating(false);
    }
  }

  async function onUpdateItem() {
    if (
      !activeOwner ||
      !selectedStandardItem ||
      isCreating ||
      isUpdating ||
      isCreatingAssorted ||
      isUpdatingAssorted ||
      isRemoving ||
      submitLockRef.current !== null
    ) {
      return;
    }

    const unitPriceCents = parseIntegerInput(editUnitPrice);
    const quantity = parseIntegerInput(editQuantity);
    const bundleInputs = parseBundleInputs(editBundleQty, editBundlePrice);
    if (
      unitPriceCents == null ||
      unitPriceCents < 0 ||
      quantity == null ||
      quantity <= 0 ||
      !bundleInputs
    ) {
      setErrorMessage(SHOPPING_LIST_FORM_INVALID_MESSAGE);
      return;
    }

    submitLockRef.current = "update";
    const updatedItemId = selectedStandardItem.id;
    const updateStartedAtMs = getNowMs();
    const ownerContextVersion = ownerContextVersionRef.current;
    setIsUpdating(true);
    try {
      const result = await updateShoppingListItem({
        itemId: updatedItemId,
        unitPriceCents,
        quantity,
        bundleQty: bundleInputs.bundleQty,
        bundlePriceCents: bundleInputs.bundlePriceCents,
      });
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }

      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }

      setEditUnitPrice(String(result.value.unitPriceCents));
      setEditQuantity(String(result.value.quantity));
      setEditBundleQty(result.value.bundleQty == null ? "" : String(result.value.bundleQty));
      setEditBundlePrice(
        result.value.bundlePriceCents == null ? "" : String(result.value.bundlePriceCents),
      );
      setRemoveConfirmSelectionKey(null);
      await refreshData();
      logPerfMetric("edit_save_latency", {
        target: "standard",
        itemId: updatedItemId,
        ownerId: activeOwnerId,
        durationMs: toMetricMs(getNowMs() - updateStartedAtMs),
      });
    } catch {
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }
      setErrorMessage("Unable to update shopping-list item right now. Please try again.");
    } finally {
      if (submitLockRef.current === "update") {
        submitLockRef.current = null;
      }
      setIsUpdating(false);
    }
  }

  async function onCreateAssortedItem() {
    if (
      !activeOwner ||
      isCreating ||
      isUpdating ||
      isCreatingAssorted ||
      isUpdatingAssorted ||
      isRemoving ||
      submitLockRef.current !== null
    ) {
      return;
    }

    const normalizedName = createAssortedName.trim();
    const unitPriceCents = parseIntegerInput(createAssortedUnitPrice);
    const quantity = parseIntegerInput(createAssortedQuantity);
    const bundleInputs = parseBundleInputs(createAssortedBundleQty, createAssortedBundlePrice);
    if (
      normalizedName.length === 0 ||
      unitPriceCents == null ||
      unitPriceCents < 0 ||
      quantity == null ||
      quantity <= 0 ||
      !bundleInputs ||
      createAssortedMemberIds.length < 2
    ) {
      setErrorMessage(ASSORTED_FORM_INVALID_MESSAGE);
      return;
    }

    submitLockRef.current = "create-assorted";
    const ownerContextVersion = ownerContextVersionRef.current;
    setIsCreatingAssorted(true);
    try {
      const result = await createAssortedShoppingListItem({
        name: normalizedName,
        quantity,
        unitPriceCents,
        bundleQty: bundleInputs.bundleQty,
        bundlePriceCents: bundleInputs.bundlePriceCents,
        memberProductIds: createAssortedMemberIds,
      });
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }

      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }

      resetCreateAssortedDraft();
      setShoppingEditorIntent("assorted");
      setSelectedAssortedItemId(result.value.id);
      setSelectedStandardItemId(null);
      setEditAssortedName(result.value.name);
      setEditAssortedUnitPrice(String(result.value.unitPriceCents));
      setEditAssortedQuantity(String(result.value.quantity));
      setEditAssortedBundleQty(
        result.value.bundleQty == null ? "" : String(result.value.bundleQty),
      );
      setEditAssortedBundlePrice(
        result.value.bundlePriceCents == null
          ? ""
          : String(result.value.bundlePriceCents),
      );
      setEditAssortedMemberIds([...result.value.memberProductIds]);
      await refreshData();
    } catch {
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }
      setErrorMessage("Unable to create assorted shopping-list item right now. Please try again.");
    } finally {
      if (submitLockRef.current === "create-assorted") {
        submitLockRef.current = null;
      }
      setIsCreatingAssorted(false);
    }
  }

  async function onUpdateAssortedItem() {
    if (
      !activeOwner ||
      !selectedAssortedItem ||
      isCreating ||
      isUpdating ||
      isCreatingAssorted ||
      isUpdatingAssorted ||
      isRemoving ||
      submitLockRef.current !== null
    ) {
      return;
    }

    const normalizedName = editAssortedName.trim();
    const unitPriceCents = parseIntegerInput(editAssortedUnitPrice);
    const quantity = parseIntegerInput(editAssortedQuantity);
    const bundleInputs = parseBundleInputs(editAssortedBundleQty, editAssortedBundlePrice);
    if (
      normalizedName.length === 0 ||
      unitPriceCents == null ||
      unitPriceCents < 0 ||
      quantity == null ||
      quantity <= 0 ||
      !bundleInputs ||
      editAssortedMemberIds.length < 2
    ) {
      setErrorMessage(ASSORTED_FORM_INVALID_MESSAGE);
      return;
    }

    submitLockRef.current = "update-assorted";
    const updatedItemId = selectedAssortedItem.id;
    const updateStartedAtMs = getNowMs();
    const ownerContextVersion = ownerContextVersionRef.current;
    setIsUpdatingAssorted(true);
    try {
      const result = await updateAssortedShoppingListItem({
        itemId: updatedItemId,
        name: normalizedName,
        quantity,
        unitPriceCents,
        bundleQty: bundleInputs.bundleQty,
        bundlePriceCents: bundleInputs.bundlePriceCents,
        memberProductIds: editAssortedMemberIds,
      });
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }

      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }

      setEditAssortedName(result.value.name);
      setEditAssortedUnitPrice(String(result.value.unitPriceCents));
      setEditAssortedQuantity(String(result.value.quantity));
      setEditAssortedBundleQty(
        result.value.bundleQty == null ? "" : String(result.value.bundleQty),
      );
      setEditAssortedBundlePrice(
        result.value.bundlePriceCents == null
          ? ""
          : String(result.value.bundlePriceCents),
      );
      setEditAssortedMemberIds([...result.value.memberProductIds]);
      await refreshData();
      logPerfMetric("edit_save_latency", {
        target: "assorted",
        itemId: updatedItemId,
        ownerId: activeOwnerId,
        durationMs: toMetricMs(getNowMs() - updateStartedAtMs),
      });
    } catch {
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }
      setErrorMessage("Unable to update assorted shopping-list item right now. Please try again.");
    } finally {
      if (submitLockRef.current === "update-assorted") {
        submitLockRef.current = null;
      }
      setIsUpdatingAssorted(false);
    }
  }

  async function onRemoveItem() {
    const selectedItemForRemoval = selectedStandardItem ?? selectedAssortedItem;
    if (
      !activeOwner ||
      !selectedItemForRemoval ||
      isCreating ||
      isUpdating ||
      isCreatingAssorted ||
      isUpdatingAssorted ||
      isRemoving ||
      submitLockRef.current !== null
    ) {
      return;
    }

    const removeSelectionKey = `${selectedItemForRemoval.itemType}:${selectedItemForRemoval.id}`;
    if (removeConfirmSelectionKey !== removeSelectionKey) {
      setRemoveConfirmSelectionKey(removeSelectionKey);
      setErrorMessage(null);
      return;
    }

    submitLockRef.current = "remove";
    const ownerContextVersion = ownerContextVersionRef.current;
    setIsRemoving(true);
    try {
      const result =
        selectedItemForRemoval.itemType === "standard"
          ? await removeShoppingListItem({
              itemId: selectedItemForRemoval.id,
            })
          : await removeAssortedShoppingListItem({
              itemId: selectedItemForRemoval.id,
            });
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }

      if (!result.ok) {
        setRemoveConfirmSelectionKey(null);
        setErrorMessage(result.error.message);
        return;
      }

      setRemoveConfirmSelectionKey(null);
      if (selectedItemForRemoval.itemType === "standard") {
        setSelectedStandardItemId(null);
        setEditUnitPrice("");
        setEditQuantity("");
        setEditBundleQty("");
        setEditBundlePrice("");
      } else {
        setSelectedAssortedItemId(null);
        setEditAssortedName("");
        setEditAssortedQuantity("");
        setEditAssortedUnitPrice("");
        setEditAssortedBundleQty("");
        setEditAssortedBundlePrice("");
        setEditAssortedMemberIds([]);
      }
      await refreshData();
    } catch {
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }
      setRemoveConfirmSelectionKey(null);
      setErrorMessage("Unable to remove shopping-list item right now. Please try again.");
    } finally {
      if (submitLockRef.current === "remove") {
        submitLockRef.current = null;
      }
      setIsRemoving(false);
    }
  }

  const productEmptyMessage = !activeOwner
    ? "Select an owner from Owners before publishing shopping-list items."
    : "No active products available for this owner.";
  const shoppingListEmptyMessage = !activeOwner
    ? "Shopping list is unavailable until an owner is selected."
    : "No published shopping-list items yet.";
  const filteredProductEmptyMessage =
    normalizedProductSearchQuery.length > 0
      ? "No active products match your search."
      : productEmptyMessage;
  const filteredShoppingListEmptyMessage =
    normalizedShoppingSearchQuery.length > 0
      ? "No shopping-list entries match your search."
      : shoppingListEmptyMessage;
  const isAnySubmitBusy =
    isCreating || isUpdating || isCreatingAssorted || isUpdatingAssorted || isRemoving;
  const createButtonDisabled = !activeOwner || !selectedProduct || isAnySubmitBusy;
  const updateButtonDisabled = !activeOwner || !selectedStandardItem || isAnySubmitBusy;
  const createAssortedButtonDisabled = !activeOwner || isAnySubmitBusy;
  const updateAssortedButtonDisabled = !activeOwner || !selectedAssortedItem || isAnySubmitBusy;
  const selectedItemForRemoval = selectedStandardItem ?? selectedAssortedItem;
  const removeButtonDisabled = !activeOwner || !selectedItemForRemoval || isAnySubmitBusy;
  const selectedRemoveItemType = selectedItemForRemoval?.itemType ?? null;
  const activeRemoveSelectionKey = selectedItemForRemoval
    ? `${selectedItemForRemoval.itemType}:${selectedItemForRemoval.id}`
    : null;
  const isRemoveConfirmArmed =
    activeRemoveSelectionKey != null && removeConfirmSelectionKey === activeRemoveSelectionKey;
  const removeButtonLabel =
    selectedRemoveItemType === "assorted"
      ? "Remove Assorted Shopping List Item"
      : "Remove Shopping List Item";
  const confirmRemoveButtonLabel =
    selectedRemoveItemType === "assorted"
      ? "Confirm Remove Assorted Shopping List Item"
      : "Confirm Remove Shopping List Item";
  const showProductSearchClear = productSearchQuery.length > 0;
  const showShoppingSearchClear = shoppingSearchQuery.length > 0;
  const showingStandardWorkspace = shoppingEditorIntent === "standard";
  const showingStandardEditSurface = showingStandardWorkspace && selectedStandardItem != null;
  const showingAssortedEditSurface =
    shoppingEditorIntent === "assorted" && selectedAssortedItem != null;

  const ownerStatusLabel = `Active owner: ${activeOwner?.name ?? "None selected"}`;

  return (
    <AdminShell
      adminUsername={adminSession?.username}
      eyebrow="Shopping"
      headerActions={(
        <MotionPressable
          accessibilityLabel="Refresh Shopping List"
          disabled={!activeOwner || isRefreshing}
          onPress={() => void refreshData()}
          tone="secondary"
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </MotionPressable>
      )}
      ownerName={activeOwner?.name ?? null}
      subtitle="Separate product discovery, published rows, and assorted-group work so the shopping flow feels tighter without changing owner-scoped rules."
      title="Sellable inventory"
    >
      <SoftCard style={styles.ownerCard} tone="info">
        <Text selectable style={[styles.ownerStatusText, { color: palette.textStrong }]}>
          {ownerStatusLabel}
        </Text>
        <Text style={[styles.ownerStatusCaption, { color: palette.text }]}>
          Showing {filteredProducts.length}/{products.length} products and{" "}
          {filteredShoppingList.length}/{shoppingList.length} published rows.
        </Text>
      </SoftCard>

      <View style={styles.statsRow}>
        <DashboardStatCard
          label="Active products"
          supportingText={filteredProductEmptyMessage}
          tone={!activeOwner ? "warning" : filteredProducts.length > 0 ? "success" : "default"}
          value={String(filteredProducts.length)}
        />
        <DashboardStatCard
          label="Published rows"
          supportingText={
            shoppingViewMode === "all"
              ? "Standard and assorted"
              : shoppingViewMode === "standard"
                ? "Standard only"
                : "Assorted only"
          }
          tone={!activeOwner ? "warning" : filteredShoppingList.length > 0 ? "info" : "default"}
          value={String(filteredShoppingList.length)}
        />
        <DashboardStatCard
          label="Selection"
          supportingText={
            selectedAssortedItem
              ? `${selectedAssortedItem.memberCount} members`
              : selectedStandardItem
                ? productsById.get(selectedStandardItem.productId)?.barcode ?? "Standard row"
                : selectedProduct?.barcode ?? "Nothing selected"
          }
          tone={selectedAssortedItem || selectedStandardItem || selectedProduct ? "info" : "default"}
          value={
            selectedAssortedItem
              ? selectedAssortedItem.name
              : selectedStandardItem
                ? productsById.get(selectedStandardItem.productId)?.name ?? `#${selectedStandardItem.id}`
                : selectedProduct?.name ?? "Ready"
          }
        />
      </View>

      {errorMessage ? (
        <SoftCard style={styles.feedbackCard} tone="danger">
          <Text selectable style={[styles.feedbackText, { color: palette.dangerText }]}>
            {errorMessage}
          </Text>
        </SoftCard>
      ) : null}

      {!activeOwner ? (
        <IllustratedStateCard
          description="Select an owner before you publish shopping rows or manage assorted groups."
          eyebrow="Owner scope"
          footer={(
            <MotionPressable
              accessibilityLabel="Open Owners for Shopping Setup"
              onPress={() => router.push("/owners")}
              tone="primary"
            >
              Choose owner
            </MotionPressable>
          )}
          symbol={{ ios: "cart.fill.badge.plus", android: "shopping_cart_checkout", web: "shopping_cart_checkout" }}
          title="Shopping rows are owner-scoped"
          tone="warning"
        />
      ) : (
        <View style={[styles.workspaceGrid, isWideLayout ? styles.workspaceGridWide : null]}>
          <View style={styles.primaryColumn} testID="shopping-list-sections">
            <SelectionListCard
              description="Search the live product catalog before publishing a row."
              eyebrow="Product discovery"
              summary={(
                <>
                  <StatusChip tone="success">Selected {selectedProduct?.name ?? "None"}</StatusChip>
                  <StatusChip tone="neutral">{filteredProducts.length} visible</StatusChip>
                </>
              )}
              title="Active Products"
            >
              <TextInput
                accessibilityLabel="Search Active Products"
                placeholder="Search products by name or barcode"
                placeholderTextColor={palette.muted}
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.borderSoft,
                    color: palette.textStrong,
                  },
                ]}
                value={productSearchQuery}
                onChangeText={setProductSearchQuery}
              />
              <MotionPressable
                accessibilityLabel="Search Active Products Clear"
                disabled={!showProductSearchClear}
                onPress={clearProductSearch}
                tone="secondary"
              >
                Clear Product Search
              </MotionPressable>
              {filteredProducts.length === 0 ? (
                <Text style={[styles.helperText, { color: palette.text }]}>
                  {filteredProductEmptyMessage}
                </Text>
              ) : (
                <FlatList
                  contentContainerStyle={styles.listContent}
                  data={filteredProducts}
                  extraData={selectedProductId}
                  initialNumToRender={18}
                  keyExtractor={(item) => String(item.id)}
                  keyboardShouldPersistTaps="handled"
                  maxToRenderPerBatch={24}
                  nestedScrollEnabled
                  renderItem={({ item }) => (
                    <ProductSectionRow
                      isSelected={selectedProductId === item.id}
                      onSelect={onSelectProduct}
                      product={item}
                    />
                  )}
                  showsVerticalScrollIndicator={false}
                  style={styles.boundedList}
                  testID="shopping-products-list"
                  windowSize={5}
                />
              )}
            </SelectionListCard>

            <SelectionListCard
              action={(
                <SegmentedModeToggle
                  options={[
                    { key: "all", label: "All rows", accessibilityLabel: "Show All Published Shopping Rows" },
                    { key: "standard", label: "Standard", accessibilityLabel: "Show Standard Shopping Rows" },
                    { key: "assorted", label: "Assorted", accessibilityLabel: "Show Assorted Shopping Rows" },
                  ]}
                  selectedKey={shoppingViewMode}
                  onSelect={setShoppingViewMode}
                />
              )}
              description="Published rows stay separate from product discovery so pricing edits stay readable."
              eyebrow="Published rows"
              summary={(
                <>
                  <StatusChip tone="info">
                    {shoppingViewMode === "all"
                      ? "All published rows"
                      : shoppingViewMode === "standard"
                        ? "Standard rows"
                        : "Assorted rows"}
                  </StatusChip>
                  <StatusChip tone="neutral">{filteredShoppingList.length} visible</StatusChip>
                </>
              )}
              title="Published Shopping List"
            >
              <TextInput
                accessibilityLabel="Search Published Shopping List"
                placeholder="Search shopping rows by product, barcode, or metadata"
                placeholderTextColor={palette.muted}
                style={[
                  styles.input,
                  {
                    backgroundColor: palette.surface,
                    borderColor: palette.borderSoft,
                    color: palette.textStrong,
                  },
                ]}
                value={shoppingSearchQuery}
                onChangeText={setShoppingSearchQuery}
              />
              <MotionPressable
                accessibilityLabel="Search Published Shopping List Clear"
                disabled={!showShoppingSearchClear}
                onPress={clearShoppingSearch}
                tone="secondary"
              >
                Clear Shopping Search
              </MotionPressable>
              {filteredShoppingList.length === 0 ? (
                <Text style={[styles.helperText, { color: palette.text }]}>
                  {filteredShoppingListEmptyMessage}
                </Text>
              ) : (
                <FlatList
                  contentContainerStyle={styles.listContent}
                  data={filteredShoppingList}
                  extraData={{
                    selectedAssortedItemId,
                    selectedStandardItemId,
                  }}
                  initialNumToRender={18}
                  keyExtractor={(item) => `${item.itemType}-${item.id}`}
                  keyboardShouldPersistTaps="handled"
                  maxToRenderPerBatch={24}
                  nestedScrollEnabled
                  renderItem={({ item }) =>
                    item.itemType === "standard" ? (
                      <StandardShoppingItemRow
                        isSelected={selectedStandardItemId === item.id}
                        item={item}
                        onSelect={onSelectStandardItem}
                        productName={
                          productsById.get(item.productId)?.name ?? `Product #${item.productId}`
                        }
                      />
                    ) : (
                      <AssortedShoppingItemRow
                        isSelected={selectedAssortedItemId === item.id}
                        item={item}
                        onSelect={onSelectAssortedItem}
                      />
                    )
                  }
                  showsVerticalScrollIndicator={false}
                  style={styles.boundedList}
                  testID="shopping-published-list"
                  windowSize={5}
                />
              )}
            </SelectionListCard>
          </View>

          <View style={styles.secondaryColumn}>
            <SoftCard style={styles.editorModeCard} tone="subtle">
              <Text style={[styles.editorModeLabel, { color: palette.muted }]}>
                Focus the workspace on one task at a time.
              </Text>
              <SegmentedModeToggle
                options={[
                  {
                    key: "standard",
                    label: "Standard row",
                    accessibilityLabel: "Focus Standard Shopping Workspace",
                    supportingText: showingStandardEditSurface ? "Editing selected row" : "Publish standard items",
                  },
                  {
                    key: "assorted",
                    label: "Assorted group",
                    accessibilityLabel: "Focus Assorted Shopping Workspace",
                    supportingText: showingAssortedEditSurface ? "Editing selected group" : "Build pooled offers",
                  },
                ]}
                selectedKey={shoppingEditorIntent}
                onSelect={(nextIntent) => {
                  if (nextIntent !== shoppingEditorIntent) {
                    onSelectEditorIntent(nextIntent);
                  }
                }}
              />
            </SoftCard>

            {showingStandardWorkspace ? (
              showingStandardEditSurface ? (
                <ContextualEditorSurface
                  description="Adjust live quantity or pricing for the selected standard row."
                  eyebrow="Standard row"
                  footer={(
                    <>
                      <MotionPressable
                        accessibilityLabel="Remove Selected Shopping List Item"
                        disabled={removeButtonDisabled}
                        onPress={() => void onRemoveItem()}
                        tone="danger"
                      >
                        {isRemoving
                          ? "Removing..."
                          : isRemoveConfirmArmed
                            ? confirmRemoveButtonLabel
                            : removeButtonLabel}
                      </MotionPressable>
                      <MotionPressable
                        accessibilityLabel="Start New Standard Shopping Draft"
                        disabled={isAnySubmitBusy}
                        onPress={onStartNewStandardDraft}
                        tone="secondary"
                      >
                        Start New Standard Shopping Draft
                      </MotionPressable>
                    </>
                  )}
                  title="Edit Shopping List Item"
                >
                  {selectedStandardItem ? (
                    <View
                      style={[
                        styles.selectedSummaryCard,
                        { backgroundColor: palette.surfaceMuted },
                      ]}
                    >
                      <Text style={[styles.selectedSummaryTitle, { color: palette.textStrong }]}>
                        {productsById.get(selectedStandardItem.productId)?.name ??
                          `Product #${selectedStandardItem.productId}`}
                      </Text>
                      <Text style={[styles.selectedSummaryMeta, { color: palette.text }]}>
                        {formatShoppingListMeta(selectedStandardItem)}
                      </Text>
                    </View>
                  ) : null}
                  <TextInput
                    accessibilityLabel="Edit Unit Price (Centavos)"
                    editable={Boolean(selectedStandardItem)}
                    keyboardType="number-pad"
                    placeholder="Edit unit price in centavos"
                    placeholderTextColor={palette.muted}
                    style={[
                      styles.input,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.borderSoft,
                        color: palette.textStrong,
                      },
                    ]}
                    value={editUnitPrice}
                    onChangeText={setEditUnitPrice}
                  />
                  <TextInput
                    accessibilityLabel="Edit Available Quantity"
                    editable={Boolean(selectedStandardItem)}
                    keyboardType="number-pad"
                    placeholder="Edit available quantity"
                    placeholderTextColor={palette.muted}
                    style={[
                      styles.input,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.borderSoft,
                        color: palette.textStrong,
                      },
                    ]}
                    value={editQuantity}
                    onChangeText={setEditQuantity}
                  />
                  <TextInput
                    accessibilityLabel="Edit Bundle Quantity (Optional)"
                    editable={Boolean(selectedStandardItem)}
                    keyboardType="number-pad"
                    placeholder="Edit bundle quantity (optional)"
                    placeholderTextColor={palette.muted}
                    style={[
                      styles.input,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.borderSoft,
                        color: palette.textStrong,
                      },
                    ]}
                    value={editBundleQty}
                    onChangeText={setEditBundleQty}
                  />
                  <TextInput
                    accessibilityLabel="Edit Bundle Price (Centavos, Optional)"
                    editable={Boolean(selectedStandardItem)}
                    keyboardType="number-pad"
                    placeholder="Edit bundle price in centavos (optional)"
                    placeholderTextColor={palette.muted}
                    style={[
                      styles.input,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.borderSoft,
                        color: palette.textStrong,
                      },
                    ]}
                    value={editBundlePrice}
                    onChangeText={setEditBundlePrice}
                  />
                  <MotionPressable
                    accessibilityLabel="Submit Shopping List Item Update"
                    disabled={updateButtonDisabled}
                    onPress={() => void onUpdateItem()}
                    tone="primary"
                  >
                    {isUpdating ? "Saving..." : "Save Shopping List Item"}
                  </MotionPressable>
                  {isRemoveConfirmArmed ? (
                    <Text style={[styles.warningText, { color: palette.dangerText }]}>
                      {REMOVE_CONFIRM_MESSAGE}
                    </Text>
                  ) : null}
                </ContextualEditorSurface>
              ) : (
                <ContextualEditorSurface
                  description={
                    selectedProduct
                      ? `Publishing ${selectedProduct.name} keeps the chosen product in context while you set price and quantity.`
                      : "Select an active product before you create a standard shopping-list row."
                  }
                  eyebrow="Standard publish"
                  title="Create Shopping List Item"
                  tone="accent"
                >
                  {selectedProduct ? (
                    <View
                      style={[
                        styles.selectedSummaryCard,
                        { backgroundColor: palette.surfaceMuted },
                      ]}
                    >
                      <Text style={[styles.selectedSummaryTitle, { color: palette.textStrong }]}>
                        {selectedProduct.name}
                      </Text>
                      <Text style={[styles.selectedSummaryMeta, { color: palette.text }]}>
                        Barcode {selectedProduct.barcode}
                      </Text>
                    </View>
                  ) : null}
                  <TextInput
                    accessibilityLabel="Unit Price (Centavos)"
                    keyboardType="number-pad"
                    placeholder="Unit price in centavos"
                    placeholderTextColor={palette.muted}
                    style={[
                      styles.input,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.borderSoft,
                        color: palette.textStrong,
                      },
                    ]}
                    value={createUnitPrice}
                    onChangeText={setCreateUnitPrice}
                  />
                  <TextInput
                    accessibilityLabel="Available Quantity"
                    keyboardType="number-pad"
                    placeholder="Available quantity"
                    placeholderTextColor={palette.muted}
                    style={[
                      styles.input,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.borderSoft,
                        color: palette.textStrong,
                      },
                    ]}
                    value={createQuantity}
                    onChangeText={setCreateQuantity}
                  />
                  <TextInput
                    accessibilityLabel="Bundle Quantity (Optional)"
                    keyboardType="number-pad"
                    placeholder="Bundle quantity (optional)"
                    placeholderTextColor={palette.muted}
                    style={[
                      styles.input,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.borderSoft,
                        color: palette.textStrong,
                      },
                    ]}
                    value={createBundleQty}
                    onChangeText={setCreateBundleQty}
                  />
                  <TextInput
                    accessibilityLabel="Bundle Price (Centavos, Optional)"
                    keyboardType="number-pad"
                    placeholder="Bundle price in centavos (optional)"
                    placeholderTextColor={palette.muted}
                    style={[
                      styles.input,
                      {
                        backgroundColor: palette.surface,
                        borderColor: palette.borderSoft,
                        color: palette.textStrong,
                      },
                    ]}
                    value={createBundlePrice}
                    onChangeText={setCreateBundlePrice}
                  />
                  <MotionPressable
                    accessibilityLabel="Submit Create Shopping List Item"
                    disabled={createButtonDisabled}
                    onPress={() => void onCreateItem()}
                    tone="primary"
                  >
                    {isCreating ? "Creating..." : "Create Shopping List Item"}
                  </MotionPressable>
                </ContextualEditorSurface>
              )
            ) : showingAssortedEditSurface ? (
              <ContextualEditorSurface
                description="Update assorted pricing, quantity, and member selection for the chosen row."
                eyebrow="Assorted row"
                footer={(
                  <>
                    <MotionPressable
                      accessibilityLabel="Remove Selected Shopping List Item"
                      disabled={removeButtonDisabled}
                      onPress={() => void onRemoveItem()}
                      tone="danger"
                    >
                      {isRemoving
                        ? "Removing..."
                        : isRemoveConfirmArmed
                          ? confirmRemoveButtonLabel
                          : removeButtonLabel}
                    </MotionPressable>
                    <MotionPressable
                      accessibilityLabel="Start New Assorted Shopping Draft"
                      disabled={isAnySubmitBusy}
                      onPress={onStartNewAssortedDraft}
                      tone="secondary"
                    >
                      Start New Assorted Shopping Draft
                    </MotionPressable>
                  </>
                )}
                title="Edit Assorted Shopping List Item"
              >
                {selectedAssortedItem ? (
                  <View
                    style={[
                      styles.selectedSummaryCard,
                      { backgroundColor: palette.surfaceMuted },
                    ]}
                  >
                    <Text style={[styles.selectedSummaryTitle, { color: palette.textStrong }]}>
                      {selectedAssortedItem.name}
                    </Text>
                    <Text style={[styles.selectedSummaryMeta, { color: palette.text }]}>
                      {formatAssortedMeta(selectedAssortedItem)}
                    </Text>
                  </View>
                ) : null}
                <TextInput
                  accessibilityLabel="Edit Assorted Entry Name"
                  editable={Boolean(selectedAssortedItem)}
                  placeholder="Edit assorted entry name"
                  placeholderTextColor={palette.muted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.borderSoft,
                      color: palette.textStrong,
                    },
                  ]}
                  value={editAssortedName}
                  onChangeText={setEditAssortedName}
                />
                <TextInput
                  accessibilityLabel="Edit Assorted Unit Price (Centavos)"
                  editable={Boolean(selectedAssortedItem)}
                  keyboardType="number-pad"
                  placeholder="Edit assorted unit price in centavos"
                  placeholderTextColor={palette.muted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.borderSoft,
                      color: palette.textStrong,
                    },
                  ]}
                  value={editAssortedUnitPrice}
                  onChangeText={setEditAssortedUnitPrice}
                />
                <TextInput
                  accessibilityLabel="Edit Assorted Available Quantity"
                  editable={Boolean(selectedAssortedItem)}
                  keyboardType="number-pad"
                  placeholder="Edit assorted available quantity"
                  placeholderTextColor={palette.muted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.borderSoft,
                      color: palette.textStrong,
                    },
                  ]}
                  value={editAssortedQuantity}
                  onChangeText={setEditAssortedQuantity}
                />
                <TextInput
                  accessibilityLabel="Edit Assorted Bundle Quantity (Optional)"
                  editable={Boolean(selectedAssortedItem)}
                  keyboardType="number-pad"
                  placeholder="Edit assorted bundle quantity (optional)"
                  placeholderTextColor={palette.muted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.borderSoft,
                      color: palette.textStrong,
                    },
                  ]}
                  value={editAssortedBundleQty}
                  onChangeText={setEditAssortedBundleQty}
                />
                <TextInput
                  accessibilityLabel="Edit Assorted Bundle Price (Centavos, Optional)"
                  editable={Boolean(selectedAssortedItem)}
                  keyboardType="number-pad"
                  placeholder="Edit assorted bundle price in centavos (optional)"
                  placeholderTextColor={palette.muted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.borderSoft,
                      color: palette.textStrong,
                    },
                  ]}
                  value={editAssortedBundlePrice}
                  onChangeText={setEditAssortedBundlePrice}
                />
                <Text style={[styles.memberLabel, { color: palette.text }]}>Edit Assorted Members</Text>
                {selectedAssortedItem ? (
                  <View style={styles.memberGrid}>
                    {products.map((product) => (
                      <MemberChip
                        accessibilityLabel={`Toggle Edit Assorted Member ${product.name}`}
                        key={`edit-assorted-member-${product.id}`}
                        label={product.name}
                        onToggle={toggleEditAssortedMember}
                        productId={product.id}
                        selected={editAssortedMemberIds.includes(product.id)}
                      />
                    ))}
                  </View>
                ) : null}
                <MotionPressable
                  accessibilityLabel="Submit Assorted Shopping List Item Update"
                  disabled={updateAssortedButtonDisabled}
                  onPress={() => void onUpdateAssortedItem()}
                  tone="primary"
                >
                  {isUpdatingAssorted ? "Saving..." : "Save Assorted Shopping List Item"}
                </MotionPressable>
                {isRemoveConfirmArmed ? (
                  <Text style={[styles.warningText, { color: palette.dangerText }]}>
                    {REMOVE_CONFIRM_MESSAGE}
                  </Text>
                ) : null}
              </ContextualEditorSurface>
            ) : (
              <ContextualEditorSurface
                description="Assorted groups keep their shared pricing and member selection in a dedicated surface."
                eyebrow="Assorted group"
                title="Create Assorted Shopping List Item"
                tone="accent"
              >
                <TextInput
                  accessibilityLabel="Assorted Entry Name"
                  placeholder="Assorted entry name"
                  placeholderTextColor={palette.muted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.borderSoft,
                      color: palette.textStrong,
                    },
                  ]}
                  value={createAssortedName}
                  onChangeText={setCreateAssortedName}
                />
                <TextInput
                  accessibilityLabel="Assorted Unit Price (Centavos)"
                  keyboardType="number-pad"
                  placeholder="Assorted unit price in centavos"
                  placeholderTextColor={palette.muted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.borderSoft,
                      color: palette.textStrong,
                    },
                  ]}
                  value={createAssortedUnitPrice}
                  onChangeText={setCreateAssortedUnitPrice}
                />
                <TextInput
                  accessibilityLabel="Assorted Available Quantity"
                  keyboardType="number-pad"
                  placeholder="Assorted available quantity"
                  placeholderTextColor={palette.muted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.borderSoft,
                      color: palette.textStrong,
                    },
                  ]}
                  value={createAssortedQuantity}
                  onChangeText={setCreateAssortedQuantity}
                />
                <TextInput
                  accessibilityLabel="Assorted Bundle Quantity (Optional)"
                  keyboardType="number-pad"
                  placeholder="Assorted bundle quantity (optional)"
                  placeholderTextColor={palette.muted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.borderSoft,
                      color: palette.textStrong,
                    },
                  ]}
                  value={createAssortedBundleQty}
                  onChangeText={setCreateAssortedBundleQty}
                />
                <TextInput
                  accessibilityLabel="Assorted Bundle Price (Centavos, Optional)"
                  keyboardType="number-pad"
                  placeholder="Assorted bundle price in centavos (optional)"
                  placeholderTextColor={palette.muted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.borderSoft,
                      color: palette.textStrong,
                    },
                  ]}
                  value={createAssortedBundlePrice}
                  onChangeText={setCreateAssortedBundlePrice}
                />
                <Text style={[styles.memberLabel, { color: palette.text }]}>
                  Assorted Members (select at least 2)
                </Text>
                <View style={styles.memberGrid}>
                  {products.map((product) => (
                    <MemberChip
                      accessibilityLabel={`Toggle Assorted Member ${product.name}`}
                      key={`create-assorted-member-${product.id}`}
                      label={product.name}
                      onToggle={toggleCreateAssortedMember}
                      productId={product.id}
                      selected={createAssortedMemberIds.includes(product.id)}
                    />
                  ))}
                </View>
                <MotionPressable
                  accessibilityLabel="Submit Create Assorted Shopping List Item"
                  disabled={createAssortedButtonDisabled}
                  onPress={() => void onCreateAssortedItem()}
                  tone="primary"
                >
                  {isCreatingAssorted ? "Creating..." : "Create Assorted Shopping List Item"}
                </MotionPressable>
              </ContextualEditorSurface>
            )}
          </View>
        </View>
      )}
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  ownerCard: {
    paddingHorizontal: adminDesignTokens.space.md,
    paddingVertical: adminDesignTokens.space.md,
  },
  ownerStatusText: {
    ...adminDesignTokens.typography.footerTitle,
  },
  ownerStatusCaption: {
    ...adminDesignTokens.typography.body,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: adminDesignTokens.space.sm,
  },
  feedbackCard: {
    paddingHorizontal: adminDesignTokens.space.md,
    paddingVertical: adminDesignTokens.space.sm,
  },
  feedbackText: {
    ...adminDesignTokens.typography.body,
  },
  workspaceGrid: {
    gap: adminDesignTokens.space.md,
  },
  workspaceGridWide: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  primaryColumn: {
    flex: 1.1,
    minWidth: 320,
    gap: adminDesignTokens.space.md,
  },
  secondaryColumn: {
    flex: 1,
    minWidth: 300,
    gap: adminDesignTokens.space.md,
  },
  editorModeCard: {
    paddingHorizontal: adminDesignTokens.space.md,
    paddingVertical: adminDesignTokens.space.md,
  },
  editorModeLabel: {
    ...adminDesignTokens.typography.sectionEyebrow,
    textTransform: "uppercase",
  },
  boundedList: {
    maxHeight: SELECTION_LIST_MAX_HEIGHT,
  },
  listContent: {
    gap: adminDesignTokens.space.xs,
  },
  helperText: {
    ...adminDesignTokens.typography.body,
  },
  listItem: {
    minHeight: adminDesignTokens.size.minTapTarget,
    borderWidth: 1,
    borderRadius: adminDesignTokens.radius.field,
    paddingHorizontal: adminDesignTokens.space.md,
    paddingVertical: adminDesignTokens.space.sm,
  },
  listItemPressed: {
    opacity: adminDesignTokens.motion.pressedOpacity,
  },
  listItemName: {
    ...adminDesignTokens.typography.footerTitle,
  },
  listItemMeta: {
    ...adminDesignTokens.typography.body,
  },
  input: {
    borderWidth: 1,
    borderRadius: adminDesignTokens.radius.field,
    minHeight: adminDesignTokens.size.minTapTarget,
    paddingHorizontal: adminDesignTokens.space.md,
    paddingVertical: adminDesignTokens.space.sm,
  },
  memberLabel: {
    ...adminDesignTokens.typography.body,
    fontWeight: "700",
  },
  memberGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: adminDesignTokens.space.xs,
  },
  memberChip: {
    minHeight: adminDesignTokens.size.minTapTarget,
    borderWidth: 1,
    borderRadius: adminDesignTokens.radius.pill,
    paddingHorizontal: adminDesignTokens.space.md,
    paddingVertical: adminDesignTokens.space.sm,
  },
  memberChipLabel: {
    ...adminDesignTokens.typography.button,
  },
  destructiveCopy: {
    ...adminDesignTokens.typography.body,
    fontWeight: "700",
  },
  warningText: {
    ...adminDesignTokens.typography.body,
    fontWeight: "700",
  },
  buttonPressed: {
    opacity: adminDesignTokens.motion.pressedOpacity,
  },
  buttonDisabled: {
    opacity: adminDesignTokens.motion.disabledOpacity,
  },
  selectedSummaryCard: {
    borderRadius: adminDesignTokens.radius.field,
    paddingHorizontal: adminDesignTokens.space.md,
    paddingVertical: adminDesignTokens.space.sm,
    gap: 4,
  },
  selectedSummaryTitle: {
    ...adminDesignTokens.typography.footerTitle,
  },
  selectedSummaryMeta: {
    ...adminDesignTokens.typography.body,
  },
});
