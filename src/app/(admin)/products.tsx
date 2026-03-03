import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  getActiveOwner,
  subscribeToAdminSession,
} from "@/domain/services/admin-session";
import {
  createProduct,
  listProducts,
  updateProduct,
} from "@/domain/services/owner-data-service";

type ProductListItem = {
  id: number;
  name: string;
  barcode: string;
};

const PRODUCT_INPUT_INVALID_MESSAGE = "Product name and barcode are required.";

function normalizeProductInput(value: string) {
  return value.trim();
}

export default function ProductsScreen() {
  const activeOwner = useSyncExternalStore(
    subscribeToAdminSession,
    getActiveOwner,
    () => null,
  );
  const activeOwnerId = activeOwner?.id ?? null;
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [createName, setCreateName] = useState("");
  const [createBarcode, setCreateBarcode] = useState("");
  const [editName, setEditName] = useState("");
  const [editBarcode, setEditBarcode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const submitLockRef = useRef<"create" | "update" | null>(null);
  const ownerContextVersionRef = useRef(0);
  const latestRefreshRequestRef = useRef(0);
  const selectedProductIdRef = useRef<number | null>(null);
  const lastOwnerIdRef = useRef<number | null>(null);

  useEffect(() => {
    ownerContextVersionRef.current += 1;
  }, [activeOwnerId]);

  useEffect(() => {
    selectedProductIdRef.current = selectedProductId;
  }, [selectedProductId]);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId) ?? null,
    [products, selectedProductId],
  );

  const refreshProducts = useCallback(async () => {
    if (activeOwnerId == null) {
      return;
    }

    const ownerContextVersion = ownerContextVersionRef.current;
    const refreshRequestId = latestRefreshRequestRef.current + 1;
    latestRefreshRequestRef.current = refreshRequestId;

    setIsRefreshing(true);
    try {
      const result = await listProducts();
      if (
        ownerContextVersion !== ownerContextVersionRef.current ||
        refreshRequestId !== latestRefreshRequestRef.current
      ) {
        return;
      }
      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }

      setProducts(
        result.value.map((product) => ({
          id: product.id,
          name: product.name,
          barcode: product.barcode,
        })),
      );
      setErrorMessage(null);

      const currentSelectedProductId = selectedProductIdRef.current;
      if (
        currentSelectedProductId != null &&
        !result.value.some((product) => product.id === currentSelectedProductId)
      ) {
        setSelectedProductId(null);
        setEditName("");
        setEditBarcode("");
      }
    } catch {
      if (
        ownerContextVersion !== ownerContextVersionRef.current ||
        refreshRequestId !== latestRefreshRequestRef.current
      ) {
        return;
      }
      setErrorMessage("Unable to refresh products right now. Please try again.");
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
      setSelectedProductId(null);
      setErrorMessage(null);
      setCreateName("");
      setCreateBarcode("");
      setEditName("");
      setEditBarcode("");
      setIsRefreshing(false);
      lastOwnerIdRef.current = null;
      return;
    }

    if (lastOwnerIdRef.current !== activeOwnerId) {
      setProducts([]);
      setSelectedProductId(null);
      setErrorMessage(null);
      setCreateName("");
      setCreateBarcode("");
      setEditName("");
      setEditBarcode("");
      lastOwnerIdRef.current = activeOwnerId;
    }

    void refreshProducts();
  }, [activeOwnerId, refreshProducts]);

  function onSelectProduct(product: ProductListItem) {
    setSelectedProductId(product.id);
    setEditName(product.name);
    setEditBarcode(product.barcode);
    setErrorMessage(null);
  }

  async function onCreateProduct() {
    if (
      !activeOwner ||
      isCreating ||
      isUpdating ||
      submitLockRef.current !== null
    ) {
      return;
    }

    const normalizedName = normalizeProductInput(createName);
    const normalizedBarcode = normalizeProductInput(createBarcode);
    if (!normalizedName || !normalizedBarcode) {
      setErrorMessage(PRODUCT_INPUT_INVALID_MESSAGE);
      return;
    }

    submitLockRef.current = "create";
    const ownerContextVersion = ownerContextVersionRef.current;
    setIsCreating(true);
    try {
      const result = await createProduct({
        name: normalizedName,
        barcode: normalizedBarcode,
      });
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }

      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }

      setCreateName("");
      setCreateBarcode("");
      setSelectedProductId(result.value.id);
      setEditName(result.value.name);
      setEditBarcode(result.value.barcode);
      await refreshProducts();
    } catch {
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }
      setErrorMessage("Unable to create product right now. Please try again.");
    } finally {
      if (submitLockRef.current === "create") {
        submitLockRef.current = null;
      }
      setIsCreating(false);
    }
  }

  async function onUpdateProduct() {
    if (
      !activeOwner ||
      !selectedProduct ||
      isUpdating ||
      isCreating ||
      submitLockRef.current !== null
    ) {
      return;
    }

    const normalizedName = normalizeProductInput(editName);
    const normalizedBarcode = normalizeProductInput(editBarcode);
    if (!normalizedName || !normalizedBarcode) {
      setErrorMessage(PRODUCT_INPUT_INVALID_MESSAGE);
      return;
    }

    submitLockRef.current = "update";
    const ownerContextVersion = ownerContextVersionRef.current;
    setIsUpdating(true);
    try {
      const result = await updateProduct({
        productId: selectedProduct.id,
        name: normalizedName,
        barcode: normalizedBarcode,
      });
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }

      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }

      setEditName(normalizedName);
      setEditBarcode(normalizedBarcode);
      await refreshProducts();
    } catch {
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }
      setErrorMessage("Unable to update product right now. Please try again.");
    } finally {
      if (submitLockRef.current === "update") {
        submitLockRef.current = null;
      }
      setIsUpdating(false);
    }
  }

  const createButtonDisabled = !activeOwner || isCreating || isUpdating;
  const updateButtonDisabled =
    !activeOwner || !selectedProduct || isCreating || isUpdating;

  const productsEmptyMessage = !activeOwner
    ? "Product list is unavailable until an owner is selected."
    : "No products yet for this owner.";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>
        <View style={styles.card}>
          <FlatList
            data={products}
            keyExtractor={(product) => String(product.id)}
            contentContainerStyle={styles.listContentContainer}
            ListHeaderComponent={
              <View style={styles.headerContainer}>
                <Text style={styles.title}>Product Management</Text>
                <Text style={styles.subtitle}>
                  Active owner: {activeOwner?.name ?? "None selected"}
                </Text>

                {!activeOwner ? (
                  <Text style={styles.guardText}>
                    Select an owner from Owners before managing products.
                  </Text>
                ) : null}

                {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

                <Text style={styles.sectionTitle}>Products</Text>
                {isRefreshing ? <Text style={styles.helperText}>Loading products...</Text> : null}
              </View>
            }
            ListEmptyComponent={
              !isRefreshing ? <Text style={styles.helperText}>{productsEmptyMessage}</Text> : null
            }
            renderItem={({ item }) => {
              const isSelected = selectedProductId === item.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Edit Product ${item.name}`}
                  onPress={() => onSelectProduct(item)}
                  style={({ pressed }) => [
                    styles.listItem,
                    isSelected && styles.listItemSelected,
                    pressed && styles.listItemPressed,
                  ]}
                >
                  <Text style={styles.listItemName}>{item.name}</Text>
                  <Text style={styles.listItemBarcode}>{item.barcode}</Text>
                </Pressable>
              );
            }}
            ItemSeparatorComponent={() => <View style={styles.listItemSpacer} />}
            ListFooterComponent={
              <View style={styles.footerContainer}>
                <Text style={styles.sectionTitle}>Create New Product</Text>
                <TextInput
                  accessibilityLabel="Product Name"
                  style={styles.input}
                  placeholder="Product name"
                  value={createName}
                  onChangeText={setCreateName}
                />
                <TextInput
                  accessibilityLabel="Product Barcode"
                  style={styles.input}
                  placeholder="Barcode"
                  value={createBarcode}
                  onChangeText={setCreateBarcode}
                />
                <Pressable
                  accessibilityLabel="Submit Create Product"
                  accessibilityRole="button"
                  disabled={createButtonDisabled}
                  onPress={() => void onCreateProduct()}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && !createButtonDisabled && styles.buttonPressed,
                    createButtonDisabled && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.primaryButtonLabel}>
                    {isCreating ? "Creating..." : "Create Product"}
                  </Text>
                </Pressable>

                <Text style={styles.sectionTitle}>Edit Product</Text>
                {!selectedProduct ? (
                  <Text style={styles.helperText}>Select a product above to edit.</Text>
                ) : null}
                <TextInput
                  accessibilityLabel="Edit Product Name"
                  style={styles.input}
                  placeholder="Updated product name"
                  editable={Boolean(selectedProduct)}
                  value={editName}
                  onChangeText={setEditName}
                />
                <TextInput
                  accessibilityLabel="Edit Product Barcode"
                  style={styles.input}
                  placeholder="Updated barcode"
                  editable={Boolean(selectedProduct)}
                  value={editBarcode}
                  onChangeText={setEditBarcode}
                />
                <Pressable
                  accessibilityLabel="Submit Product Update"
                  accessibilityRole="button"
                  disabled={updateButtonDisabled}
                  onPress={() => void onUpdateProduct()}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    pressed && !updateButtonDisabled && styles.buttonPressed,
                    updateButtonDisabled && styles.buttonDisabled,
                  ]}
                >
                  <Text style={styles.primaryButtonLabel}>
                    {isUpdating ? "Saving..." : "Save Product Changes"}
                  </Text>
                </Pressable>

                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push("/owners")}
                  style={styles.secondaryButton}
                >
                  <Text style={styles.secondaryButtonLabel}>Go to Owners</Text>
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
  card: {
    flex: 1,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#F3E6DD",
    backgroundColor: "#FFFFFF",
    padding: 16,
  },
  listContentContainer: {
    gap: 10,
    paddingBottom: 4,
  },
  headerContainer: {
    gap: 10,
  },
  footerContainer: {
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
  listItemSpacer: {
    height: 8,
  },
  listItemName: {
    color: "#1F2937",
    fontSize: 14,
    fontWeight: "700",
  },
  listItemBarcode: {
    color: "#6B7280",
    fontSize: 12,
    marginTop: 2,
  },
  helperText: {
    color: "#4B5563",
    fontSize: 13,
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
