import React from "react";
import { View, type ViewProps } from "react-native";
import Animated, { FadeIn, FadeInDown, ReduceMotion } from "react-native-reanimated";

import { adminDesignTokens } from "@/tamagui";

type AnimationBuilder = {
  delay?: (value: number) => AnimationBuilder;
  reduceMotion?: (value: unknown) => AnimationBuilder;
};

type AnimationFactory = {
  duration?: (value: number) => AnimationBuilder;
};

function withReduceMotion(animation: AnimationBuilder) {
  if (
    typeof animation.reduceMotion === "function"
    && typeof ReduceMotion !== "undefined"
    && "System" in ReduceMotion
  ) {
    return animation.reduceMotion(ReduceMotion.System);
  }

  return animation;
}

function buildEntryAnimation(
  factory: AnimationFactory | undefined,
  durationMs: number,
  delayMs: number,
) {
  if (!factory || typeof factory.duration !== "function") {
    return undefined;
  }

  const animation = factory.duration(durationMs);
  if (typeof animation.delay === "function") {
    return withReduceMotion(animation.delay(delayMs));
  }

  return withReduceMotion(animation);
}

export function buildFadeIn(
  durationMs: number = adminDesignTokens.motion.entryDuration,
  delayMs: number = 0,
) {
  return buildEntryAnimation(FadeIn as AnimationFactory | undefined, durationMs, delayMs);
}

export function buildFadeInDown(
  durationMs: number = adminDesignTokens.motion.entryDuration,
  delayMs: number = 0,
) {
  return buildEntryAnimation(FadeInDown as AnimationFactory | undefined, durationMs, delayMs);
}

type EntryViewProps = ViewProps & {
  entering?: unknown;
};

const AnimatedView = (Animated as unknown as { View?: React.ComponentType<any> }).View;

export function EntryView({ entering, ...props }: EntryViewProps) {
  if (AnimatedView) {
    return <AnimatedView entering={entering} {...props} />;
  }

  return <View {...props} />;
}
