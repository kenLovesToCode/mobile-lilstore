import { SymbolView } from "expo-symbols";
import React, { type ComponentProps, type ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";

import { adminDesignTokens, useAdminPalette } from "@/tamagui";

import { buildFadeInDown, EntryView } from "./reanimated-entry";
import { SoftCard } from "./soft-card";

type SymbolName = ComponentProps<typeof SymbolView>["name"];
type IllustratedStateTone = "default" | "info" | "success" | "warning" | "danger";

type IllustratedStateCardProps = {
  eyebrow?: string;
  title: string;
  description: string;
  symbol: SymbolName;
  tone?: IllustratedStateTone;
  meta?: ReactNode;
  footer?: ReactNode;
  children?: ReactNode;
  delayMs?: number;
  testID?: string;
};

export function IllustratedStateCard({
  eyebrow,
  title,
  description,
  symbol,
  tone = "default",
  meta,
  footer,
  children,
  delayMs = 0,
  testID,
}: IllustratedStateCardProps) {
  const palette = useAdminPalette();

  return (
    <EntryView
      entering={buildFadeInDown(adminDesignTokens.motion.emphasisEntryDuration, delayMs)}
      style={styles.wrapper}
    >
      <SoftCard style={styles.card} testID={testID} tone={tone}>
        <View style={styles.headerRow}>
          <View style={styles.copyBlock}>
            {eyebrow ? (
              <Text style={[styles.eyebrow, { color: palette.muted }]}>{eyebrow}</Text>
            ) : null}
            <Text style={[styles.title, { color: palette.textStrong }]}>{title}</Text>
            <Text style={[styles.description, { color: palette.text }]}>{description}</Text>
          </View>

          <View
            style={[
              styles.illustrationWrap,
              {
                backgroundColor: palette.primarySoft,
                borderColor: palette.border,
              },
            ]}
          >
            <View
              style={[
                styles.illustrationBubbleLarge,
                { backgroundColor: palette.surface, borderColor: palette.borderSoft },
              ]}
            />
            <View
              style={[
                styles.illustrationBubbleSmall,
                { backgroundColor: palette.canvasAlt, borderColor: palette.border },
              ]}
            />
            <SymbolView name={symbol} size={24} tintColor={palette.primary} weight="medium" />
          </View>
        </View>

        {meta ? <View style={styles.metaRow}>{meta}</View> : null}
        {children ? <View style={styles.body}>{children}</View> : null}
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </SoftCard>
    </EntryView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    minWidth: 280,
  },
  card: {
    minHeight: 272,
    paddingHorizontal: adminDesignTokens.space.md,
    paddingVertical: adminDesignTokens.space.md,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: adminDesignTokens.space.sm,
  },
  copyBlock: {
    flex: 1,
    gap: adminDesignTokens.space.xs,
    minWidth: 180,
  },
  eyebrow: {
    ...adminDesignTokens.typography.sectionEyebrow,
    textTransform: "uppercase",
  },
  title: {
    ...adminDesignTokens.typography.cardTitle,
  },
  description: {
    ...adminDesignTokens.typography.body,
  },
  illustrationWrap: {
    alignItems: "center",
    borderRadius: adminDesignTokens.radius.card,
    borderWidth: 1,
    height: 88,
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
    width: 88,
  },
  illustrationBubbleLarge: {
    borderRadius: 999,
    borderWidth: 1,
    height: 60,
    position: "absolute",
    right: -10,
    top: -4,
    width: 60,
  },
  illustrationBubbleSmall: {
    borderRadius: 999,
    borderWidth: 1,
    bottom: -8,
    height: 34,
    left: -4,
    position: "absolute",
    width: 34,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: adminDesignTokens.space.xs,
  },
  body: {
    gap: adminDesignTokens.space.xs,
  },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: adminDesignTokens.space.xs,
    paddingTop: adminDesignTokens.space.xs,
  },
});
