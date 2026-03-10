import { SymbolView } from "expo-symbols";
import React, { type ComponentProps } from "react";
import { StyleSheet, Text, View } from "react-native";

import { adminDesignTokens, useAdminPalette } from "@/tamagui";

import { MotionPressable } from "./motion-pressable";
import { buildFadeInDown, EntryView } from "./reanimated-entry";

type SymbolName = ComponentProps<typeof SymbolView>["name"];

type DashboardActionTileProps = {
  label: string;
  description: string;
  icon: SymbolName;
  accessibilityLabel: string;
  onPress: () => void;
  delayMs?: number;
  featured?: boolean;
  testID?: string;
};

export function DashboardActionTile({
  label,
  description,
  icon,
  accessibilityLabel,
  onPress,
  delayMs = 0,
  featured = false,
  testID,
}: DashboardActionTileProps) {
  const palette = useAdminPalette();

  return (
    <EntryView
      entering={buildFadeInDown(adminDesignTokens.motion.entryDuration, delayMs)}
      style={styles.wrapper}
    >
      <MotionPressable
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={[
          styles.button,
          featured
            ? {
                backgroundColor: palette.primarySoft,
                borderColor: palette.primary,
              }
            : null,
        ]}
        testID={testID}
        tone="secondary"
      >
        <View style={styles.content}>
          <View
            style={[
              styles.iconBadge,
              {
                backgroundColor: featured ? palette.primary : palette.surface,
                borderColor: featured ? palette.primary : palette.border,
              },
            ]}
          >
            <SymbolView
              name={icon}
              size={18}
              tintColor={featured ? palette.surface : palette.primary}
              weight="medium"
            />
          </View>

          <View style={styles.copyBlock}>
            <Text style={[styles.title, { color: palette.textStrong }]}>{label}</Text>
            <Text style={[styles.description, { color: palette.text }]}>{description}</Text>
          </View>
        </View>
      </MotionPressable>
    </EntryView>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
    minWidth: 200,
  },
  button: {
    alignItems: "stretch",
    borderRadius: adminDesignTokens.radius.field,
    justifyContent: "flex-start",
    minHeight: 116,
    paddingHorizontal: adminDesignTokens.space.sm,
    paddingVertical: adminDesignTokens.space.sm,
  },
  content: {
    flex: 1,
    gap: adminDesignTokens.space.sm,
  },
  iconBadge: {
    alignItems: "center",
    borderRadius: adminDesignTokens.radius.field,
    borderWidth: 1,
    height: 42,
    justifyContent: "center",
    width: 42,
  },
  copyBlock: {
    flex: 1,
    gap: adminDesignTokens.space.xxs,
  },
  title: {
    ...adminDesignTokens.typography.footerTitle,
  },
  description: {
    ...adminDesignTokens.typography.body,
  },
});
