import { router, useNavigation } from "expo-router";
import React, { useEffect, useSyncExternalStore } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DeferredRedirect } from "@/components/deferred-redirect";
import {
  clearShopperSession,
  getShopperSession,
  subscribeToShopperSession,
} from "@/domain/services/shopper-session";

function shouldClearShopperSessionOnBeforeRemoveAction(actionType: unknown) {
  return (
    actionType === "GO_BACK" ||
    actionType === "POP" ||
    actionType === "POP_TO_TOP"
  );
}

export default function ShopperScanPlaceholderScreen() {
  const navigation = useNavigation();
  const shopperSession = useSyncExternalStore(
    subscribeToShopperSession,
    getShopperSession,
    () => null,
  );

  useEffect(() => {
    return navigation.addListener("beforeRemove", (event) => {
      if (
        !shouldClearShopperSessionOnBeforeRemoveAction(
          event.data.action?.type,
        )
      ) {
        return;
      }

      // Story 5.1 requires shopper session teardown when exiting/canceling flow.
      clearShopperSession();
    });
  }, [navigation]);

  if (!shopperSession) {
    return <DeferredRedirect href={"/pin" as never} />;
  }

  function onSwitchShopper() {
    clearShopperSession();
    router.replace("/pin" as never);
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>Scanner coming soon</Text>
        <Text style={styles.description}>
          Story 5.2 will add barcode scanning. Your shopper session is active now.
        </Text>
        <Text style={styles.identityLabel}>Shopper</Text>
        <Text style={styles.identityValue}>{shopperSession.displayName}</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Use Different Shopper"
          onPress={onSwitchShopper}
          style={({ pressed }) => [
            styles.secondaryButton,
            pressed && styles.secondaryButtonPressed,
          ]}
        >
          <Text style={styles.secondaryButtonLabel}>Use Different Shopper</Text>
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
  secondaryButton: {
    marginTop: 10,
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
  secondaryButtonLabel: {
    color: "#374151",
    fontSize: 14,
    fontWeight: "800",
  },
});
