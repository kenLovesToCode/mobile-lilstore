import { SymbolView } from "expo-symbols";
import { router } from "expo-router";
import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { StyleSheet, Text, View, useWindowDimensions } from "react-native";

import { AdminSectionHeader } from "@/components/ui/admin-section-header";
import { DashboardActionTile } from "@/components/ui/dashboard-action-tile";
import { DashboardStatCard } from "@/components/ui/dashboard-stat-card";
import { IllustratedStateCard } from "@/components/ui/illustrated-state-card";
import { AdminShell } from "@/components/ui/admin-shell";
import { MotionPressable } from "@/components/ui/motion-pressable";
import { buildFadeIn, buildFadeInDown, EntryView } from "@/components/ui/reanimated-entry";
import { SoftCard } from "@/components/ui/soft-card";
import { StatusChip } from "@/components/ui/status-chip";
import {
  clearAdminSession,
  getActiveOwner,
  getAdminSession,
  subscribeToAdminSession,
} from "@/domain/services/admin-session";
import {
  getDashboardAlertsSnapshot,
  type DashboardAlertsSnapshot,
} from "@/domain/services/dashboard-alerts-service";
import { adminDesignTokens, useAdminPalette } from "@/tamagui";

function DashboardHeroIllustration() {
  const palette = useAdminPalette();

  return (
    <EntryView
      entering={buildFadeIn(adminDesignTokens.motion.emphasisEntryDuration)}
      style={[
        styles.heroIllustration,
        {
          backgroundColor: palette.primarySoft,
          borderColor: palette.border,
        },
      ]}
      testID="dashboard-hero-illustration"
    >
      <View
        style={[
          styles.heroOrbitLarge,
          {
            backgroundColor: palette.surface,
            borderColor: palette.borderSoft,
          },
        ]}
      />
      <View
        style={[
          styles.heroOrbitSmall,
          {
            backgroundColor: palette.canvasAlt,
            borderColor: palette.border,
          },
        ]}
      />
      <View
        style={[
          styles.heroBadge,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
          },
        ]}
      >
        <SymbolView
          name={{ ios: "sparkles", android: "auto_awesome", web: "auto_awesome" }}
          size={18}
          tintColor={palette.primary}
          weight="medium"
        />
      </View>
      <View
        style={[
          styles.heroMiniCard,
          {
            backgroundColor: palette.surface,
            borderColor: palette.border,
          },
        ]}
      >
        <Text style={[styles.heroMiniEyebrow, { color: palette.muted }]}>Today</Text>
        <Text style={[styles.heroMiniValue, { color: palette.textStrong }]}>Home</Text>
      </View>
    </EntryView>
  );
}

function formatAlertMix(
  snapshot: Pick<DashboardAlertsSnapshot["inventory"], "zeroCount" | "lowCount">,
) {
  if (snapshot.zeroCount > 0 && snapshot.lowCount > 0) {
    return `${snapshot.zeroCount} out · ${snapshot.lowCount} low`;
  }
  if (snapshot.zeroCount > 0) {
    return `${snapshot.zeroCount} out of stock`;
  }
  if (snapshot.lowCount > 0) {
    return `${snapshot.lowCount} low stock`;
  }
  return "No active alerts";
}

function renderInventoryPreviewRows(
  previewAlerts: DashboardAlertsSnapshot["inventory"]["previewAlerts"],
  palette: ReturnType<typeof useAdminPalette>,
) {
  return previewAlerts.map((alert) => (
    <View
      key={`${alert.itemType}-${alert.itemId}`}
      style={[
        styles.previewRow,
        {
          backgroundColor: palette.surface,
          borderColor: palette.borderSoft,
        },
      ]}
    >
      <View style={styles.previewCopy}>
        <Text style={[styles.previewTitle, { color: palette.textStrong }]}>
          {alert.name}
        </Text>
        <Text style={[styles.previewDescription, { color: palette.text }]}>
          {alert.itemType === "assorted"
            ? `Assorted set · ${alert.memberCount} linked products`
            : "Standard item"}
        </Text>
      </View>
      <StatusChip tone={alert.severity === "zero" ? "danger" : "warning"}>
        Qty {alert.quantity}
      </StatusChip>
    </View>
  ));
}

export default function AdminDashboardScreen() {
  const palette = useAdminPalette();
  const { width } = useWindowDimensions();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [alertsSnapshot, setAlertsSnapshot] = useState<DashboardAlertsSnapshot | null>(null);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [isRefreshingAlerts, setIsRefreshingAlerts] = useState(false);

  const logoutLockRef = useRef(false);
  const alertRefreshLockRef = useRef(false);

  const session = useSyncExternalStore(
    subscribeToAdminSession,
    getAdminSession,
    () => null,
  );
  const activeOwner = useSyncExternalStore(
    subscribeToAdminSession,
    getActiveOwner,
    () => null,
  );
  const activeOwnerId = activeOwner?.id ?? null;
  const isWideLayout = width >= 720;

  const inventorySummary = alertsSnapshot
    ? alertsSnapshot.inventory
    : {
        totalCount: 0,
        zeroCount: 0,
        lowCount: 0,
        truncatedCount: 0,
        previewAlerts: [] as DashboardAlertsSnapshot["inventory"]["previewAlerts"],
      };

  const backupFreshness = alertsSnapshot?.backupFreshness ?? null;
  const hasInventoryAlerts = inventorySummary.totalCount > 0;
  const hasZeroStockAlerts = inventorySummary.zeroCount > 0;
  const hasLowStockAlerts = inventorySummary.lowCount > 0;
  const isAlertsLoading = Boolean(activeOwner && !alertsError && !alertsSnapshot && isRefreshingAlerts);

  function onLogout() {
    if (logoutLockRef.current || isLoggingOut) {
      return;
    }

    logoutLockRef.current = true;
    setIsLoggingOut(true);

    try {
      clearAdminSession();
      router.replace("/login");
    } catch {
      logoutLockRef.current = false;
      setIsLoggingOut(false);
    }
  }

  const refreshDashboardAlerts = useCallback(async () => {
    const ownerId = getActiveOwner()?.id ?? null;
    if (!ownerId) {
      setAlertsSnapshot(null);
      setAlertsError(null);
      return;
    }

    if (alertRefreshLockRef.current) {
      return;
    }

    alertRefreshLockRef.current = true;
    setIsRefreshingAlerts(true);

    try {
      const result = await getDashboardAlertsSnapshot();
      if (getActiveOwner()?.id !== ownerId) {
        return;
      }

      if (!result.ok) {
        setAlertsSnapshot(null);
        setAlertsError(result.error.message);
        return;
      }

      setAlertsSnapshot(result.value);
      setAlertsError(null);
    } finally {
      alertRefreshLockRef.current = false;
      setIsRefreshingAlerts(false);

      if (getActiveOwner()?.id !== ownerId) {
        void refreshDashboardAlerts();
      }
    }
  }, []);

  useEffect(() => {
    if (!activeOwnerId) {
      setAlertsSnapshot(null);
      setAlertsError(null);
      return;
    }

    void refreshDashboardAlerts();
  }, [activeOwnerId, refreshDashboardAlerts]);

  const actionTiles = [
    {
      label: "Restock list",
      description: hasInventoryAlerts
        ? `${inventorySummary.totalCount} alerts need attention right now.`
        : "Check upcoming inventory work before shelves run tight.",
      accessibilityLabel: "Open Shopping workspace",
      icon: {
        ios: "cart.fill.badge.plus",
        android: "shopping_cart_checkout",
        web: "shopping_cart_checkout",
      } as const,
      onPress: () => router.push("/shopping-list"),
      featured: true,
    },
    {
      label: "Products workspace",
      description: "Tidy stock items, barcodes, and archive decisions.",
      accessibilityLabel: "Open Products workspace",
      icon: { ios: "shippingbox.fill", android: "inventory_2", web: "inventory_2" } as const,
      onPress: () => router.push("/products"),
      featured: false,
    },
    {
      label: activeOwner ? "Switch owner" : "Go to Owners",
      description: activeOwner
        ? `Currently focused on ${activeOwner.name}.`
        : "Pick an active owner before owner-scoped tasks begin.",
      accessibilityLabel: "Open Owners workspace",
      icon: { ios: "person.2.fill", android: "groups", web: "groups" } as const,
      onPress: () => router.push("/owners"),
      featured: false,
    },
  ];

  const inventoryTone = !activeOwner
    ? "warning"
    : alertsError
      ? "warning"
      : isAlertsLoading
        ? "info"
      : hasInventoryAlerts
        ? hasZeroStockAlerts
          ? "danger"
          : "warning"
        : "success";

  const backupTone = !activeOwner
    ? "info"
    : alertsError
      ? "warning"
      : isAlertsLoading
        ? "info"
      : backupFreshness?.stale
        ? "danger"
        : "success";

  const inventorySupportingText = !activeOwner
    ? "Pick an owner"
    : alertsError
      ? "Needs refresh"
      : isAlertsLoading
        ? "Refreshing"
      : hasInventoryAlerts
        ? formatAlertMix(inventorySummary)
        : "No active alerts";

  const backupSupportingText = !activeOwner
    ? "Owner required"
    : isAlertsLoading
      ? "Refreshing"
    : backupFreshness
      ? backupFreshness.state === "stale"
        ? backupFreshness.ageLabel
        : `Last export ${backupFreshness.ageLabel}`
      : "Refreshing";

  return (
    <AdminShell
      adminUsername={session?.username}
      eyebrow="Home overview"
      footerSlot={(
        <MotionPressable
          accessibilityLabel="Log Out"
          disabled={isLoggingOut}
          onPress={onLogout}
          tone="danger"
        >
          {isLoggingOut ? "Logging Out..." : "Log Out"}
        </MotionPressable>
      )}
      headerActions={(
        <MotionPressable
          accessibilityLabel="Refresh Dashboard Alerts"
          disabled={!activeOwner || isRefreshingAlerts}
          onPress={() => void refreshDashboardAlerts()}
          tone="secondary"
        >
          {isRefreshingAlerts ? "Refreshing..." : "Refresh"}
        </MotionPressable>
      )}
      heroVisual={<DashboardHeroIllustration />}
      ownerName={activeOwner?.name ?? null}
      subtitle="See the active owner, shelf risks, and recovery status at a glance without turning Home into a second sitemap."
      title="Store pulse"
    >
      <View style={styles.statsRow}>
        <DashboardStatCard
          delayMs={40}
          label="Inventory watch"
          supportingText={inventorySupportingText}
          tone={inventoryTone}
          value={!activeOwner ? "Owner" : isAlertsLoading ? "..." : `${inventorySummary.totalCount}`}
        />
        <DashboardStatCard
          delayMs={80}
          label="Recovery status"
          supportingText={backupSupportingText}
          tone={backupTone}
          value={!activeOwner ? "Pick" : isAlertsLoading ? "..." : backupFreshness?.stale ? "Stale" : "Fresh"}
        />
        <DashboardStatCard
          delayMs={120}
          label="Active owner"
          supportingText={`Signed in as ${session?.username ?? "admin"}`}
          tone={activeOwner ? "success" : "warning"}
          value={activeOwner?.name ?? "Needed"}
        />
      </View>

      <EntryView
        entering={buildFadeInDown(
          adminDesignTokens.motion.entryDuration,
          adminDesignTokens.motion.sectionDelayBase,
        )}
      >
        <SoftCard style={styles.offlineCard} testID="offline-ready-section" tone="info">
          <View style={styles.offlineHeader}>
            <StatusChip tone="info">Offline ready</StatusChip>
            <Text style={[styles.offlineText, { color: palette.text }]}>
              Core admin workflows available offline.
            </Text>
          </View>
        </SoftCard>
      </EntryView>

      <EntryView
        entering={buildFadeInDown(
          adminDesignTokens.motion.entryDuration,
          adminDesignTokens.motion.sectionDelayBase + adminDesignTokens.motion.staggerDelay,
        )}
      >
        <SoftCard style={styles.sectionCard}>
          <AdminSectionHeader
            description="Open the routes you are most likely to need next. Backup restore, history, and owner data stay in More."
            eyebrow="Focused shortcuts"
            title="Next actions"
          />

          <View
            style={[
              styles.actionsGrid,
              isWideLayout ? styles.actionsGridWide : null,
            ]}
          >
            {actionTiles.map((action, index) => (
              <DashboardActionTile
                key={action.accessibilityLabel}
                accessibilityLabel={action.accessibilityLabel}
                delayMs={180 + index * 40}
                description={action.description}
                featured={action.featured}
                icon={action.icon}
                label={action.label}
                onPress={action.onPress}
              />
            ))}
          </View>
        </SoftCard>
      </EntryView>

      <View
        style={[
          styles.stateGrid,
          isWideLayout ? styles.stateGridWide : null,
        ]}
      >
        {!activeOwner ? (
          <IllustratedStateCard
            delayMs={220}
            description="Pick an active owner before inventory alerts and restock guidance can be calculated."
            eyebrow="Inventory"
            footer={(
              <MotionPressable
                accessibilityLabel="Open Owners for Dashboard Setup"
                onPress={() => router.push("/owners")}
                tone="primary"
              >
                Choose owner
              </MotionPressable>
            )}
            symbol={{ ios: "tray.full.fill", android: "inventory", web: "inventory" }}
            title="Choose an owner to see shelf risks"
            tone="warning"
          />
        ) : alertsError ? (
          <IllustratedStateCard
            delayMs={220}
            description={alertsError}
            eyebrow="Inventory"
            symbol={{ ios: "exclamationmark.triangle.fill", android: "warning", web: "warning" }}
            title="Inventory summary is temporarily unavailable"
            tone="warning"
            footer={(
              <>
                <MotionPressable
                  accessibilityLabel="Open Shopping List Alerts"
                  onPress={() => router.push("/shopping-list")}
                  tone="primary"
                >
                  Open Shopping List
                </MotionPressable>
                <MotionPressable
                  accessibilityLabel="Open Products for Inventory Refresh"
                  onPress={() => router.push("/products")}
                  tone="secondary"
                >
                  Open Products
                </MotionPressable>
              </>
            )}
          />
        ) : !alertsSnapshot && isRefreshingAlerts ? (
          <IllustratedStateCard
            delayMs={220}
            description="LilStore is refreshing owner-scoped inventory signals."
            eyebrow="Inventory"
            symbol={{ ios: "arrow.triangle.2.circlepath", android: "sync", web: "sync" }}
            title="Loading inventory watch"
            tone="info"
          />
        ) : hasZeroStockAlerts ? (
          <IllustratedStateCard
            delayMs={220}
            description={`${inventorySummary.zeroCount} item${inventorySummary.zeroCount === 1 ? " is" : "s are"} already unavailable${hasLowStockAlerts ? `, and ${inventorySummary.lowCount} more ${inventorySummary.lowCount === 1 ? "is" : "are"} running low.` : "."}`}
            eyebrow="Inventory"
            footer={(
              <>
                <MotionPressable
                  accessibilityLabel="Open Shopping List Alerts"
                  onPress={() => router.push("/shopping-list")}
                  tone="primary"
                >
                  Open Shopping List
                </MotionPressable>
                <MotionPressable
                  accessibilityLabel="Open Products for Inventory Alerts"
                  onPress={() => router.push("/products")}
                  tone="secondary"
                >
                  Review Products
                </MotionPressable>
              </>
            )}
            meta={(
              <>
                <StatusChip tone="neutral">Total {inventorySummary.totalCount}</StatusChip>
                <StatusChip tone="danger">Zero {inventorySummary.zeroCount}</StatusChip>
                <StatusChip tone="warning">Low {inventorySummary.lowCount}</StatusChip>
              </>
            )}
            symbol={{ ios: "exclamationmark.triangle.fill", android: "remove_shopping_cart", web: "remove_shopping_cart" }}
            title="Some essentials are fully out of stock"
            tone="danger"
          >
            <View style={styles.previewList}>
              {renderInventoryPreviewRows(inventorySummary.previewAlerts, palette)}
              {inventorySummary.truncatedCount > 0 ? (
                <Text style={[styles.previewDescription, { color: palette.text }]}>
                  +{inventorySummary.truncatedCount} more alerts remain in Shopping List.
                </Text>
              ) : null}
            </View>
          </IllustratedStateCard>
        ) : hasLowStockAlerts ? (
          <IllustratedStateCard
            delayMs={220}
            description={`${inventorySummary.lowCount} item${inventorySummary.lowCount === 1 ? " is" : "s are"} running low, so top up inventory before the next rush.`}
            eyebrow="Inventory"
            footer={(
              <>
                <MotionPressable
                  accessibilityLabel="Open Shopping List Alerts"
                  onPress={() => router.push("/shopping-list")}
                  tone="primary"
                >
                  Open Shopping List
                </MotionPressable>
                <MotionPressable
                  accessibilityLabel="Open Products for Inventory Alerts"
                  onPress={() => router.push("/products")}
                  tone="secondary"
                >
                  Review Products
                </MotionPressable>
              </>
            )}
            meta={(
              <>
                <StatusChip tone="neutral">Total {inventorySummary.totalCount}</StatusChip>
                <StatusChip tone="warning">Low {inventorySummary.lowCount}</StatusChip>
              </>
            )}
            symbol={{ ios: "shippingbox.fill", android: "inventory_2", web: "inventory_2" }}
            title="Stock is running low"
            tone="warning"
          >
            <View style={styles.previewList}>
              {renderInventoryPreviewRows(inventorySummary.previewAlerts, palette)}
              {inventorySummary.truncatedCount > 0 ? (
                <Text style={[styles.previewDescription, { color: palette.text }]}>
                  +{inventorySummary.truncatedCount} more alerts remain in Shopping List.
                </Text>
              ) : null}
            </View>
          </IllustratedStateCard>
        ) : (
          <IllustratedStateCard
            delayMs={220}
            description="No low-stock or zero-stock items are calling for action right now."
            eyebrow="Inventory"
            footer={(
              <>
                <MotionPressable
                  accessibilityLabel="Open Products for Healthy Inventory"
                  onPress={() => router.push("/products")}
                  tone="primary"
                >
                  Review Products
                </MotionPressable>
                <MotionPressable
                  accessibilityLabel="Open Shopping List for Healthy Inventory"
                  onPress={() => router.push("/shopping-list")}
                  tone="secondary"
                >
                  Open Shopping List
                </MotionPressable>
              </>
            )}
            meta={<StatusChip tone="success">Healthy inventory</StatusChip>}
            symbol={{ ios: "checkmark.seal.fill", android: "task_alt", web: "task_alt" }}
            title="Shelves look steady"
            tone="success"
          />
        )}

        {!activeOwner ? (
          <IllustratedStateCard
            delayMs={260}
            description="Backup freshness follows the active owner context, so choose one before reviewing recovery readiness."
            eyebrow="Backup"
            symbol={{ ios: "externaldrive.badge.person.crop", android: "save", web: "save" }}
            title="Choose an owner to review recovery"
            tone="info"
            footer={(
              <MotionPressable
                accessibilityLabel="Open Owners for Backup Review"
                onPress={() => router.push("/owners")}
                tone="primary"
              >
                Choose owner
              </MotionPressable>
            )}
          />
        ) : alertsError ? (
          <IllustratedStateCard
            delayMs={260}
            description="Refresh this summary or open backup export directly to confirm recovery status."
            eyebrow="Backup"
            symbol={{ ios: "icloud.slash.fill", android: "cloud_off", web: "cloud_off" }}
            title="Backup summary needs a refresh"
            tone="warning"
            footer={(
              <MotionPressable
                accessibilityLabel="Open Backup Export"
                onPress={() => router.push("/data/export")}
                tone="primary"
              >
                Open Export
              </MotionPressable>
            )}
          />
        ) : !alertsSnapshot && isRefreshingAlerts ? (
          <IllustratedStateCard
            delayMs={260}
            description="Recovery freshness is loading for the active owner."
            eyebrow="Backup"
            symbol={{ ios: "arrow.clockwise.circle.fill", android: "sync", web: "sync" }}
            title="Checking backup readiness"
            tone="info"
          />
        ) : (
          <IllustratedStateCard
            delayMs={260}
            description={backupFreshness?.reminderText ?? "Run a backup export to keep recovery current."}
            eyebrow="Backup"
            footer={(
              <MotionPressable
                accessibilityLabel="Open Backup Export"
                onPress={() => router.push("/data/export")}
                tone="primary"
              >
                {backupFreshness?.stale ? "Export Backup" : "Open Export"}
              </MotionPressable>
            )}
            meta={(
              <>
                <StatusChip tone={backupFreshness?.stale ? "danger" : "success"}>
                  {backupFreshness?.stale ? "Stale backup" : "Fresh backup"}
                </StatusChip>
                {backupFreshness?.ageLabel ? (
                  <StatusChip tone="neutral">{backupFreshness.ageLabel}</StatusChip>
                ) : null}
              </>
            )}
            symbol={backupFreshness?.stale
              ? { ios: "externaldrive.badge.exclamationmark", android: "warning", web: "warning" }
              : { ios: "checkmark.icloud.fill", android: "cloud_done", web: "cloud_done" }}
            title={backupFreshness?.stale ? "Recovery needs a fresh backup" : "Recovery is ready"}
            tone={backupFreshness?.stale ? "danger" : "success"}
          >
            <View
              style={[
                styles.backupSummary,
                {
                  backgroundColor: palette.surface,
                  borderColor: palette.borderSoft,
                },
              ]}
            >
              <Text style={[styles.previewTitle, { color: palette.textStrong }]}>
                Last successful backup
              </Text>
              <Text style={[styles.previewDescription, { color: palette.text }]}>
                {backupFreshness?.lastBackupAtLabel ?? "No successful backup recorded"}
              </Text>
              <Text style={[styles.previewDescription, { color: palette.text }]}>
                Backup age: {backupFreshness?.ageLabel ?? "Unavailable"}
              </Text>
            </View>
          </IllustratedStateCard>
        )}
      </View>
    </AdminShell>
  );
}

const styles = StyleSheet.create({
  heroIllustration: {
    alignItems: "center",
    borderRadius: adminDesignTokens.radius.card,
    borderWidth: 1,
    height: 124,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    width: 156,
  },
  heroOrbitLarge: {
    borderRadius: 999,
    borderWidth: 1,
    height: 74,
    position: "absolute",
    right: -16,
    top: -10,
    width: 74,
  },
  heroOrbitSmall: {
    borderRadius: 999,
    borderWidth: 1,
    bottom: -10,
    height: 40,
    left: -4,
    position: "absolute",
    width: 40,
  },
  heroBadge: {
    alignItems: "center",
    borderRadius: adminDesignTokens.radius.pill,
    borderWidth: 1,
    height: 40,
    justifyContent: "center",
    position: "absolute",
    right: 16,
    top: 14,
    width: 40,
  },
  heroMiniCard: {
    alignItems: "flex-start",
    borderRadius: adminDesignTokens.radius.field,
    borderWidth: 1,
    bottom: 18,
    paddingHorizontal: adminDesignTokens.space.sm,
    paddingVertical: adminDesignTokens.space.xs,
    position: "absolute",
    right: 20,
  },
  heroMiniEyebrow: {
    ...adminDesignTokens.typography.sectionEyebrow,
    textTransform: "uppercase",
  },
  heroMiniValue: {
    ...adminDesignTokens.typography.footerTitle,
  },
  statsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: adminDesignTokens.space.sm,
  },
  sectionCard: {
    paddingHorizontal: adminDesignTokens.space.md,
    paddingVertical: adminDesignTokens.space.md,
  },
  offlineCard: {
    paddingHorizontal: adminDesignTokens.space.md,
    paddingVertical: adminDesignTokens.space.sm,
  },
  offlineHeader: {
    alignItems: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    gap: adminDesignTokens.space.sm,
  },
  offlineText: {
    ...adminDesignTokens.typography.body,
    flex: 1,
    minWidth: 180,
  },
  actionsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: adminDesignTokens.space.sm,
  },
  actionsGridWide: {
    flexWrap: "nowrap",
  },
  stateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: adminDesignTokens.space.sm,
  },
  stateGridWide: {
    alignItems: "stretch",
    flexWrap: "nowrap",
  },
  previewList: {
    gap: adminDesignTokens.space.xs,
  },
  previewRow: {
    alignItems: "center",
    borderRadius: adminDesignTokens.radius.field,
    borderWidth: 1,
    flexDirection: "row",
    gap: adminDesignTokens.space.sm,
    justifyContent: "space-between",
    paddingHorizontal: adminDesignTokens.space.sm,
    paddingVertical: adminDesignTokens.space.sm,
  },
  previewCopy: {
    flex: 1,
    gap: adminDesignTokens.space.xxs,
  },
  previewTitle: {
    ...adminDesignTokens.typography.footerTitle,
  },
  previewDescription: {
    ...adminDesignTokens.typography.body,
  },
  backupSummary: {
    borderRadius: adminDesignTokens.radius.field,
    borderWidth: 1,
    gap: adminDesignTokens.space.xxs,
    paddingHorizontal: adminDesignTokens.space.sm,
    paddingVertical: adminDesignTokens.space.sm,
  },
});
