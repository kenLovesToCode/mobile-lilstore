import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type EntryShellProps = {
  title: string;
  description: string;
  note: string;
};

export function EntryShell({ title, description, note }: EntryShellProps) {
  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.card}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
        <Text style={styles.note}>{note}</Text>
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
    backgroundColor: "#F6F8FB",
  },
  card: {
    width: "100%",
    maxWidth: 520,
    borderRadius: 12,
    padding: 20,
    backgroundColor: "#FFFFFF",
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#1B2430",
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: "#2E3A4B",
  },
  note: {
    marginTop: 4,
    fontSize: 14,
    color: "#58667A",
  },
});
