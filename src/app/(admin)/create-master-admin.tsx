import { router } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { DeferredRedirect } from "@/components/deferred-redirect";
import { GateErrorState } from "@/components/gate-error-state";
import {
  createInitialMasterAdmin,
  hasAnyAdmin,
  normalizeAdminUsername,
} from "@/domain/services/auth-service";
import { resolveCreateMasterAdminVisibility } from "@/domain/services/entry-gate-runtime";
import { getCreateMasterAdminScreenViewState } from "@/domain/services/entry-gate-view-state";

const REQUIRED_FIELDS_ERROR_MESSAGE =
  "Username, password, and confirmation are required.";
const PASSWORD_MISMATCH_ERROR_MESSAGE = "Password and confirmation must match.";

function validateCreateMasterAdminInput(
  username: string,
  password: string,
  confirmPassword: string,
) {
  if (!normalizeAdminUsername(username) || !password || !confirmPassword) {
    return REQUIRED_FIELDS_ERROR_MESSAGE;
  }
  if (password !== confirmPassword) {
    return PASSWORD_MISMATCH_ERROR_MESSAGE;
  }
  return null;
}

export default function CreateMasterAdminScreen() {
  const [showSetup, setShowSetup] = useState<boolean | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const normalizedUsername = useMemo(
    () => normalizeAdminUsername(username),
    [username],
  );

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

  async function onSubmit() {
    if (isSubmitting) {
      return;
    }

    const validationError = validateCreateMasterAdminInput(
      username,
      password,
      confirmPassword,
    );
    if (validationError) {
      setSubmitError(validationError);
      setPassword("");
      setConfirmPassword("");
      return;
    }

    setSubmitError(null);
    setIsSubmitting(true);
    try {
      const result = await createInitialMasterAdmin({
        username: normalizedUsername,
        password,
      });

      if (result.kind === "success" || result.kind === "already-exists") {
        router.replace("/login");
        return;
      }

      setSubmitError(result.message);
    } finally {
      // Avoid retaining plaintext password values in UI state after a submit attempt.
      setPassword("");
      setConfirmPassword("");
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>Create Master Admin</Text>
        <Text style={styles.description}>
          Set up the first administrator account for this LilStore device.
        </Text>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            accessibilityLabel="Username"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setUsername}
            placeholder="Enter username"
            placeholderTextColor="#6B7280"
            style={styles.input}
            value={username}
          />
          {Boolean(username.trim()) && normalizedUsername !== username.trim() ? (
            <Text style={styles.helperText}>
              Username will be saved as: {normalizedUsername}
            </Text>
          ) : null}
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Password</Text>
          <TextInput
            accessibilityLabel="Password"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setPassword}
            placeholder="Enter password"
            placeholderTextColor="#6B7280"
            secureTextEntry
            style={styles.input}
            value={password}
          />
        </View>

        <View style={styles.fieldGroup}>
          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            accessibilityLabel="Confirm Password"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setConfirmPassword}
            placeholder="Confirm password"
            placeholderTextColor="#6B7280"
            secureTextEntry
            style={styles.input}
            value={confirmPassword}
          />
        </View>

        {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={isSubmitting}
          onPress={onSubmit}
          style={({ pressed }) => [
            styles.submitButton,
            pressed && !isSubmitting && styles.submitButtonPressed,
            isSubmitting && styles.submitButtonDisabled,
          ]}
        >
          <Text style={styles.submitButtonLabel}>
            {isSubmitting ? "Creating..." : "Create Admin Account"}
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
    padding: 20,
    borderWidth: 1,
    borderColor: "#F3E6DD",
    backgroundColor: "#FFFFFF",
    shadowColor: "#1F2937",
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 12 },
    shadowRadius: 24,
    elevation: 5,
    gap: 14,
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
  fieldGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  input: {
    minHeight: 44,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F3E6DD",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 14,
    paddingVertical: 10,
    color: "#1F2937",
    fontSize: 15,
  },
  helperText: {
    fontSize: 13,
    color: "#6B7280",
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#EF4444",
    fontWeight: "600",
  },
  submitButton: {
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
  submitButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  submitButtonDisabled: {
    opacity: 0.75,
  },
  submitButtonLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
