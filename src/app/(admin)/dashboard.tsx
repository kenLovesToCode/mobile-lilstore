import { router } from "expo-router";
import React, { useRef, useState, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import {
  clearAdminSession,
  getActiveOwner,
  getAdminSession,
  subscribeToAdminSession,
} from "@/domain/services/admin-session";

export default function AdminDashboardScreen() {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [ownerSnapshotSummary, setOwnerSnapshotSummary] = useState<string | null>(null);
  const [ownerSnapshotError, setOwnerSnapshotError] = useState<string | null>(null);
  const logoutLockRef = useRef(false);
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

  async function onRefreshOwnerScope() {
    const { getOwnerScopedSnapshot } = await import(
      "@/domain/services/owner-data-service"
    );
    const result = await getOwnerScopedSnapshot();
    if (!result.ok) {
      setOwnerSnapshotError(result.error.message);
      setOwnerSnapshotSummary(null);
      return;
    }

    setOwnerSnapshotError(null);
    setOwnerSnapshotSummary(
      `Products ${result.value.products.length} · Shoppers ${result.value.shoppers.length} · Shopping List ${result.value.shoppingList.length} · Ledger ${result.value.history.length}`,
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>Admin Dashboard</Text>
        <Text style={styles.description}>
          Protected admin session is active for this runtime.
        </Text>
        <Text style={styles.identityLabel}>Signed in as</Text>
        <Text style={styles.identityValue}>{session?.username ?? "admin"}</Text>

        <Text style={styles.ownerLabel}>Active Owner</Text>
        <Text style={styles.ownerValue}>{activeOwner?.name ?? "None"}</Text>

        {!activeOwner ? (
          <Text style={styles.ownerGuardText}>No active owner selected.</Text>
        ) : null}

        <Pressable
          accessibilityLabel="Refresh Owner Data Snapshot"
          accessibilityRole="button"
          disabled={!activeOwner}
          onPress={() => void onRefreshOwnerScope()}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.secondaryButtonPressed,
            !activeOwner && styles.secondaryButtonDisabled,
          ]}
        >
          <Text style={styles.secondaryButtonLabel}>Refresh Owner Data Snapshot</Text>
        </Pressable>

        {ownerSnapshotSummary ? (
          <Text style={styles.ownerSnapshotText}>{ownerSnapshotSummary}</Text>
        ) : null}
        {ownerSnapshotError ? (
          <Text style={styles.ownerSnapshotErrorText}>{ownerSnapshotError}</Text>
        ) : null}

        <Pressable
          accessibilityLabel="Go to Owners"
          accessibilityRole="button"
          onPress={() => router.push("/owners")}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.secondaryButtonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonLabel}>Go to Owners</Text>
        </Pressable>

        <Pressable
          accessibilityLabel="Go to Owner Data"
          accessibilityRole="button"
          onPress={() => router.push("/owner-data")}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.secondaryButtonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonLabel}>Go to Owner Data</Text>
        </Pressable>

        <Pressable
          accessibilityLabel="Go to Products"
          accessibilityRole="button"
          onPress={() => router.push("/products")}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.secondaryButtonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonLabel}>Go to Products</Text>
        </Pressable>

        <Pressable
          accessibilityLabel="Log Out"
          accessibilityRole="button"
          disabled={isLoggingOut}
          onPress={onLogout}
          style={({ pressed }) => [
            styles.logoutButton,
            pressed && !isLoggingOut && styles.logoutButtonPressed,
            isLoggingOut && styles.logoutButtonDisabled,
          ]}
        >
          <Text style={styles.logoutButtonLabel}>
            {isLoggingOut ? "Logging Out..." : "Log Out"}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
    backgroundColor: "#FFF7F1",
  },
  card: {
    width: "100%",
    maxWidth: 560,
    borderRadius: 26,
    padding: 24,
    borderWidth: 1,
    borderColor: "#F3E6DD",
    backgroundColor: "#FFFFFF",
    shadowColor: "#1F2937",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 5,
    gap: 10,
  },
  title: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: "800",
    color: "#1F2937",
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: "#374151",
  },
  identityLabel: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  identityValue: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "800",
    color: "#FF6B6B",
  },
  ownerLabel: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: "700",
    color: "#6B7280",
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  ownerValue: {
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "700",
    color: "#111827",
  },
  ownerGuardText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#B45309",
    fontWeight: "600",
  },
  secondaryButton: {
    marginTop: 8,
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonPressed: {
    opacity: 0.85,
  },
  secondaryButtonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonLabel: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "800",
  },
  ownerSnapshotText: {
    color: "#374151",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  ownerSnapshotErrorText: {
    color: "#B91C1C",
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },
  logoutButton: {
    marginTop: 12,
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FF6B6B",
    backgroundColor: "#FF6B6B",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#FF6B6B",
    shadowOpacity: 0.24,
    shadowOffset: { width: 0, height: 10 },
    shadowRadius: 18,
    elevation: 4,
  },
  logoutButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  logoutButtonDisabled: {
    opacity: 0.75,
  },
  logoutButtonLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
});
