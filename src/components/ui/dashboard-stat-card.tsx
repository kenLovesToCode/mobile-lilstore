import React from "react";
import { StyleSheet, Text } from "react-native";

import { adminDesignTokens, useAdminPalette } from "@/tamagui";

import { buildFadeInDown, EntryView } from "./reanimated-entry";
import { SoftCard } from "./soft-card";

type DashboardStatCardTone = "default" | "info" | "success" | "warning" | "danger";

type DashboardStatCardProps = {
  label: string;
  value: string;
  supportingText: string;
  tone?: DashboardStatCardTone;
  delayMs?: number;
  testID?: string;
};

const toneMap = {
  default: "default",
  info: "info",
  success: "success",
  warning: "warning",
  danger: "danger",
} as const;

export function DashboardStatCard({
  label,
  value,
  supportingText,
  tone = "default",
  delayMs = 0,
  testID,
}: DashboardStatCardProps) {
  const palette = useAdminPalette();

  return (
    <EntryView
      entering={buildFadeInDown(adminDesignTokens.motion.entryDuration, delayMs)}
      style={styles.wrapper}
    >
      <SoftCard style={styles.card} testID={testID} tone={toneMap[tone]}>
        <Text style={[styles.label, { color: palette.muted }]}>{label}</Text>
        <Text style={[styles.value, { color: palette.textStrong }]}>{value}</Text>
        <Text style={[styles.supportingText, { color: palette.text }]}>{supportingText}</Text>
      </SoftCard>
    </EntryView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    minWidth: 140,
  },
  card: {
    minHeight: 132,
    justifyContent: "space-between",
    paddingHorizontal: adminDesignTokens.space.md,
    paddingVertical: adminDesignTokens.space.md,
  },
  label: {
    ...adminDesignTokens.typography.sectionEyebrow,
    textTransform: "uppercase",
  },
  value: {
    fontSize: 28,
    fontWeight: "800",
    lineHeight: 32,
    fontVariant: ["tabular-nums"],
  },
  supportingText: {
    ...adminDesignTokens.typography.body,
  },
});
