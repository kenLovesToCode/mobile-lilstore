import { StyleSheet, Text, View } from "react-native";

import { adminDesignTokens, useAdminPalette } from "@/tamagui";

import { MotionPressable } from "./motion-pressable";

type SegmentedModeOption<T extends string> = {
  key: T;
  label: string;
  accessibilityLabel: string;
  supportingText?: string;
};

type SegmentedModeToggleProps<T extends string> = {
  label?: string;
  options: SegmentedModeOption<T>[];
  selectedKey: T;
  onSelect: (key: T) => void;
};

export function SegmentedModeToggle<T extends string>({
  label,
  options,
  selectedKey,
  onSelect,
}: SegmentedModeToggleProps<T>) {
  const palette = useAdminPalette();

  return (
    <View style={styles.container}>
      {label ? (
        <Text style={[styles.label, { color: palette.muted }]}>{label}</Text>
      ) : null}

      <View style={[styles.track, { backgroundColor: palette.canvasAlt, borderColor: palette.borderSoft }]}>
        {options.map((option) => {
          const selected = option.key === selectedKey;
          return (
            <MotionPressable
              key={option.key}
              accessibilityLabel={option.accessibilityLabel}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              onPress={() => onSelect(option.key)}
              style={styles.option}
              tone={selected ? "primary" : "secondary"}
            >
              <Text
                style={[
                  styles.optionLabel,
                  { color: selected ? palette.surface : palette.textStrong },
                ]}
              >
                {option.label}
              </Text>
              {option.supportingText ? (
                <Text
                  style={[
                    styles.optionMeta,
                    {
                      color: selected ? palette.surface : palette.muted,
                      opacity: selected ? 0.82 : 1,
                    },
                  ]}
                >
                  {option.supportingText}
                </Text>
              ) : null}
            </MotionPressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: adminDesignTokens.space.xs,
  },
  label: {
    ...adminDesignTokens.typography.sectionEyebrow,
    textTransform: "uppercase",
  },
  track: {
    borderRadius: adminDesignTokens.radius.card,
    borderWidth: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: adminDesignTokens.space.xs,
    padding: adminDesignTokens.space.xs,
  },
  option: {
    alignItems: "flex-start",
    flex: 1,
    minWidth: 128,
  },
  optionLabel: {
    ...adminDesignTokens.typography.button,
  },
  optionMeta: {
    ...adminDesignTokens.typography.sectionEyebrow,
    fontWeight: "700",
    textTransform: "none",
  },
});
