import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getActiveOwner,
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

type ShoppingListSectionRow =
  | {
      kind: "product";
      product: ProductListItem;
    }
  | {
      kind: "shopping-item";
      item: ShoppingListRow;
    };

type ShoppingListSection = {
  key: "products" | "shopping";
  title: string;
  emptyMessage: string;
  data: ShoppingListSectionRow[];
};

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
const PERF_LOG_PREFIX = "[shopping-list-perf]";
const PERF_SCROLL_FRAME_GAP_JANK_MS = 24;
const PERF_LOGGING_ENABLED = process.env.EXPO_PUBLIC_SHOPPING_LIST_PERF === "1";
const PERF_PROFILE_LABEL = process.env.EXPO_PUBLIC_SHOPPING_LIST_PERF_LABEL?.trim() || null;

type SelectionMetricTarget = "product" | "standard" | "assorted";

type PendingSelectionMetric = {
  target: SelectionMetricTarget;
  id: number;
  startedAtMs: number;
};

type ActiveScrollLoopMetric = {
  startedAtMs: number;
  lastEventAtMs: number;
  eventCount: number;
  jankEventCount: number;
  maxGapMs: number;
  startedBy: "drag" | "momentum";
};

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
  return (
    <Pressable
      accessibilityLabel={`Select Product ${product.name}`}
      accessibilityRole="button"
      onPress={() => onSelect(product.id)}
      style={({ pressed }) => [
        styles.listItem,
        isSelected && styles.listItemSelected,
        pressed && styles.listItemPressed,
      ]}
    >
      <Text style={styles.listItemName}>{product.name}</Text>
      <Text style={styles.listItemMeta}>{product.barcode}</Text>
    </Pressable>
  );
});

const StandardShoppingItemRow = React.memo(function StandardShoppingItemRow({
  item,
  isSelected,
  productName,
  onSelect,
}: StandardShoppingItemRowProps) {
  return (
    <Pressable
      accessibilityLabel={`Edit Shopping List Item #${item.id}`}
      accessibilityRole="button"
      onPress={() => onSelect(item)}
      style={({ pressed }) => [
        styles.listItem,
        isSelected && styles.listItemSelected,
        pressed && styles.listItemPressed,
      ]}
    >
      <Text style={styles.listItemName}>{productName}</Text>
      <Text style={styles.listItemMeta}>{formatShoppingListMeta(item)}</Text>
    </Pressable>
  );
});

const AssortedShoppingItemRow = React.memo(function AssortedShoppingItemRow({
  item,
  isSelected,
  onSelect,
}: AssortedShoppingItemRowProps) {
  return (
    <Pressable
      accessibilityLabel={`Edit Assorted Shopping List Item #${item.id}`}
      accessibilityRole="button"
      onPress={() => onSelect(item)}
      style={({ pressed }) => [
        styles.listItem,
        isSelected && styles.listItemSelected,
        pressed && styles.listItemPressed,
      ]}
    >
      <Text style={styles.listItemName}>{`${item.name} · ${item.memberCount} members`}</Text>
      <Text style={styles.listItemMeta}>{formatAssortedMeta(item)}</Text>
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
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      disabled={disabled}
      onPress={() => onToggle(productId)}
      style={({ pressed }) => [
        styles.memberChip,
        selected && styles.memberChipSelected,
        disabled && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
    >
      <Text style={styles.memberChipLabel}>{label}</Text>
    </Pressable>
  );
});

export default function ShoppingListScreen() {
  const activeOwner = useSyncExternalStore(
    subscribeToAdminSession,
    getActiveOwner,
    () => null,
  );
  const activeOwnerId = activeOwner?.id ?? null;
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

  const [createAssortedName, setCreateAssortedName] = useState("Assorted");
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
  const activeScrollLoopMetricRef = useRef<ActiveScrollLoopMetric | null>(null);

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
    if (normalizedShoppingSearchQuery.length === 0) {
      return shoppingList;
    }

    return shoppingList.filter((item) => {
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
  }, [normalizedShoppingSearchQuery, productsById, shoppingList]);

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
      setCreateAssortedName("Assorted");
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
      setCreateAssortedName("Assorted");
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
    setSelectedProductId(productId);
    setErrorMessage(null);
  }, [startSelectionMetric]);

  const onSelectStandardItem = useCallback((item: StandardShoppingListRow) => {
    startSelectionMetric("standard", item.id);
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

  const beginScrollLoopMetric = useCallback((startedBy: "drag" | "momentum") => {
    if (!PERF_LOGGING_ENABLED) {
      return;
    }
    const nowMs = getNowMs();
    activeScrollLoopMetricRef.current = {
      startedAtMs: nowMs,
      lastEventAtMs: nowMs,
      eventCount: 0,
      jankEventCount: 0,
      maxGapMs: 0,
      startedBy,
    };
  }, []);

  const completeScrollLoopMetric = useCallback(
    (endedBy: "drag-end" | "momentum-end") => {
      if (!PERF_LOGGING_ENABLED) {
        return;
      }
      const activeMetric = activeScrollLoopMetricRef.current;
      if (!activeMetric) {
        return;
      }
      const durationMs = getNowMs() - activeMetric.startedAtMs;
      logPerfMetric("scroll_loop", {
        startedBy: activeMetric.startedBy,
        endedBy,
        ownerId: activeOwnerId,
        durationMs: toMetricMs(durationMs),
        eventCount: activeMetric.eventCount,
        jankEventCount: activeMetric.jankEventCount,
        maxGapMs: toMetricMs(activeMetric.maxGapMs),
      });
      activeScrollLoopMetricRef.current = null;
    },
    [activeOwnerId],
  );

  const onScroll = useCallback((_event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!PERF_LOGGING_ENABLED) {
      return;
    }
    const activeMetric = activeScrollLoopMetricRef.current;
    if (!activeMetric) {
      return;
    }

    const nowMs = getNowMs();
    const gapMs = nowMs - activeMetric.lastEventAtMs;
    if (activeMetric.eventCount > 0) {
      activeMetric.maxGapMs = Math.max(activeMetric.maxGapMs, gapMs);
      if (gapMs >= PERF_SCROLL_FRAME_GAP_JANK_MS) {
        activeMetric.jankEventCount += 1;
      }
    }
    activeMetric.lastEventAtMs = nowMs;
    activeMetric.eventCount += 1;
  }, []);

  const onScrollBeginDrag = useCallback(() => {
    beginScrollLoopMetric("drag");
  }, [beginScrollLoopMetric]);

  const onMomentumScrollBegin = useCallback(() => {
    if (activeScrollLoopMetricRef.current == null) {
      beginScrollLoopMetric("momentum");
    }
  }, [beginScrollLoopMetric]);

  const onScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const velocityY = Math.abs(event.nativeEvent.velocity?.y ?? 0);
      if (velocityY < 0.05) {
        completeScrollLoopMetric("drag-end");
      }
    },
    [completeScrollLoopMetric],
  );

  const onMomentumScrollEnd = useCallback(() => {
    completeScrollLoopMetric("momentum-end");
  }, [completeScrollLoopMetric]);

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

      setCreateAssortedName("Assorted");
      setCreateAssortedUnitPrice("");
      setCreateAssortedQuantity("");
      setCreateAssortedBundleQty("");
      setCreateAssortedBundlePrice("");
      setCreateAssortedMemberIds([]);
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

  const sections = useMemo<ShoppingListSection[]>(
    () => [
      {
        key: "products",
        title: "Active Products",
        emptyMessage: filteredProductEmptyMessage,
        data: filteredProducts.map((product) => ({ kind: "product", product })),
      },
      {
        key: "shopping",
        title: "Published Shopping List",
        emptyMessage: filteredShoppingListEmptyMessage,
        data: filteredShoppingList.map((item) => ({ kind: "shopping-item", item })),
      },
    ],
    [
      filteredProductEmptyMessage,
      filteredProducts,
      filteredShoppingList,
      filteredShoppingListEmptyMessage,
    ],
  );

  const keyExtractor = useCallback((item: ShoppingListSectionRow) => {
    return item.kind === "product"
      ? `product-${item.product.id}`
      : `${item.item.itemType}-${item.item.id}`;
  }, []);

  const renderSectionHeader = useCallback(
    ({ section }: { section: ShoppingListSection }) => (
      <Text style={styles.sectionTitle}>{section.title}</Text>
    ),
    [],
  );

  const renderSectionFooter = useCallback(
    ({ section }: { section: ShoppingListSection }) =>
      section.data.length === 0 ? (
        <Text style={styles.helperText}>{section.emptyMessage}</Text>
      ) : null,
    [],
  );

  const renderItemSeparator = useCallback(() => <View style={styles.listItemSpacer} />, []);

  const renderItem = useCallback(
    ({ item }: { item: ShoppingListSectionRow }) => {
      if (item.kind === "product") {
        return (
          <ProductSectionRow
            product={item.product}
            isSelected={selectedProductId === item.product.id}
            onSelect={onSelectProduct}
          />
        );
      }

      if (item.item.itemType === "standard") {
        const productName =
          productsById.get(item.item.productId)?.name ?? `Product #${item.item.productId}`;
        return (
          <StandardShoppingItemRow
            item={item.item}
            isSelected={selectedStandardItemId === item.item.id}
            productName={productName}
            onSelect={onSelectStandardItem}
          />
        );
      }

      return (
        <AssortedShoppingItemRow
          item={item.item}
          isSelected={selectedAssortedItemId === item.item.id}
          onSelect={onSelectAssortedItem}
        />
      );
    },
    [
      onSelectAssortedItem,
      onSelectProduct,
      onSelectStandardItem,
      productsById,
      selectedAssortedItemId,
      selectedProductId,
      selectedStandardItemId,
    ],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <SectionList<ShoppingListSectionRow, ShoppingListSection>
          testID="shopping-list-sections"
          sections={sections}
          initialNumToRender={16}
          maxToRenderPerBatch={20}
          windowSize={11}
          updateCellsBatchingPeriod={40}
          removeClippedSubviews
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          scrollEventThrottle={16}
          contentContainerStyle={[styles.card, styles.sectionListContent]}
          keyExtractor={keyExtractor}
          renderSectionHeader={renderSectionHeader}
          renderSectionFooter={renderSectionFooter}
          ItemSeparatorComponent={renderItemSeparator}
          renderItem={renderItem}
          onScroll={onScroll}
          onScrollBeginDrag={onScrollBeginDrag}
          onScrollEndDrag={onScrollEndDrag}
          onMomentumScrollBegin={onMomentumScrollBegin}
          onMomentumScrollEnd={onMomentumScrollEnd}
          ListHeaderComponent={
            <View>
              <Text style={styles.title}>Shopping List Management</Text>
              <Text style={styles.subtitle}>
                Active owner: {activeOwner?.name ?? "None selected"}
              </Text>
              <Text style={styles.helperText}>
                Showing {filteredProducts.length}/{products.length} products ·{" "}
                {filteredShoppingList.length}/{shoppingList.length} published rows
              </Text>
              {PERF_LOGGING_ENABLED ? (
                <Text style={styles.helperText}>
                  Perf logging enabled ({PERF_LOG_PREFIX})
                </Text>
              ) : null}

              {!activeOwner ? (
                <Text style={styles.guardText}>{productEmptyMessage}</Text>
              ) : null}
              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
              {isRefreshing ? (
                <Text style={styles.helperText}>Refreshing shopping list...</Text>
              ) : null}

              <TextInput
                accessibilityLabel="Search Active Products"
                style={styles.input}
                placeholder="Search products by name or barcode"
                value={productSearchQuery}
                onChangeText={setProductSearchQuery}
              />
              <Pressable
                accessibilityLabel="Search Active Products Clear"
                accessibilityRole="button"
                disabled={!showProductSearchClear}
                onPress={clearProductSearch}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && showProductSearchClear && styles.buttonPressed,
                  !showProductSearchClear && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.secondaryButtonLabel}>Clear Product Search</Text>
              </Pressable>

              <TextInput
                accessibilityLabel="Search Published Shopping List"
                style={styles.input}
                placeholder="Search shopping rows by product, barcode, or metadata"
                value={shoppingSearchQuery}
                onChangeText={setShoppingSearchQuery}
              />
              <Pressable
                accessibilityLabel="Search Published Shopping List Clear"
                accessibilityRole="button"
                disabled={!showShoppingSearchClear}
                onPress={clearShoppingSearch}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && showShoppingSearchClear && styles.buttonPressed,
                  !showShoppingSearchClear && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.secondaryButtonLabel}>Clear Shopping Search</Text>
              </Pressable>

              <Pressable
                accessibilityLabel="Refresh Shopping List"
                accessibilityRole="button"
                disabled={!activeOwner}
                onPress={() => void refreshData()}
                style={({ pressed }) => [
                  styles.secondaryButton,
                  pressed && styles.buttonPressed,
                  !activeOwner && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.secondaryButtonLabel}>Refresh Shopping List</Text>
              </Pressable>
            </View>
          }
          ListFooterComponent={
            <View>
              <Text style={styles.sectionTitle}>Create Shopping List Item</Text>
              <TextInput
                accessibilityLabel="Unit Price (Centavos)"
                style={styles.input}
                placeholder="Unit price in centavos"
                keyboardType="number-pad"
                value={createUnitPrice}
                onChangeText={setCreateUnitPrice}
              />
              <TextInput
                accessibilityLabel="Available Quantity"
                style={styles.input}
                placeholder="Available quantity"
                keyboardType="number-pad"
                value={createQuantity}
                onChangeText={setCreateQuantity}
              />
              <TextInput
                accessibilityLabel="Bundle Quantity (Optional)"
                style={styles.input}
                placeholder="Bundle quantity (optional)"
                keyboardType="number-pad"
                value={createBundleQty}
                onChangeText={setCreateBundleQty}
              />
              <TextInput
                accessibilityLabel="Bundle Price (Centavos, Optional)"
                style={styles.input}
                placeholder="Bundle price in centavos (optional)"
                keyboardType="number-pad"
                value={createBundlePrice}
                onChangeText={setCreateBundlePrice}
              />
              <Pressable
                accessibilityLabel="Submit Create Shopping List Item"
                accessibilityRole="button"
                disabled={createButtonDisabled}
                onPress={() => void onCreateItem()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && !createButtonDisabled && styles.buttonPressed,
                  createButtonDisabled && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.primaryButtonLabel}>
                  {isCreating ? "Creating..." : "Create Shopping List Item"}
                </Text>
              </Pressable>

              <Text style={styles.sectionTitle}>Edit Shopping List Item</Text>
              {!selectedStandardItem ? (
                <Text style={styles.helperText}>
                  Select a shopping-list item above to edit.
                </Text>
              ) : null}
              <TextInput
                accessibilityLabel="Edit Unit Price (Centavos)"
                style={styles.input}
                placeholder="Edit unit price in centavos"
                keyboardType="number-pad"
                editable={Boolean(selectedStandardItem)}
                value={editUnitPrice}
                onChangeText={setEditUnitPrice}
              />
              <TextInput
                accessibilityLabel="Edit Available Quantity"
                style={styles.input}
                placeholder="Edit available quantity"
                keyboardType="number-pad"
                editable={Boolean(selectedStandardItem)}
                value={editQuantity}
                onChangeText={setEditQuantity}
              />
              <TextInput
                accessibilityLabel="Edit Bundle Quantity (Optional)"
                style={styles.input}
                placeholder="Edit bundle quantity (optional)"
                keyboardType="number-pad"
                editable={Boolean(selectedStandardItem)}
                value={editBundleQty}
                onChangeText={setEditBundleQty}
              />
              <TextInput
                accessibilityLabel="Edit Bundle Price (Centavos, Optional)"
                style={styles.input}
                placeholder="Edit bundle price in centavos (optional)"
                keyboardType="number-pad"
                editable={Boolean(selectedStandardItem)}
                value={editBundlePrice}
                onChangeText={setEditBundlePrice}
              />
              <Pressable
                accessibilityLabel="Submit Shopping List Item Update"
                accessibilityRole="button"
                disabled={updateButtonDisabled}
                onPress={() => void onUpdateItem()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && !updateButtonDisabled && styles.buttonPressed,
                  updateButtonDisabled && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.primaryButtonLabel}>
                  {isUpdating ? "Saving..." : "Save Shopping List Item"}
                </Text>
              </Pressable>

              <Text style={styles.destructiveCopy}>
                Removing an item unpublishes it and shoppers will no longer be able to buy
                it.
              </Text>
              <Pressable
                accessibilityLabel="Remove Selected Shopping List Item"
                accessibilityRole="button"
                disabled={removeButtonDisabled}
                onPress={() => void onRemoveItem()}
                style={({ pressed }) => [
                  styles.dangerButton,
                  pressed && !removeButtonDisabled && styles.buttonPressed,
                  removeButtonDisabled && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.dangerButtonLabel}>
                  {isRemoving
                    ? "Removing..."
                    : isRemoveConfirmArmed
                      ? confirmRemoveButtonLabel
                      : removeButtonLabel}
                </Text>
              </Pressable>
              {isRemoveConfirmArmed ? (
                <Text style={styles.warningText}>{REMOVE_CONFIRM_MESSAGE}</Text>
              ) : null}

              <Text style={styles.sectionTitle}>Create Assorted Shopping List Item</Text>
              <TextInput
                accessibilityLabel="Assorted Entry Name"
                style={styles.input}
                placeholder="Assorted entry name"
                value={createAssortedName}
                onChangeText={setCreateAssortedName}
              />
              <TextInput
                accessibilityLabel="Assorted Unit Price (Centavos)"
                style={styles.input}
                placeholder="Assorted unit price in centavos"
                keyboardType="number-pad"
                value={createAssortedUnitPrice}
                onChangeText={setCreateAssortedUnitPrice}
              />
              <TextInput
                accessibilityLabel="Assorted Available Quantity"
                style={styles.input}
                placeholder="Assorted available quantity"
                keyboardType="number-pad"
                value={createAssortedQuantity}
                onChangeText={setCreateAssortedQuantity}
              />
              <TextInput
                accessibilityLabel="Assorted Bundle Quantity (Optional)"
                style={styles.input}
                placeholder="Assorted bundle quantity (optional)"
                keyboardType="number-pad"
                value={createAssortedBundleQty}
                onChangeText={setCreateAssortedBundleQty}
              />
              <TextInput
                accessibilityLabel="Assorted Bundle Price (Centavos, Optional)"
                style={styles.input}
                placeholder="Assorted bundle price in centavos (optional)"
                keyboardType="number-pad"
                value={createAssortedBundlePrice}
                onChangeText={setCreateAssortedBundlePrice}
              />
              <Text style={styles.memberLabel}>Assorted Members (select at least 2)</Text>
              <View style={styles.memberGrid}>
                {products.map((product) => (
                  <MemberChip
                    key={`create-assorted-member-${product.id}`}
                    productId={product.id}
                    label={product.name}
                    selected={createAssortedMemberIds.includes(product.id)}
                    accessibilityLabel={`Toggle Assorted Member ${product.name}`}
                    onToggle={toggleCreateAssortedMember}
                  />
                ))}
              </View>
              <Pressable
                accessibilityLabel="Submit Create Assorted Shopping List Item"
                accessibilityRole="button"
                disabled={createAssortedButtonDisabled}
                onPress={() => void onCreateAssortedItem()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && !createAssortedButtonDisabled && styles.buttonPressed,
                  createAssortedButtonDisabled && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.primaryButtonLabel}>
                  {isCreatingAssorted
                    ? "Creating..."
                    : "Create Assorted Shopping List Item"}
                </Text>
              </Pressable>

              <Text style={styles.sectionTitle}>Edit Assorted Shopping List Item</Text>
              {!selectedAssortedItem ? (
                <Text style={styles.helperText}>
                  Select an assorted shopping-list item above to edit.
                </Text>
              ) : null}
              <TextInput
                accessibilityLabel="Edit Assorted Entry Name"
                style={styles.input}
                placeholder="Edit assorted entry name"
                editable={Boolean(selectedAssortedItem)}
                value={editAssortedName}
                onChangeText={setEditAssortedName}
              />
              <TextInput
                accessibilityLabel="Edit Assorted Unit Price (Centavos)"
                style={styles.input}
                placeholder="Edit assorted unit price in centavos"
                keyboardType="number-pad"
                editable={Boolean(selectedAssortedItem)}
                value={editAssortedUnitPrice}
                onChangeText={setEditAssortedUnitPrice}
              />
              <TextInput
                accessibilityLabel="Edit Assorted Available Quantity"
                style={styles.input}
                placeholder="Edit assorted available quantity"
                keyboardType="number-pad"
                editable={Boolean(selectedAssortedItem)}
                value={editAssortedQuantity}
                onChangeText={setEditAssortedQuantity}
              />
              <TextInput
                accessibilityLabel="Edit Assorted Bundle Quantity (Optional)"
                style={styles.input}
                placeholder="Edit assorted bundle quantity (optional)"
                keyboardType="number-pad"
                editable={Boolean(selectedAssortedItem)}
                value={editAssortedBundleQty}
                onChangeText={setEditAssortedBundleQty}
              />
              <TextInput
                accessibilityLabel="Edit Assorted Bundle Price (Centavos, Optional)"
                style={styles.input}
                placeholder="Edit assorted bundle price in centavos (optional)"
                keyboardType="number-pad"
                editable={Boolean(selectedAssortedItem)}
                value={editAssortedBundlePrice}
                onChangeText={setEditAssortedBundlePrice}
              />
              <Text style={styles.memberLabel}>Edit Assorted Members</Text>
              {selectedAssortedItem ? (
                <View style={styles.memberGrid}>
                  {products.map((product) => (
                    <MemberChip
                      key={`edit-assorted-member-${product.id}`}
                      productId={product.id}
                      label={product.name}
                      selected={editAssortedMemberIds.includes(product.id)}
                      accessibilityLabel={`Toggle Edit Assorted Member ${product.name}`}
                      onToggle={toggleEditAssortedMember}
                    />
                  ))}
                </View>
              ) : null}
              <Pressable
                accessibilityLabel="Submit Assorted Shopping List Item Update"
                accessibilityRole="button"
                disabled={updateAssortedButtonDisabled}
                onPress={() => void onUpdateAssortedItem()}
                style={({ pressed }) => [
                  styles.primaryButton,
                  pressed && !updateAssortedButtonDisabled && styles.buttonPressed,
                  updateAssortedButtonDisabled && styles.buttonDisabled,
                ]}
              >
                <Text style={styles.primaryButtonLabel}>
                  {isUpdatingAssorted
                    ? "Saving..."
                    : "Save Assorted Shopping List Item"}
                </Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                onPress={() => router.push("/products")}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonLabel}>Go to Products</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.replace("/dashboard")}
                style={styles.secondaryButton}
              >
                <Text style={styles.secondaryButtonLabel}>Back to Dashboard</Text>
              </Pressable>
            </View>
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFF7F1",
  },
  content: {
    flex: 1,
    padding: 20,
  },
  sectionListContent: {
    paddingBottom: 20,
  },
  card: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F3E6DD",
    backgroundColor: "#FFFFFF",
    padding: 16,
    gap: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1F2937",
  },
  subtitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
  },
  guardText: {
    color: "#B45309",
    fontSize: 14,
    fontWeight: "600",
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "600",
  },
  helperText: {
    color: "#4B5563",
    fontSize: 13,
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
  },
  listItem: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
  },
  listItemSelected: {
    borderColor: "#FF6B6B",
    backgroundColor: "#FFF1F1",
  },
  listItemPressed: {
    opacity: 0.85,
  },
  listItemName: {
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "700",
  },
  listItemMeta: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 2,
  },
  listItemSpacer: {
    height: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: "#F3E6DD",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: "#1F2937",
    backgroundColor: "#FFFFFF",
  },
  memberLabel: {
    color: "#4B5563",
    fontSize: 13,
    fontWeight: "600",
    marginTop: 4,
  },
  memberGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  memberChip: {
    borderWidth: 1,
    borderColor: "#D1D5DB",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#FFFFFF",
  },
  memberChipSelected: {
    borderColor: "#FF6B6B",
    backgroundColor: "#FFF1F1",
  },
  memberChipLabel: {
    color: "#374151",
    fontSize: 12,
    fontWeight: "700",
  },
  primaryButton: {
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FF6B6B",
    backgroundColor: "#FF6B6B",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonLabel: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  dangerButton: {
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#DC2626",
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  dangerButtonLabel: {
    color: "#991B1B",
    fontWeight: "700",
  },
  destructiveCopy: {
    color: "#7F1D1D",
    fontSize: 12,
    fontWeight: "600",
  },
  warningText: {
    color: "#991B1B",
    fontSize: 12,
    fontWeight: "600",
  },
  secondaryButton: {
    marginTop: 4,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonLabel: {
    color: "#374151",
    fontWeight: "700",
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
