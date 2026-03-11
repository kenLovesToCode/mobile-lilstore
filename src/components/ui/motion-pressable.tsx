import { useEffect, useState, type ReactNode } from "react";
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { adminDesignTokens, adminElevation, useAdminPalette } from "@/tamagui";

type MotionTone = "primary" | "secondary" | "ghost" | "danger";

type MotionPressableProps = Omit<PressableProps, "style"> & {
  children: ReactNode;
  tone?: MotionTone;
  style?: StyleProp<ViewStyle>;
};

export function resolveMotionPressableTransform(
  pressed: boolean,
  reduceMotion: boolean,
) {
  if (!pressed || reduceMotion) {
    return undefined;
  }

  return [{ scale: adminDesignTokens.motion.pressScale }];
}

function resolveMotionPressableStyle(
  interactionStyle: ViewStyle,
  style?: StyleProp<ViewStyle>,
) {
  const flattenedStyle = StyleSheet.flatten(style);

  return flattenedStyle == null
    ? [styles.base, interactionStyle]
    : [styles.base, interactionStyle, flattenedStyle];
}

export function MotionPressable({
  children,
  tone = "secondary",
  style,
  disabled,
  accessibilityState,
  ...props
}: MotionPressableProps) {
  const [reduceMotion, setReduceMotion] = useState(true);
  const palette = useAdminPalette();

  useEffect(() => {
    let active = true;
    const canReadReduceMotionPreference =
      process.env.NODE_ENV !== "test"
      && typeof AccessibilityInfo.isReduceMotionEnabled === "function";
    const canSubscribeToReduceMotionPreference =
      typeof AccessibilityInfo.addEventListener === "function";

    if (canReadReduceMotionPreference) {
      void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
        if (active) {
          setReduceMotion((current) => (current === value ? current : value));
        }
      });
    }

    const subscription = canSubscribeToReduceMotionPreference
      ? AccessibilityInfo.addEventListener("reduceMotionChanged", setReduceMotion)
      : null;

    return () => {
      active = false;
      subscription?.remove();
    };
  }, []);

  const toneStyles: Record<
    MotionTone,
    { backgroundColor: string; borderColor: string; labelColor: string; elevated: boolean }
  > = {
    primary: {
      backgroundColor: palette.primary,
      borderColor: palette.primary,
      labelColor: palette.surface,
      elevated: true,
    },
    secondary: {
      backgroundColor: palette.surface,
      borderColor: palette.border,
      labelColor: palette.textStrong,
      elevated: false,
    },
    ghost: {
      backgroundColor: "transparent",
      borderColor: palette.borderSoft,
      labelColor: palette.textStrong,
      elevated: false,
    },
    danger: {
      backgroundColor: palette.dangerSurface,
      borderColor: palette.dangerBorder,
      labelColor: palette.dangerText,
      elevated: false,
    },
  };

  const toneStyle = toneStyles[tone];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{
        disabled: Boolean(disabled),
        ...(accessibilityState ?? undefined),
      }}
      disabled={disabled}
      style={({ pressed }) => {
        const interactionStyle: ViewStyle = {
          backgroundColor: toneStyle.backgroundColor,
          borderColor: toneStyle.borderColor,
          opacity: disabled
            ? adminDesignTokens.motion.disabledOpacity
            : pressed
              ? adminDesignTokens.motion.pressedOpacity
              : 1,
        };

        if (toneStyle.elevated) {
          interactionStyle.shadowColor = palette.shadow;
          interactionStyle.shadowOpacity = adminElevation.raised.shadowOpacity;
          interactionStyle.shadowOffset = adminElevation.raised.shadowOffset;
          interactionStyle.shadowRadius = adminElevation.raised.shadowRadius;
          interactionStyle.elevation = adminElevation.raised.elevation;
        }

        const transform = resolveMotionPressableTransform(pressed, reduceMotion);

        if (transform) {
          interactionStyle.transform = transform;
        }

        return resolveMotionPressableStyle(interactionStyle, style);
      }}
      {...props}
    >
      {typeof children === "string" ? (
        <Text style={[styles.label, { color: toneStyle.labelColor }]}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: adminDesignTokens.size.minTapTarget,
    paddingHorizontal: adminDesignTokens.space.md,
    paddingVertical: adminDesignTokens.space.sm,
    borderRadius: adminDesignTokens.radius.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...adminDesignTokens.typography.button,
  },
});
