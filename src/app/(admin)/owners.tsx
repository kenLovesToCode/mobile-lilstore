import { router } from "expo-router";
import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  ActivityIndicator,
  Pressable,
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
  createOwner,
  listOwners,
  type Owner,
  switchActiveOwner,
} from "@/domain/services/owner-service";

export default function AdminOwnersScreen() {
  const [owners, setOwners] = useState<Owner[]>([]);
  const [ownerName, setOwnerName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [switchingOwnerId, setSwitchingOwnerId] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const createLockRef = useRef(false);

  const activeOwner = useSyncExternalStore(
    subscribeToAdminSession,
    getActiveOwner,
    () => null,
  );

  const normalizedOwnerName = useMemo(() => ownerName.trim(), [ownerName]);

  useEffect(() => {
    let isActive = true;

    async function loadOwners() {
      const result = await listOwners();
      if (!isActive) {
        return;
      }

      if (!result.ok) {
        setErrorMessage(result.error.message);
        setIsLoading(false);
        return;
      }

      setOwners(result.value);
      setErrorMessage(null);
      setIsLoading(false);
    }

    loadOwners();

    return () => {
      isActive = false;
    };
  }, []);

  async function reloadOwners() {
    const result = await listOwners();
    if (!result.ok) {
      setErrorMessage(result.error.message);
      return;
    }
    setOwners(result.value);
    setErrorMessage(null);
  }

  async function onCreateOwner() {
    if (createLockRef.current || isSubmitting) {
      return;
    }

    createLockRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await createOwner({ name: normalizedOwnerName });
      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }

      setOwnerName("");
      setErrorMessage(null);
      await reloadOwners();
    } finally {
      createLockRef.current = false;
      setIsSubmitting(false);
    }
  }

  async function onSwitchOwner(id: number) {
    if (switchingOwnerId !== null) {
      return;
    }

    setSwitchingOwnerId(id);
    try {
      const result = await switchActiveOwner(id);
      if (!result.ok) {
        setErrorMessage(result.error.message);
        return;
      }

      setErrorMessage(null);
      await reloadOwners();
    } finally {
      setSwitchingOwnerId(null);
    }
  }

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="small" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.card}>
          <Text style={styles.title}>Owners</Text>
          <Text style={styles.description}>
            Create and switch store-owner context for this admin session.
          </Text>

          <Text style={styles.activeOwnerLabel}>
            Active owner: {activeOwner?.name ?? "None"}
          </Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.label}>Owner Name</Text>
            <TextInput
              accessibilityLabel="Owner Name"
              autoCapitalize="words"
              autoCorrect={false}
              onChangeText={setOwnerName}
              placeholder="Enter owner name"
              placeholderTextColor="#6B7280"
              style={styles.input}
              value={ownerName}
            />

            <Pressable
              accessibilityRole="button"
              disabled={isSubmitting || !normalizedOwnerName}
              onPress={onCreateOwner}
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && !isSubmitting && styles.primaryButtonPressed,
                (isSubmitting || !normalizedOwnerName) && styles.primaryButtonDisabled,
              ]}
            >
              <Text style={styles.primaryButtonLabel}>
                {isSubmitting ? "Creating..." : "Create Owner"}
              </Text>
            </Pressable>
          </View>

          {errorMessage ? <Text style={styles.errorText}>{errorMessage}</Text> : null}

          <View style={styles.ownerList}>
            {owners.length === 0 ? (
              <Text style={styles.emptyStateText}>
                No owners yet. Create your first owner to continue.
              </Text>
            ) : (
              owners.map((owner) => {
                const isActiveOwner = activeOwner?.id === owner.id;
                const isSwitching = switchingOwnerId === owner.id;
                return (
                  <View key={owner.id} style={styles.ownerRow}>
                    <View style={styles.ownerInfo}>
                      <Text style={styles.ownerName}>{owner.name}</Text>
                      <Text style={styles.ownerMeta}>
                        {isActiveOwner ? "Current active owner" : "Available"}
                      </Text>
                    </View>
                    <Pressable
                      accessibilityLabel={`Switch to ${owner.name}`}
                      accessibilityRole="button"
                      disabled={isSwitching || isActiveOwner || switchingOwnerId !== null}
                      onPress={() => onSwitchOwner(owner.id)}
                      style={({ pressed }) => [
                        styles.switchButton,
                        pressed && !isSwitching && styles.switchButtonPressed,
                        (isSwitching || isActiveOwner || switchingOwnerId !== null) &&
                          styles.switchButtonDisabled,
                      ]}
                    >
                      <Text style={styles.switchButtonLabel}>
                        {isActiveOwner
                          ? "Active"
                          : isSwitching
                            ? "Switching..."
                            : "Switch"}
                      </Text>
                    </Pressable>
                  </View>
                );
              })
            )}
          </View>

          <Pressable
            accessibilityLabel="Go to Dashboard"
            accessibilityRole="button"
            onPress={() => router.replace("/dashboard")}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <Text style={styles.backButtonLabel}>Back to Dashboard</Text>
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
    flexGrow: 1,
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 560,
    alignSelf: "center",
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
  activeOwnerLabel: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "700",
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
  primaryButton: {
    minHeight: 48,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FF6B6B",
    backgroundColor: "#FF6B6B",
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButtonPressed: {
    opacity: 0.92,
  },
  primaryButtonDisabled: {
    opacity: 0.65,
  },
  primaryButtonLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#EF4444",
    fontWeight: "600",
  },
  ownerList: {
    gap: 12,
  },
  emptyStateText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#6B7280",
  },
  ownerRow: {
    borderWidth: 1,
    borderColor: "#F3E6DD",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  ownerInfo: {
    flex: 1,
    gap: 4,
  },
  ownerName: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
  },
  ownerMeta: {
    fontSize: 13,
    color: "#6B7280",
  },
  switchButton: {
    minHeight: 36,
    minWidth: 84,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#FF6B6B",
    backgroundColor: "#FF6B6B",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  switchButtonPressed: {
    opacity: 0.92,
  },
  switchButtonDisabled: {
    opacity: 0.6,
  },
  switchButtonLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  backButton: {
    minHeight: 44,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  backButtonPressed: {
    opacity: 0.8,
  },
  backButtonLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: "#374151",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
