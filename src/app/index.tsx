import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { DeferredRedirect } from "@/components/deferred-redirect";
import { GateErrorState } from "@/components/gate-error-state";
import { hasAnyAdmin } from "@/domain/services/auth-service";
import { type EntryRoute } from "@/domain/services/entry-gate";
import { resolveEntryRouteFromAdminCheck } from "@/domain/services/entry-gate-runtime";
import { getEntryGateScreenViewState } from "@/domain/services/entry-gate-view-state";

function GateLoadingState() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="small" />
      <Text style={styles.loadingText}>Loading LilStore...</Text>
    </View>
  );
}

export default function EntryGateScreen() {
  const [targetRoute, setTargetRoute] = useState<EntryRoute | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function loadGate() {
      const result = await resolveEntryRouteFromAdminCheck(hasAnyAdmin);
      if (!isActive) {
        return;
      }
      if (result.kind === "error") {
        setTargetRoute(null);
        setGateError(result.message);
        return;
      }

      setGateError(null);
      setTargetRoute(result.value);
    }

    loadGate();

    return () => {
      isActive = false;
    };
  }, [retryCount]);

  const viewState = getEntryGateScreenViewState(targetRoute, gateError);

  if (viewState.kind === "error") {
    return (
      <GateErrorState
        message={viewState.message}
        onRetry={() => setRetryCount((value) => value + 1)}
      />
    );
  }

  if (viewState.kind === "loading") {
    return <GateLoadingState />;
  }

  return <DeferredRedirect href={viewState.href} />;
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: "500",
  },
});
