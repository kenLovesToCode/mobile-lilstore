import { router } from "expo-router";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import {
  FlatList,
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
  archiveProduct,
  createProduct,
  deleteProduct,
  listProducts,
  restoreProduct,
  updateProduct,
} from "@/domain/services/owner-data-service";
import { adminDesignTokens, useAdminPalette } from "@/tamagui";

type ProductListItem = {
  id: number;
  name: string;
  barcode: string;
};

const PRODUCT_INPUT_INVALID_MESSAGE = "Product name and barcode are required.";
const PRODUCT_LIST_MAX_HEIGHT = 420;

function normalizeProductInput(value: string) {
  return value.trim();
}

type ProductSelectionRowProps = {
  item: ProductListItem;
  selected: boolean;
  onSelect: (product: ProductListItem) => void;
};

function ProductSelectionRow({
  item,
  selected,
  onSelect,
}: ProductSelectionRowProps) {
  const palette = useAdminPalette();

  return (
    <MotionPressable
      accessibilityLabel={`Edit Product ${item.name}`}
      accessibilityState={{ selected }}
      onPress={() => onSelect(item)}
      style={[
        styles.listItem,
        {
          backgroundColor: selected ? palette.primarySoft : palette.surface,
          borderColor: selected ? palette.primary : palette.borderSoft,
        },
      ]}
      tone="secondary"
    >
      <View style={styles.listItemRow}>
        <View style={styles.listItemCopy}>
          <Text style={[styles.listItemName, { color: palette.textStrong }]}>{item.name}</Text>
          <Text style={[styles.listItemBarcode, { color: palette.text }]}>{item.barcode}</Text>
        </View>
        {selected ? <StatusChip tone="info">Selected</StatusChip> : null}
      </View>
    </MotionPressable>
  );
}

export default function ProductsScreen() {
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
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [productViewMode, setProductViewMode] = useState<"active" | "archived">("active");
  const [selectedProductId, setSelectedProductId] = useState<number | null>(null);
  const [createName, setCreateName] = useState("");
  const [createBarcode, setCreateBarcode] = useState("");
  const [editName, setEditName] = useState("");
  const [editBarcode, setEditBarcode] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmProductId, setDeleteConfirmProductId] = useState<number | null>(null);
  const submitLockRef = useRef<
    "create" | "update" | "archive" | "restore" | "delete" | null
  >(null);
  const ownerContextVersionRef = useRef(0);
  const latestRefreshRequestRef = useRef(0);
  const selectedProductIdRef = useRef<number | null>(null);
  const lastOwnerIdRef = useRef<number | null>(null);
  const isArchivedView = productViewMode === "archived";
  const isWideLayout = width >= 920;

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
      const result = await listProducts(
        isArchivedView ? { archivedOnly: true } : undefined,
      );
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
        setDeleteConfirmProductId(null);
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
  }, [activeOwnerId, isArchivedView]);

  useEffect(() => {
    if (activeOwnerId == null) {
      setProducts([]);
      setProductViewMode("active");
      setSelectedProductId(null);
      setErrorMessage(null);
      setCreateName("");
      setCreateBarcode("");
      setEditName("");
      setEditBarcode("");
      setDeleteConfirmProductId(null);
      setIsRefreshing(false);
      setIsArchiving(false);
      setIsRestoring(false);
      setIsDeleting(false);
      lastOwnerIdRef.current = null;
      return;
    }

    if (lastOwnerIdRef.current !== activeOwnerId) {
      setProducts([]);
      setProductViewMode("active");
      setSelectedProductId(null);
      setErrorMessage(null);
      setCreateName("");
      setCreateBarcode("");
      setEditName("");
      setEditBarcode("");
      setDeleteConfirmProductId(null);
      setIsRestoring(false);
      lastOwnerIdRef.current = activeOwnerId;
      if (productViewMode !== "active") {
        return;
      }
    }

    void refreshProducts();
  }, [activeOwnerId, productViewMode, refreshProducts]);

  function onSelectProduct(product: ProductListItem) {
    setSelectedProductId(product.id);
    setDeleteConfirmProductId(null);
    setEditName(product.name);
    setEditBarcode(product.barcode);
    setErrorMessage(null);
  }

  function onStartNewProductDraft() {
    setSelectedProductId(null);
    setDeleteConfirmProductId(null);
    setEditName("");
    setEditBarcode("");
    setErrorMessage(null);
  }

  function onToggleProductViewMode() {
    setProductViewMode((currentMode) =>
      currentMode === "active" ? "archived" : "active",
    );
    setSelectedProductId(null);
    setDeleteConfirmProductId(null);
    setEditName("");
    setEditBarcode("");
    setErrorMessage(null);
  }

  async function onCreateProduct() {
    if (
      !activeOwner ||
      isArchivedView ||
      isCreating ||
      isUpdating ||
      isArchiving ||
      isRestoring ||
      isDeleting ||
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
      isArchivedView ||
      isUpdating ||
      isCreating ||
      isArchiving ||
      isRestoring ||
      isDeleting ||
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

  async function onArchiveProduct() {
    if (
      !activeOwner ||
      !selectedProduct ||
      isArchivedView ||
      isArchiving ||
      isRestoring ||
      isDeleting ||
      isCreating ||
      isUpdating ||
      submitLockRef.current !== null
    ) {
      return;
    }

    submitLockRef.current = "archive";
    const ownerContextVersion = ownerContextVersionRef.current;
    setIsArchiving(true);
    try {
      const result = await archiveProduct({
        productId: selectedProduct.id,
      });
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }

      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }

      setDeleteConfirmProductId(null);
      setSelectedProductId(null);
      setEditName("");
      setEditBarcode("");
      await refreshProducts();
    } catch {
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }
      setErrorMessage("Unable to archive product right now. Please try again.");
    } finally {
      if (submitLockRef.current === "archive") {
        submitLockRef.current = null;
      }
      setIsArchiving(false);
    }
  }

  async function onRestoreProduct() {
    if (
      !activeOwner ||
      !selectedProduct ||
      !isArchivedView ||
      isRestoring ||
      isArchiving ||
      isDeleting ||
      isCreating ||
      isUpdating ||
      submitLockRef.current !== null
    ) {
      return;
    }

    submitLockRef.current = "restore";
    const ownerContextVersion = ownerContextVersionRef.current;
    setIsRestoring(true);
    try {
      const result = await restoreProduct({
        productId: selectedProduct.id,
      });
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }

      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }

      setDeleteConfirmProductId(null);
      setSelectedProductId(null);
      setEditName("");
      setEditBarcode("");
      await refreshProducts();
    } catch {
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }
      setErrorMessage("Unable to restore product right now. Please try again.");
    } finally {
      if (submitLockRef.current === "restore") {
        submitLockRef.current = null;
      }
      setIsRestoring(false);
    }
  }

  async function onDeleteProduct() {
    if (
      !activeOwner ||
      !selectedProduct ||
      isArchivedView ||
      isDeleting ||
      isArchiving ||
      isRestoring ||
      isCreating ||
      isUpdating ||
      submitLockRef.current !== null
    ) {
      return;
    }

    if (deleteConfirmProductId !== selectedProduct.id) {
      setDeleteConfirmProductId(selectedProduct.id);
      setErrorMessage("Press Delete Product again to confirm permanent removal.");
      return;
    }

    submitLockRef.current = "delete";
    const ownerContextVersion = ownerContextVersionRef.current;
    setIsDeleting(true);
    try {
      const result = await deleteProduct({
        productId: selectedProduct.id,
      });
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }

      if (!result.ok) {
        setDeleteConfirmProductId(null);
        setErrorMessage(result.error.message);
        return;
      }

      setDeleteConfirmProductId(null);
      setSelectedProductId(null);
      setEditName("");
      setEditBarcode("");
      await refreshProducts();
    } catch {
      if (ownerContextVersion !== ownerContextVersionRef.current) {
        return;
      }
      setDeleteConfirmProductId(null);
      setErrorMessage("Unable to delete product right now. Please try again.");
    } finally {
      if (submitLockRef.current === "delete") {
        submitLockRef.current = null;
      }
      setIsDeleting(false);
    }
  }

  const createButtonDisabled =
    !activeOwner ||
    isArchivedView ||
    isCreating ||
    isUpdating ||
    isArchiving ||
    isRestoring ||
    isDeleting;
  const updateButtonDisabled =
    !activeOwner ||
    !selectedProduct ||
    isArchivedView ||
    isCreating ||
    isUpdating ||
    isArchiving ||
    isRestoring ||
    isDeleting;
  const archiveButtonDisabled =
    !activeOwner ||
    !selectedProduct ||
    isArchivedView ||
    isCreating ||
    isUpdating ||
    isArchiving ||
    isRestoring ||
    isDeleting;
  const restoreButtonDisabled =
    !activeOwner ||
    !selectedProduct ||
    !isArchivedView ||
    isCreating ||
    isUpdating ||
    isArchiving ||
    isRestoring ||
    isDeleting;
  const deleteButtonDisabled =
    !activeOwner ||
    !selectedProduct ||
    isArchivedView ||
    isCreating ||
    isUpdating ||
    isArchiving ||
    isRestoring ||
    isDeleting;

  const productsEmptyMessage = !activeOwner
    ? "Product list is unavailable until an owner is selected."
    : isArchivedView
      ? "No archived products for this owner."
      : "No products yet for this owner.";
  const ownerStatusLabel = `Active owner: ${activeOwner?.name ?? "None selected"}`;
  const selectedProductSummary = selectedProduct
    ? "Selected"
    : isArchivedView
      ? "None selected"
      : "Create mode";
  const showingCreateSurface = !isArchivedView && !selectedProduct;

  return (
    <AdminShell
      adminUsername={adminSession?.username}
      eyebrow={isArchivedView ? "Archive lane" : "Products"}
      headerActions={(
        <MotionPressable
          accessibilityLabel="Refresh Products"
          disabled={!activeOwner || isRefreshing}
          onPress={() => void refreshProducts()}
          tone="secondary"
        >
          {isRefreshing ? "Refreshing..." : "Refresh"}
        </MotionPressable>
      )}
      ownerName={activeOwner?.name ?? null}
      subtitle="Keep sellable items tidy, switch between active and archived catalog lanes quickly, and handle edits without a long utility wall."
      title="Catalog workspace"
    >
      <SoftCard style={styles.ownerCard} tone="info">
        <Text selectable style={[styles.ownerStatusText, { color: palette.textStrong }]}>
          {ownerStatusLabel}
        </Text>
        <Text style={[styles.ownerStatusCaption, { color: palette.text }]}>
          {isArchivedView
            ? "Archived catalog work stays deliberate and separate from live inventory edits."
            : "Create, tune, archive, and delete from focused surfaces while the active owner stays visible."}
        </Text>
      </SoftCard>

      <View style={styles.statsRow}>
        <DashboardStatCard
          label="Current lane"
          supportingText={isArchivedView ? "Restore and inspect" : "Create and tune"}
          tone={isArchivedView ? "warning" : "success"}
          value={isArchivedView ? "Archived" : "Active"}
        />
        <DashboardStatCard
          label="Visible products"
          supportingText={
            !activeOwner
              ? "Owner required"
              : products.length > 0
                ? "Visible in current lane"
                : isArchivedView
                  ? "Archived lane is empty"
                  : "Catalog lane is empty"
          }
          tone={!activeOwner ? "warning" : products.length > 0 ? "info" : "default"}
          value={String(products.length)}
        />
        <DashboardStatCard
          label="Selection"
          supportingText={selectedProduct ? selectedProduct.barcode : "No product selected"}
          tone={selectedProduct ? "info" : "default"}
          value={selectedProductSummary}
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
          description="Select an owner from Owners before managing products."
          eyebrow="Owner scope"
          footer={(
            <MotionPressable
              accessibilityLabel="Open Owners for Product Setup"
              onPress={() => router.push("/owners")}
              tone="primary"
            >
              Choose owner
            </MotionPressable>
          )}
          symbol={{ ios: "shippingbox.fill", android: "inventory_2", web: "inventory_2" }}
          title="Products are owner-scoped"
          tone="warning"
        />
      ) : (
        <View style={[styles.workspaceGrid, isWideLayout ? styles.workspaceGridWide : null]}>
          <View style={styles.primaryColumn}>
            <SelectionListCard
              action={(
                <SegmentedModeToggle
                  options={[
                    {
                      key: "active",
                      label: "Active",
                      accessibilityLabel: "Show Active Products",
                      supportingText: "Sellable inventory",
                    },
                    {
                      key: "archived",
                      label: "Archived",
                      accessibilityLabel: "Show Archived Products",
                      supportingText: "Restore lane",
                    },
                  ]}
                  selectedKey={productViewMode}
                  onSelect={(nextMode) => {
                    if (nextMode !== productViewMode) {
                      onToggleProductViewMode();
                    }
                  }}
                />
              )}
              description={
                isArchivedView
                  ? "Archived products stay out of the live catalog until you restore them."
                  : "Select a product to edit it, or leave the list unselected while you create a new one."
              }
              eyebrow="Catalog list"
              summary={(
                <>
                  <StatusChip tone={isArchivedView ? "warning" : "success"}>
                    {isArchivedView ? "Archived products" : "Active products"}
                  </StatusChip>
                  <StatusChip tone="neutral">{products.length} visible</StatusChip>
                  {selectedProduct ? (
                    <StatusChip tone="info">1 selected</StatusChip>
                  ) : null}
                </>
              )}
              title={isArchivedView ? "Archived Products" : "Active Products"}
            >
              {isRefreshing && products.length === 0 ? (
                <Text style={[styles.helperText, { color: palette.text }]}>Loading products...</Text>
              ) : products.length === 0 ? (
                <Text style={[styles.helperText, { color: palette.text }]}>{productsEmptyMessage}</Text>
              ) : (
                <FlatList
                  contentContainerStyle={styles.listContent}
                  data={products}
                  extraData={selectedProductId}
                  initialNumToRender={16}
                  keyExtractor={(item) => String(item.id)}
                  keyboardShouldPersistTaps="handled"
                  maxToRenderPerBatch={20}
                  nestedScrollEnabled
                  renderItem={({ item }) => (
                    <ProductSelectionRow
                      item={item}
                      onSelect={onSelectProduct}
                      selected={selectedProductId === item.id}
                    />
                  )}
                  showsVerticalScrollIndicator={false}
                  style={styles.boundedList}
                  testID="products-selection-list"
                  windowSize={5}
                />
              )}
            </SelectionListCard>
          </View>

          <View style={styles.secondaryColumn}>
            {isArchivedView ? (
              <ContextualEditorSurface
                description={
                  selectedProduct
                    ? `Restore ${selectedProduct.name} to the live catalog when the barcode and owner scope are still valid.`
                    : "Select an archived product to restore it."
                }
                eyebrow="Archived actions"
                title="Restore archived product"
                tone="warning"
              >
                {selectedProduct ? (
                  <View
                    style={[
                      styles.selectedSummaryCard,
                      { backgroundColor: palette.surfaceMuted },
                    ]}
                  >
                    <Text style={[styles.selectedSummaryTitle, { color: palette.textStrong }]}>
                      {`Selected product: ${selectedProduct.name}`}
                    </Text>
                    <Text style={[styles.selectedSummaryMeta, { color: palette.text }]}>
                      {`Selected barcode: ${selectedProduct.barcode}`}
                    </Text>
                  </View>
                ) : null}

                <MotionPressable
                  accessibilityLabel="Restore Selected Product"
                  disabled={restoreButtonDisabled}
                  onPress={() => void onRestoreProduct()}
                  tone="secondary"
                >
                  {isRestoring ? "Restoring..." : "Restore Product"}
                </MotionPressable>
              </ContextualEditorSurface>
            ) : showingCreateSurface ? (
              <ContextualEditorSurface
                description="Create new products without leaving the catalog lane."
                eyebrow="Create"
                title="Add a product"
                tone="accent"
              >
                <TextInput
                  accessibilityLabel="Product Name"
                  placeholder="Product name"
                  placeholderTextColor={palette.muted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.borderSoft,
                      color: palette.textStrong,
                    },
                  ]}
                  value={createName}
                  onChangeText={setCreateName}
                />
                <TextInput
                  accessibilityLabel="Product Barcode"
                  placeholder="Barcode"
                  placeholderTextColor={palette.muted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.borderSoft,
                      color: palette.textStrong,
                    },
                  ]}
                  value={createBarcode}
                  onChangeText={setCreateBarcode}
                />
                <MotionPressable
                  accessibilityLabel="Submit Create Product"
                  disabled={createButtonDisabled}
                  onPress={() => void onCreateProduct()}
                  tone="primary"
                >
                  {isCreating ? "Creating..." : "Create Product"}
                </MotionPressable>
              </ContextualEditorSurface>
            ) : (
              <ContextualEditorSurface
                description={
                  selectedProduct
                    ? "Edit product details, archive when it should disappear from the live catalog, or delete with explicit confirmation."
                    : "Select a product from the list to unlock edit, archive, and delete actions."
                }
                eyebrow="Selected product"
                footer={(
                  <MotionPressable
                    accessibilityLabel="Start New Product Draft"
                    disabled={isCreating || isUpdating || isArchiving || isRestoring || isDeleting}
                    onPress={onStartNewProductDraft}
                    tone="secondary"
                  >
                    Start New Product Draft
                  </MotionPressable>
                )}
                title="Edit product"
              >
                {selectedProduct ? (
                  <View
                    style={[
                      styles.selectedSummaryCard,
                      { backgroundColor: palette.surfaceMuted },
                    ]}
                  >
                    <Text style={[styles.selectedSummaryTitle, { color: palette.textStrong }]}>
                      {`Selected product: ${selectedProduct.name}`}
                    </Text>
                    <Text style={[styles.selectedSummaryMeta, { color: palette.text }]}>
                      {`Selected barcode: ${selectedProduct.barcode}`}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.helperText, { color: palette.text }]}>
                    Select a product above to edit.
                  </Text>
                )}
                <TextInput
                  accessibilityLabel="Edit Product Name"
                  editable={Boolean(selectedProduct)}
                  placeholder="Updated product name"
                  placeholderTextColor={palette.muted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.borderSoft,
                      color: palette.textStrong,
                    },
                  ]}
                  value={editName}
                  onChangeText={setEditName}
                />
                <TextInput
                  accessibilityLabel="Edit Product Barcode"
                  editable={Boolean(selectedProduct)}
                  placeholder="Updated barcode"
                  placeholderTextColor={palette.muted}
                  style={[
                    styles.input,
                    {
                      backgroundColor: palette.surface,
                      borderColor: palette.borderSoft,
                      color: palette.textStrong,
                    },
                  ]}
                  value={editBarcode}
                  onChangeText={setEditBarcode}
                />
                <View style={styles.actionStack}>
                  <MotionPressable
                    accessibilityLabel="Submit Product Update"
                    disabled={updateButtonDisabled}
                    onPress={() => void onUpdateProduct()}
                    tone="primary"
                  >
                    {isUpdating ? "Saving..." : "Save Product Changes"}
                  </MotionPressable>
                  <MotionPressable
                    accessibilityLabel="Archive Selected Product"
                    disabled={archiveButtonDisabled}
                    onPress={() => void onArchiveProduct()}
                    tone="secondary"
                  >
                    {isArchiving ? "Archiving..." : "Archive Product"}
                  </MotionPressable>
                  <MotionPressable
                    accessibilityLabel="Delete Selected Product"
                    disabled={deleteButtonDisabled}
                    onPress={() => void onDeleteProduct()}
                    tone="danger"
                  >
                    {isDeleting
                      ? "Deleting..."
                      : deleteConfirmProductId === selectedProduct?.id
                        ? "Confirm Delete Product"
                        : "Delete Product"}
                  </MotionPressable>
                </View>
                {deleteConfirmProductId === selectedProduct?.id ? (
                  <Text style={[styles.warningText, { color: palette.dangerText }]}>
                    Press Delete Product again to confirm permanent removal.
                  </Text>
                ) : null}
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
    flex: 1.15,
    minWidth: 300,
    gap: adminDesignTokens.space.md,
  },
  secondaryColumn: {
    flex: 1,
    minWidth: 280,
    gap: adminDesignTokens.space.md,
  },
  boundedList: {
    maxHeight: PRODUCT_LIST_MAX_HEIGHT,
  },
  listContent: {
    gap: adminDesignTokens.space.xs,
  },
  listItem: {
    borderWidth: 1,
    borderRadius: adminDesignTokens.radius.field,
    paddingHorizontal: adminDesignTokens.space.md,
    paddingVertical: adminDesignTokens.space.sm,
  },
  listItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: adminDesignTokens.space.sm,
  },
  listItemCopy: {
    flex: 1,
    gap: 2,
  },
  listItemName: {
    ...adminDesignTokens.typography.footerTitle,
  },
  listItemBarcode: {
    ...adminDesignTokens.typography.body,
  },
  helperText: {
    ...adminDesignTokens.typography.body,
  },
  input: {
    borderWidth: 1,
    borderRadius: adminDesignTokens.radius.field,
    minHeight: adminDesignTokens.size.minTapTarget,
    paddingHorizontal: adminDesignTokens.space.md,
    paddingVertical: adminDesignTokens.space.sm,
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
  actionStack: {
    gap: adminDesignTokens.space.xs,
  },
  warningText: {
    ...adminDesignTokens.typography.body,
    fontWeight: "700",
  },
});
