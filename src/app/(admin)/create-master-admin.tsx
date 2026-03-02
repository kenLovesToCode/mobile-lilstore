import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { DeferredRedirect } from "@/components/deferred-redirect";
import { EntryShell } from "@/components/entry-shell";
import { GateErrorState } from "@/components/gate-error-state";
import { hasAnyAdmin } from "@/domain/services/auth-service";
import { resolveCreateMasterAdminVisibility } from "@/domain/services/entry-gate-runtime";
import { getCreateMasterAdminScreenViewState } from "@/domain/services/entry-gate-view-state";

export default function CreateMasterAdminScreen() {
  const [showSetup, setShowSetup] = useState<boolean | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function loadGuard() {
      const result = await resolveCreateMasterAdminVisibility(hasAnyAdmin);
      if (!isActive) {
        return;
      }
      if (result.kind === "error") {
        setShowSetup(null);
        setGateError(result.message);
        return;
      }

      setGateError(null);
      setShowSetup(result.value);
    }

    loadGuard();

    return () => {
      isActive = false;
    };
  }, [retryCount]);

  const viewState = getCreateMasterAdminScreenViewState(showSetup, gateError);

  if (viewState.kind === "error") {
    return (
      <GateErrorState
        message={viewState.message}
        onRetry={() => setRetryCount((value) => value + 1)}
      />
    );
  }

  if (viewState.kind === "loading") {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  if (viewState.kind === "redirect") {
    return <DeferredRedirect href={viewState.href} />;
  }

  return (
    <EntryShell
      title="Create Master Admin"
      description="Set up the first administrator account for this LilStore device."
      note="Story 1.2 will implement the full create-admin form and validation."
    />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
