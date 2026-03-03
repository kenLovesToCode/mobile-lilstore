import { router } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Pressable, SectionList, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getActiveOwner,
  subscribeToAdminSession,
} from "@/domain/services/admin-session";
import {
  addShoppingListItem,
  listProducts,
  listShoppingListItems,
  removeShoppingListItem,
  updateShoppingListItem,
} from "@/domain/services/owner-data-service";

type ProductListItem = {
  id: number;
  name: string;
  barcode: string;
};

type ShoppingListRow = {
  id: number;
  productId: number;
  quantity: number;
  unitPriceCents: number;
};

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

const SHOPPING_LIST_FORM_INVALID_MESSAGE =
  "Select a product, set a non-negative unit price, and set quantity above zero.";
const REMOVE_CONFIRM_MESSAGE =
  "Press Remove Shopping List Item again to confirm.";

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
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const [createUnitPrice, setCreateUnitPrice] = useState("");
  const [createQuantity, setCreateQuantity] = useState("");
  const [editUnitPrice, setEditUnitPrice] = useState("");
  const [editQuantity, setEditQuantity] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeConfirmItemId, setRemoveConfirmItemId] = useState<number | null>(null);
  const submitLockRef = useRef<"create" | "update" | "remove" | null>(null);
  const ownerContextVersionRef = useRef(0);
  const latestRefreshRequestRef = useRef(0);
  const selectedProductIdRef = useRef<number | null>(null);
  const selectedItemIdRef = useRef<number | null>(null);
  const lastOwnerIdRef = useRef<number | null>(null);

  useEffect(() => {
    ownerContextVersionRef.current += 1;
  }, [activeOwnerId]);

  useEffect(() => {
    selectedProductIdRef.current = selectedProductId;
  }, [selectedProductId]);

  useEffect(() => {
    selectedItemIdRef.current = selectedItemId;
  }, [selectedItemId]);

  const productsById = useMemo(() => {
    const map = new Map<number, ProductListItem>();
    for (const product of products) {
      map.set(product.id, product);
    }
    return map;
  }, [products]);

  const selectedItem = useMemo(
    () => shoppingList.find((item) => item.id === selectedItemId) ?? null,
    [shoppingList, selectedItemId],
  );

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

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
      const nextShoppingList = shoppingListResult.value.map((item) => ({
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        unitPriceCents: item.unitPriceCents,
      }));

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

      const currentSelectedItemId = selectedItemIdRef.current;
      if (
        currentSelectedItemId != null &&
        !nextShoppingList.some((item) => item.id === currentSelectedItemId)
      ) {
        setSelectedItemId(null);
        setRemoveConfirmItemId(null);
        setEditUnitPrice("");
        setEditQuantity("");
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
      setSelectedItemId(null);
      setCreateUnitPrice("");
      setCreateQuantity("");
      setEditUnitPrice("");
      setEditQuantity("");
      setErrorMessage(null);
      setIsRefreshing(false);
      setIsCreating(false);
      setIsUpdating(false);
      setIsRemoving(false);
      setRemoveConfirmItemId(null);
      lastOwnerIdRef.current = null;
      return;
    }

    if (lastOwnerIdRef.current !== activeOwnerId) {
      setProducts([]);
      setShoppingList([]);
      setSelectedProductId(null);
      setSelectedItemId(null);
      setCreateUnitPrice("");
      setCreateQuantity("");
      setEditUnitPrice("");
      setEditQuantity("");
      setRemoveConfirmItemId(null);
      setErrorMessage(null);
      lastOwnerIdRef.current = activeOwnerId;
    }

    void refreshData();
  }, [activeOwnerId, refreshData]);

  function onSelectProduct(productId: number) {
    setSelectedProductId(productId);
    setErrorMessage(null);
  }

  function onSelectItem(item: ShoppingListRow) {
    setSelectedItemId(item.id);
    setSelectedProductId(item.productId);
    setEditUnitPrice(String(item.unitPriceCents));
    setEditQuantity(String(item.quantity));
    setRemoveConfirmItemId(null);
    setErrorMessage(null);
  }

  async function onCreateItem() {
    if (
      !activeOwner ||
      !selectedProductId ||
      isCreating ||
      isUpdating ||
      isRemoving ||
      submitLockRef.current !== null
    ) {
      return;
    }

    const unitPriceCents = parseIntegerInput(createUnitPrice);
    const quantity = parseIntegerInput(createQuantity);
    if (
      unitPriceCents == null ||
      unitPriceCents < 0 ||
      quantity == null ||
      quantity <= 0
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
      setSelectedItemId(result.value.id);
      setEditUnitPrice(String(result.value.unitPriceCents));
      setEditQuantity(String(result.value.quantity));
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
      !selectedItem ||
      isCreating ||
      isUpdating ||
      isRemoving ||
      submitLockRef.current !== null
    ) {
      return;
    }

    const unitPriceCents = parseIntegerInput(editUnitPrice);
    const quantity = parseIntegerInput(editQuantity);
    if (
      unitPriceCents == null ||
      unitPriceCents < 0 ||
      quantity == null ||
      quantity <= 0
    ) {
      setErrorMessage(SHOPPING_LIST_FORM_INVALID_MESSAGE);
      return;
    }

    submitLockRef.current = "update";
    const ownerContextVersion = ownerContextVersionRef.current;
    setIsUpdating(true);
    try {
      const result = await updateShoppingListItem({
        itemId: selectedItem.id,
        unitPriceCents,
        quantity,
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
      setRemoveConfirmItemId(null);
      await refreshData();
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

  async function onRemoveItem() {
    if (
      !activeOwner ||
      !selectedItem ||
      isCreating ||
      isUpdating ||
      isRemoving ||
      submitLockRef.current !== null
    ) {
      return;
    }

    if (removeConfirmItemId !== selectedItem.id) {
      setRemoveConfirmItemId(selectedItem.id);
      setErrorMessage(null);
      return;
    }

    submitLockRef.current = "remove";
    const ownerContextVersion = ownerContextVersionRef.current;
    setIsRemoving(true);
    try {
      const result = await removeShoppingListItem({
        itemId: selectedItem.id,
      });
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }

      if (!result.ok) {
        setRemoveConfirmItemId(null);
        setErrorMessage(result.error.message);
        return;
      }

      setRemoveConfirmItemId(null);
      setSelectedItemId(null);
      setEditUnitPrice("");
      setEditQuantity("");
      await refreshData();
    } catch {
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }
      setRemoveConfirmItemId(null);
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
  const createButtonDisabled =
    !activeOwner ||
    !selectedProduct ||
    isCreating ||
    isUpdating ||
    isRemoving;
  const updateButtonDisabled =
    !activeOwner ||
    !selectedItem ||
    isCreating ||
    isUpdating ||
    isRemoving;
  const removeButtonDisabled =
    !activeOwner ||
    !selectedItem ||
    isCreating ||
    isUpdating ||
    isRemoving;
  const sections = useMemo<ShoppingListSection[]>(
    () => [
      {
        key: "products",
        title: "Active Products",
        emptyMessage: productEmptyMessage,
        data: products.map((product) => ({ kind: "product", product })),
      },
      {
        key: "shopping",
        title: "Published Shopping List",
        emptyMessage: shoppingListEmptyMessage,
        data: shoppingList.map((item) => ({ kind: "shopping-item", item })),
      },
    ],
    [productEmptyMessage, products, shoppingList, shoppingListEmptyMessage],
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <SectionList<ShoppingListSectionRow, ShoppingListSection>
          sections={sections}
          stickySectionHeadersEnabled={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.card, styles.sectionListContent]}
          keyExtractor={(item) =>
            item.kind === "product"
              ? `product-${item.product.id}`
              : `shopping-item-${item.item.id}`
          }
          renderSectionHeader={({ section }) => (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )}
          renderSectionFooter={({ section }) =>
            section.data.length === 0 ? (
              <Text style={styles.helperText}>{section.emptyMessage}</Text>
            ) : null
          }
          ItemSeparatorComponent={() => <View style={styles.listItemSpacer} />}
          renderItem={({ item }) => {
            if (item.kind === "product") {
              const isSelected = selectedProductId === item.product.id;
              return (
                <Pressable
                  accessibilityLabel={`Select Product ${item.product.name}`}
                  accessibilityRole="button"
                  onPress={() => onSelectProduct(item.product.id)}
                  style={({ pressed }) => [
                    styles.listItem,
                    isSelected && styles.listItemSelected,
                    pressed && styles.listItemPressed,
                  ]}
                >
                  <Text style={styles.listItemName}>{item.product.name}</Text>
                  <Text style={styles.listItemMeta}>{item.product.barcode}</Text>
                </Pressable>
              );
            }

            const isSelected = selectedItemId === item.item.id;
            const productName =
              productsById.get(item.item.productId)?.name ??
              `Product #${item.item.productId}`;
            return (
              <Pressable
                accessibilityLabel={`Edit Shopping List Item #${item.item.id}`}
                accessibilityRole="button"
                onPress={() => onSelectItem(item.item)}
                style={({ pressed }) => [
                  styles.listItem,
                  isSelected && styles.listItemSelected,
                  pressed && styles.listItemPressed,
                ]}
              >
                <Text style={styles.listItemName}>{productName}</Text>
                <Text style={styles.listItemMeta}>
                  Qty {item.item.quantity} ·{" "}
                  {formatCurrencyFromCents(item.item.unitPriceCents)}
                </Text>
              </Pressable>
            );
          }}
          ListHeaderComponent={
            <View>
              <Text style={styles.title}>Shopping List Management</Text>
              <Text style={styles.subtitle}>
                Active owner: {activeOwner?.name ?? "None selected"}
              </Text>

              {!activeOwner ? (
                <Text style={styles.guardText}>{productEmptyMessage}</Text>
              ) : null}
              {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}
              {isRefreshing ? (
                <Text style={styles.helperText}>Refreshing shopping list...</Text>
              ) : null}

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
              {!selectedItem ? (
                <Text style={styles.helperText}>
                  Select a shopping-list item above to edit.
                </Text>
              ) : null}
              <TextInput
                accessibilityLabel="Edit Unit Price (Centavos)"
                style={styles.input}
                placeholder="Edit unit price in centavos"
                keyboardType="number-pad"
                editable={Boolean(selectedItem)}
                value={editUnitPrice}
                onChangeText={setEditUnitPrice}
              />
              <TextInput
                accessibilityLabel="Edit Available Quantity"
                style={styles.input}
                placeholder="Edit available quantity"
                keyboardType="number-pad"
                editable={Boolean(selectedItem)}
                value={editQuantity}
                onChangeText={setEditQuantity}
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
                    : removeConfirmItemId === selectedItem?.id
                      ? "Confirm Remove Shopping List Item"
                      : "Remove Shopping List Item"}
                </Text>
              </Pressable>
              {removeConfirmItemId === selectedItem?.id ? (
                <Text style={styles.warningText}>{REMOVE_CONFIRM_MESSAGE}</Text>
              ) : null}

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
