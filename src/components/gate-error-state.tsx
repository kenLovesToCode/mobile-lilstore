import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

type GateErrorStateProps = {
  message: string;
  onRetry: () => void;
};

export function GateErrorState({ message, onRetry }: GateErrorStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Unable to load entry gate</Text>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRetry}
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
      >
        <Text style={styles.buttonLabel}>Retry</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#1B2430",
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    lineHeight: 20,
    color: "#2E3A4B",
    textAlign: "center",
  },
  button: {
    backgroundColor: "#1F6FEB",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  buttonPressed: {
    opacity: 0.8,
  },
  buttonLabel: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },
});
