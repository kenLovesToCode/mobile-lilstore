import { router } from "expo-router";
import React, { useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { type OwnerScopeErrorCode } from "@/domain/services/owner-scope";
import { clearShopperSession, setShopperSession } from "@/domain/services/shopper-session";
import { resolveShopperEntryByPin } from "@/domain/services/shopper-service";

const PIN_PATTERN = /^\d{4,}$/;
const PIN_LOOKUP_RUNTIME_ERROR_MESSAGE =
  "We couldn't unlock your session right now. Please try again.";
const KEYPAD_ROWS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  ["clear", "0", "backspace"],
] as const;

function mapPinEntryErrorMessage(errorCode: OwnerScopeErrorCode) {
  if (errorCode === "OWNER_SCOPE_NOT_FOUND") {
    return "We couldn't match that PIN. Please try again.";
  }
  if (errorCode === "OWNER_SCOPE_CONFLICT") {
    return "That PIN matches multiple shoppers. Ask an admin to reset shopper PINs, then try again.";
  }
  if (errorCode === "OWNER_SCOPE_INVALID_INPUT") {
    return "Enter at least 4 digits to continue.";
  }
  return PIN_LOOKUP_RUNTIME_ERROR_MESSAGE;
}

export default function ShopperPinEntryScreen() {
  const [pin, setPin] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  const isPinValid = PIN_PATTERN.test(pin);
  const maskedPin = useMemo(() => "•".repeat(pin.length), [pin]);

  function onDigitPress(digit: string) {
    if (isSubmitting) {
      return;
    }
    setSubmitError(null);
    setPin((current) => current + digit);
  }

  function onBackspace() {
    if (isSubmitting) {
      return;
    }
    setSubmitError(null);
    setPin((current) => current.slice(0, -1));
  }

  function onClear() {
    if (isSubmitting) {
      return;
    }
    setSubmitError(null);
    setPin("");
  }

  async function onSubmit() {
    if (!isPinValid || submitLockRef.current || isSubmitting) {
      return;
    }

    const pinForLookup = pin;
    setSubmitError(null);
    submitLockRef.current = true;
    setIsSubmitting(true);
    try {
      const result = await resolveShopperEntryByPin(pinForLookup);
      if (!result.ok) {
        clearShopperSession();
        setSubmitError(mapPinEntryErrorMessage(result.error.code));
        return;
      }

      setShopperSession({
        shopperId: result.value.shopperId,
        ownerId: result.value.ownerId,
        displayName: result.value.displayName,
        startedAtMs: Date.now(),
      });
      router.replace("/scan" as never);
    } catch {
      clearShopperSession();
      setSubmitError(mapPinEntryErrorMessage("OWNER_SCOPE_UNAVAILABLE"));
    } finally {
      // Always clear raw PIN input after submit attempts (success or failure).
      setPin("");
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>Enter your shopper PIN</Text>
        <Text style={styles.description}>
          Use your PIN to unlock shopping for your profile.
        </Text>

        <View style={styles.pinPreviewBox}>
          <Text style={styles.pinPreviewText}>{maskedPin || "____"}</Text>
        </View>

        <View style={styles.keypad}>
          {KEYPAD_ROWS.map((row, rowIndex) => (
            <View key={`row-${rowIndex}`} style={styles.keypadRow}>
              {row.map((key) => {
                if (key === "backspace") {
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel="PIN backspace"
                      disabled={isSubmitting || pin.length === 0}
                      onPress={onBackspace}
                      style={({ pressed }) => [
                        styles.keypadButton,
                        pressed && styles.keypadButtonPressed,
                        (isSubmitting || pin.length === 0) && styles.keypadButtonDisabled,
                      ]}
                    >
                      <Text style={styles.keypadButtonLabel}>⌫</Text>
                    </Pressable>
                  );
                }

                if (key === "clear") {
                  return (
                    <Pressable
                      key={key}
                      accessibilityRole="button"
                      accessibilityLabel="PIN clear"
                      disabled={isSubmitting || pin.length === 0}
                      onPress={onClear}
                      style={({ pressed }) => [
                        styles.keypadButton,
                        pressed && styles.keypadButtonPressed,
                        (isSubmitting || pin.length === 0) && styles.keypadButtonDisabled,
                      ]}
                    >
                      <Text style={styles.keypadButtonLabel}>Clear</Text>
                    </Pressable>
                  );
                }

                return (
                  <Pressable
                    key={key}
                    accessibilityRole="button"
                    accessibilityLabel={`PIN digit ${key}`}
                    disabled={isSubmitting}
                    onPress={() => onDigitPress(key)}
                    style={({ pressed }) => [
                      styles.keypadButton,
                      pressed && styles.keypadButtonPressed,
                      isSubmitting && styles.keypadButtonDisabled,
                    ]}
                  >
                    <Text style={styles.keypadButtonLabel}>{key}</Text>
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>

        {submitError ? <Text style={styles.errorText}>{submitError}</Text> : null}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Unlock Shopper Session"
          disabled={!isPinValid || isSubmitting}
          onPress={() => void onSubmit()}
          style={({ pressed }) => [
            styles.submitButton,
            pressed && !isSubmitting && styles.submitButtonPressed,
            (!isPinValid || isSubmitting) && styles.submitButtonDisabled,
          ]}
        >
          <Text style={styles.submitButtonLabel}>
            {isSubmitting ? "Unlocking..." : "Unlock & Continue"}
          </Text>
        </Pressable>

        {submitError ? (
          <Text style={styles.retryHint}>Enter your PIN again and try once more.</Text>
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
    padding: 20,
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
  pinPreviewBox: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#F3E6DD",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFDFB",
  },
  pinPreviewText: {
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: 4,
    fontWeight: "800",
    color: "#111827",
  },
  keypad: {
    gap: 8,
  },
  keypadRow: {
    flexDirection: "row",
    gap: 8,
  },
  keypadButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
  },
  keypadButtonPressed: {
    opacity: 0.85,
  },
  keypadButtonDisabled: {
    opacity: 0.45,
  },
  keypadButtonLabel: {
    fontSize: 16,
    fontWeight: "800",
    color: "#374151",
  },
  submitButton: {
    marginTop: 4,
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
  submitButtonPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.99 }],
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonLabel: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "800",
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#B91C1C",
    fontWeight: "600",
  },
  retryHint: {
    fontSize: 13,
    lineHeight: 18,
    color: "#6B7280",
    fontWeight: "500",
  },
});
