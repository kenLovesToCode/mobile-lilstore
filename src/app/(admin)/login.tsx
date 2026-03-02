import React, { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { DeferredRedirect } from "@/components/deferred-redirect";
import { EntryShell } from "@/components/entry-shell";
import { GateErrorState } from "@/components/gate-error-state";
import { hasAnyAdmin } from "@/domain/services/auth-service";
import { resolveAdminLoginVisibility } from "@/domain/services/entry-gate-runtime";
import { getAdminLoginScreenViewState } from "@/domain/services/entry-gate-view-state";

export default function AdminLoginScreen() {
  const [showLogin, setShowLogin] = useState<boolean | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isActive = true;

    async function loadGuard() {
      const result = await resolveAdminLoginVisibility(hasAnyAdmin);
      if (!isActive) {
        return;
      }
      if (result.kind === "error") {
        setShowLogin(null);
        setGateError(result.message);
        return;
      }

      setGateError(null);
      setShowLogin(result.value);
    }

    loadGuard();

    return () => {
      isActive = false;
    };
  }, [retryCount]);

  const viewState = getAdminLoginScreenViewState(showLogin, gateError);

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
      title="Admin Login"
      description="Sign in as an administrator to continue to LilStore management features."
      note="Story 1.3 will implement the full login fields, validation, and protected session behavior."
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
