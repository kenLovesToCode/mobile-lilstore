import { router } from "expo-router";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { hasAnyAdmin } from "@/domain/services/auth-service";
import { type EntryRoute } from "@/domain/services/entry-gate";
import {
  DEFAULT_GATE_ERROR_MESSAGE,
  resolveEntryRouteFromAdminCheck,
} from "@/domain/services/entry-gate-runtime";

const PUBLIC_CREATE_MASTER_ADMIN_ROUTE = "/create-master-admin";
const PUBLIC_ADMIN_LOGIN_ROUTE = "/login";

function toPublicAdminRoute(route: EntryRoute) {
  if (route === "/(admin)/create-master-admin") {
    return PUBLIC_CREATE_MASTER_ADMIN_ROUTE;
  }
  return PUBLIC_ADMIN_LOGIN_ROUTE;
}

export default function HomeScreen() {
  const [adminRouteError, setAdminRouteError] = useState<string | null>(null);
  const [isResolvingAdminRoute, setIsResolvingAdminRoute] = useState(false);
  const adminRouteLockRef = useRef(false);

  async function onPressAdmin() {
    if (adminRouteLockRef.current || isResolvingAdminRoute) {
      return;
    }

    setAdminRouteError(null);
    adminRouteLockRef.current = true;
    setIsResolvingAdminRoute(true);
    try {
      const result = await resolveEntryRouteFromAdminCheck(hasAnyAdmin);
      if (result.kind === "error") {
        setAdminRouteError(result.message);
        return;
      }

      router.push(toPublicAdminRoute(result.value));
    } catch {
      setAdminRouteError(DEFAULT_GATE_ERROR_MESSAGE);
    } finally {
      adminRouteLockRef.current = false;
      setIsResolvingAdminRoute(false);
    }
  }

  function onPressBuyNow() {
    setAdminRouteError(null);
    router.push("/pin" as never);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>LilStore</Text>
        <Text style={styles.description}>
          Choose how you want to continue on this shared device.
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buy Now"
          onPress={onPressBuyNow}
          style={({ pressed }) => [
            styles.primaryButton,
            pressed && styles.primaryButtonPressed,
          ]}
        >
          <Text style={styles.primaryButtonLabel}>Buy Now</Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Admin"
          disabled={isResolvingAdminRoute}
          onPress={() => void onPressAdmin()}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && !isResolvingAdminRoute && styles.secondaryButtonPressed,
            isResolvingAdminRoute && styles.secondaryButtonDisabled,
          ]}
        >
          {isResolvingAdminRoute ? (
            <View style={styles.secondaryButtonLoadingContent}>
              <ActivityIndicator size="small" />
              <Text style={styles.secondaryButtonLabel}>Opening Admin...</Text>
            </View>
          ) : (
            <Text style={styles.secondaryButtonLabel}>Admin</Text>
          )}
        </Pressable>

        {adminRouteError ? (
          <Text style={styles.errorText}>{adminRouteError}</Text>
        ) : null}
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
    gap: 12,
  },
  title: {
    fontSize: 26,
    lineHeight: 32,
    fontWeight: "800",
    color: "#1F2937",
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    color: "#374151",
    marginBottom: 8,
  },
  primaryButton: {
    minHeight: 50,
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
  primaryButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  primaryButtonLabel: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "800",
  },
  secondaryButton: {
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  secondaryButtonPressed: {
    opacity: 0.86,
  },
  secondaryButtonDisabled: {
    opacity: 0.7,
  },
  secondaryButtonLoadingContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  secondaryButtonLabel: {
    color: "#374151",
    fontSize: 15,
    fontWeight: "800",
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#B91C1C",
    fontWeight: "600",
  },
});
