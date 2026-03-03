import { router } from "expo-router";
import React, { useCallback, useMemo, useState, useSyncExternalStore } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
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
  createProduct,
  createShopper,
  getOwnerScopedSnapshot,
  recordPayment,
  recordPurchase,
  updateProduct,
  updateShopper,
  updateShoppingListItem,
  type OwnerScopedSnapshot,
} from "@/domain/services/owner-data-service";

export default function OwnerDataScreen() {
  const activeOwner = useSyncExternalStore(
    subscribeToAdminSession,
    getActiveOwner,
    () => null,
  );
  const [snapshot, setSnapshot] = useState<OwnerScopedSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [productName, setProductName] = useState("");
  const [productBarcode, setProductBarcode] = useState("");
  const [shopperName, setShopperName] = useState("");
  const [shopperPin, setShopperPin] = useState("");
  const [renameProduct, setRenameProduct] = useState("");
  const [renameShopper, setRenameShopper] = useState("");
  const [renameShopperPin, setRenameShopperPin] = useState("");
  const [refreshCount, setRefreshCount] = useState(0);

  const canWrite = Boolean(activeOwner);

  const loadSnapshot = useCallback(async () => {
    setIsLoading(true);
    const result = await getOwnerScopedSnapshot();
    if (!result.ok) {
      setErrorMessage(result.error.message);
      setSnapshot(null);
      setIsLoading(false);
      return;
    }

    setErrorMessage(null);
    setSnapshot(result.value);
    setIsLoading(false);
  }, []);

  React.useEffect(() => {
    if (!activeOwner) {
      setSnapshot(null);
      setErrorMessage(null);
      return;
    }
    void loadSnapshot();
  }, [activeOwner, loadSnapshot, refreshCount]);

  const firstProduct = snapshot?.products[0] ?? null;
  const firstShopper = snapshot?.shoppers[0] ?? null;
  const firstStandardListItem =
    snapshot?.shoppingList.find((item) => "productId" in item) ?? null;

  const summary = useMemo(
    () => ({
      products: snapshot?.products.length ?? 0,
      shoppers: snapshot?.shoppers.length ?? 0,
      shoppingList: snapshot?.shoppingList.length ?? 0,
      purchases: snapshot?.purchases.length ?? 0,
      payments: snapshot?.payments.length ?? 0,
      history: snapshot?.history.length ?? 0,
    }),
    [snapshot],
  );

  function normalizeShopperPin(pin: string) {
    const normalized = pin.trim();
    return normalized.length > 0 ? normalized : null;
  }

  function hasValidShopperPin(
    pin: string | null,
    options?: { required?: boolean },
  ) {
    if (pin == null) {
      return !options?.required;
    }
    return /^\d{4,}$/.test(pin);
  }

  async function onCreateProduct() {
    const result = await createProduct({
      name: productName,
      barcode: productBarcode,
    });
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    setProductName("");
    setProductBarcode("");
    setRefreshCount((value) => value + 1);
  }

  async function onCreateShopper() {
    const normalizedPin = normalizeShopperPin(shopperPin);
    if (!hasValidShopperPin(normalizedPin, { required: true })) {
      setErrorMessage("Shopper PIN must be at least 4 digits.");
      return;
    }

    const result = await createShopper({
      name: shopperName,
      pin: normalizedPin,
    });
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    setErrorMessage(null);
    setShopperName("");
    setShopperPin("");
    setRefreshCount((value) => value + 1);
  }

  async function onAddListItem() {
    if (!firstProduct) {
      setErrorMessage("Create a product first.");
      return;
    }
    const result = await addShoppingListItem({
      productId: firstProduct.id,
      quantity: 1,
      unitPriceCents: 100,
    });
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    setRefreshCount((value) => value + 1);
  }

  async function onRecordPurchase() {
    if (!firstShopper) {
      setErrorMessage("Create a shopper first.");
      return;
    }
    const result = await recordPurchase({
      shopperId: firstShopper.id,
      totalCents: 250,
    });
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    setRefreshCount((value) => value + 1);
  }

  async function onRecordPayment() {
    if (!firstShopper) {
      setErrorMessage("Create a shopper first.");
      return;
    }
    const result = await recordPayment({
      shopperId: firstShopper.id,
      amountCents: 100,
    });
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    setRefreshCount((value) => value + 1);
  }

  async function onEditFirstProduct() {
    if (!firstProduct || !renameProduct.trim()) {
      return;
    }
    const result = await updateProduct({
      productId: firstProduct.id,
      name: renameProduct.trim(),
      barcode: firstProduct.barcode,
    });
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    setRenameProduct("");
    setRefreshCount((value) => value + 1);
  }

  async function onEditFirstShopper() {
    if (!firstShopper || !renameShopper.trim()) {
      return;
    }
    const normalizedPin = normalizeShopperPin(renameShopperPin);
    if (!hasValidShopperPin(normalizedPin)) {
      setErrorMessage("Shopper PIN must be at least 4 digits.");
      return;
    }
    const result = await updateShopper({
      shopperId: firstShopper.id,
      name: renameShopper.trim(),
      ...(normalizedPin == null ? {} : { pin: normalizedPin }),
    });
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    setErrorMessage(null);
    setRenameShopper("");
    setRenameShopperPin("");
    setRefreshCount((value) => value + 1);
  }

  async function onEditFirstListItem() {
    if (!firstStandardListItem) {
      setErrorMessage("Add a shopping list item first.");
      return;
    }
    const result = await updateShoppingListItem({
      itemId: firstStandardListItem.id,
      quantity: firstStandardListItem.quantity + 1,
      unitPriceCents: firstStandardListItem.unitPriceCents,
    });
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    setRefreshCount((value) => value + 1);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={() => void loadSnapshot()} />
        }
      >
        <View style={styles.card}>
          <Text style={styles.title}>Owner-Scoped Data</Text>
          <Text style={styles.subtitle}>
            Active owner: {activeOwner?.name ?? "None selected"}
          </Text>

          {!activeOwner ? (
            <Text style={styles.emptyState}>
              Select an owner from Owners before reading or writing data.
            </Text>
          ) : null}

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <View style={styles.summaryGrid}>
            <Text style={styles.summaryText}>Products: {summary.products}</Text>
            <Text style={styles.summaryText}>Shoppers: {summary.shoppers}</Text>
            <Text style={styles.summaryText}>Shopping List: {summary.shoppingList}</Text>
            <Text style={styles.summaryText}>Purchases: {summary.purchases}</Text>
            <Text style={styles.summaryText}>Payments: {summary.payments}</Text>
            <Text style={styles.summaryText}>History: {summary.history}</Text>
          </View>

          <Text style={styles.sectionTitle}>Products</Text>
          <TextInput
            accessibilityLabel="Product Name"
            style={styles.input}
            placeholder="Product name"
            value={productName}
            onChangeText={setProductName}
          />
          <TextInput
            accessibilityLabel="Product Barcode"
            style={styles.input}
            placeholder="Barcode"
            value={productBarcode}
            onChangeText={setProductBarcode}
          />
          <Pressable
            style={[styles.button, !canWrite && styles.buttonDisabled]}
            disabled={!canWrite}
            onPress={() => void onCreateProduct()}
          >
            <Text style={styles.buttonText}>Create Product</Text>
          </Pressable>
          <TextInput
            accessibilityLabel="Rename Product"
            style={styles.input}
            placeholder="Rename first product"
            value={renameProduct}
            onChangeText={setRenameProduct}
          />
          <Pressable
            style={[styles.button, (!canWrite || !firstProduct) && styles.buttonDisabled]}
            disabled={!canWrite || !firstProduct}
            onPress={() => void onEditFirstProduct()}
          >
            <Text style={styles.buttonText}>Edit First Product</Text>
          </Pressable>
          <Text testID="products-list" style={styles.listText}>
            {snapshot?.products.map((product) => product.name).join(", ") || "No products"}
          </Text>

          <Text style={styles.sectionTitle}>Shoppers</Text>
          <TextInput
            accessibilityLabel="Shopper Name"
            style={styles.input}
            placeholder="Shopper name"
            value={shopperName}
            onChangeText={setShopperName}
          />
          <TextInput
            accessibilityLabel="Shopper PIN"
            style={styles.input}
            placeholder="PIN (4+ digits)"
            keyboardType="number-pad"
            value={shopperPin}
            onChangeText={setShopperPin}
          />
          <Pressable
            style={[styles.button, !canWrite && styles.buttonDisabled]}
            disabled={!canWrite}
            onPress={() => void onCreateShopper()}
          >
            <Text style={styles.buttonText}>Create Shopper</Text>
          </Pressable>
          <TextInput
            accessibilityLabel="Rename Shopper"
            style={styles.input}
            placeholder="Rename first shopper"
            value={renameShopper}
            onChangeText={setRenameShopper}
          />
          <TextInput
            accessibilityLabel="Update Shopper PIN"
            style={styles.input}
            placeholder="New PIN (optional)"
            keyboardType="number-pad"
            value={renameShopperPin}
            onChangeText={setRenameShopperPin}
          />
          <Pressable
            style={[styles.button, (!canWrite || !firstShopper) && styles.buttonDisabled]}
            disabled={!canWrite || !firstShopper}
            onPress={() => void onEditFirstShopper()}
          >
            <Text style={styles.buttonText}>Edit First Shopper</Text>
          </Pressable>
          <Text testID="shoppers-list" style={styles.listText}>
            {snapshot?.shoppers.map((shopper) => shopper.name).join(", ") || "No shoppers"}
          </Text>

          <Text style={styles.sectionTitle}>Shopping List & Ledger</Text>
          <Pressable
            style={[styles.button, (!canWrite || !firstProduct) && styles.buttonDisabled]}
            disabled={!canWrite || !firstProduct}
            onPress={() => void onAddListItem()}
          >
            <Text style={styles.buttonText}>Add List Item</Text>
          </Pressable>
          <Pressable
            style={[styles.button, (!canWrite || !firstStandardListItem) && styles.buttonDisabled]}
            disabled={!canWrite || !firstStandardListItem}
            onPress={() => void onEditFirstListItem()}
          >
            <Text style={styles.buttonText}>Edit First List Item</Text>
          </Pressable>
          <Pressable
            style={[styles.button, (!canWrite || !firstShopper) && styles.buttonDisabled]}
            disabled={!canWrite || !firstShopper}
            onPress={() => void onRecordPurchase()}
          >
            <Text style={styles.buttonText}>Record Purchase</Text>
          </Pressable>
          <Pressable
            style={[styles.button, (!canWrite || !firstShopper) && styles.buttonDisabled]}
            disabled={!canWrite || !firstShopper}
            onPress={() => void onRecordPayment()}
          >
            <Text style={styles.buttonText}>Record Payment</Text>
          </Pressable>
          <Text style={styles.listText}>
            Shopping list items:{" "}
            {snapshot?.shoppingList.map((item) => `#${item.id}`).join(", ") ||
              "No list items"}
          </Text>
          <Text style={styles.listText}>
            Ledger history:{" "}
            {snapshot?.history.map((item) => `${item.kind}#${item.id}`).join(", ") ||
              "No history"}
          </Text>

          <Pressable
            accessibilityRole="button"
            onPress={() => router.replace("/dashboard")}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Back to Dashboard</Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFF7F1",
  },
  content: {
    padding: 20,
  },
  card: {
    borderRadius: 20,
    borderColor: "#F3E6DD",
    borderWidth: 1,
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
  emptyState: {
    color: "#B45309",
    fontSize: 14,
    fontWeight: "600",
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 13,
    fontWeight: "600",
  },
  summaryGrid: {
    gap: 2,
  },
  summaryText: {
    color: "#4B5563",
    fontSize: 13,
  },
  sectionTitle: {
    marginTop: 8,
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
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
  button: {
    minHeight: 40,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FF6B6B",
    backgroundColor: "#FF6B6B",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  listText: {
    color: "#374151",
    fontSize: 13,
  },
  secondaryButton: {
    marginTop: 12,
    minHeight: 42,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    justifyContent: "center",
    alignItems: "center",
  },
  secondaryButtonText: {
    color: "#374151",
    fontWeight: "700",
  },
});
