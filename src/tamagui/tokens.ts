import { defaultConfig } from "@tamagui/config/v4";
import { createTokens } from "@tamagui/core";

export const appTokens = createTokens({
  size: {
    ...defaultConfig.tokens.size,
    "$0": 0,
    "$1": 12,
    "$2": 14,
    "$3": 16,
    "$4": 18,
    "$5": 20,
    "$6": 24,
    "$7": 30,
    "$8": 38,
    "$9": 44,
    "$10": 56,
    "$11": 64,
    "$12": 76,
    "$true": 16,
  },
  space: {
    ...defaultConfig.tokens.space,
    "$0": 0,
    "$0.5": 2,
    "$1": 4,
    "$1.5": 6,
    "$2": 8,
    "$2.5": 10,
    "$3": 12,
    "$4": 16,
    "$5": 20,
    "$6": 24,
    "$7": 32,
    "$8": 40,
    "$9": 48,
    "$10": 56,
    "$11": 64,
    "$12": 72,
    "$true": 16,
  },
  radius: {
    ...defaultConfig.tokens.radius,
    "$0": 0,
    "$1": 12,
    "$2": 18,
    "$3": 24,
    "$4": 32,
    "$5": 40,
    "$6": 999,
    "$true": 18,
  },
  zIndex: {
    ...defaultConfig.tokens.zIndex,
  },
});

export const adminElevation = {
  soft: {
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
    elevation: 4,
  },
  raised: {
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.16,
    shadowRadius: 28,
    elevation: 7,
  },
} as const;

export const adminDesignTokens = {
  space: {
    xxs: 4,
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 24,
  },
  size: {
    minTapTarget: 44,
  },
  radius: {
    field: 18,
    card: 24,
    pill: 999,
  },
  typography: {
    eyebrow: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: "800" as const,
      letterSpacing: 0.8,
    },
    sectionEyebrow: {
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "800" as const,
      letterSpacing: 0.7,
    },
    body: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "500" as const,
    },
    button: {
      fontSize: 14,
      lineHeight: 18,
      fontWeight: "800" as const,
    },
    footerTitle: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: "800" as const,
    },
    sectionTitle: {
      fontSize: 22,
      lineHeight: 28,
      fontWeight: "800" as const,
    },
    cardTitle: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: "800" as const,
    },
    heroTitle: {
      fontSize: 34,
      lineHeight: 40,
      fontWeight: "800" as const,
    },
    heroSubtitle: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: "500" as const,
    },
    chip: {
      fontSize: 11,
      lineHeight: 16,
      fontWeight: "800" as const,
    },
  },
  motion: {
    pressScale: 0.985,
    disabledOpacity: 0.65,
    pressedOpacity: 0.95,
    entryDuration: 180,
    emphasisEntryDuration: 220,
    staggerDelay: 40,
    sectionDelayBase: 140,
  },
} as const;
