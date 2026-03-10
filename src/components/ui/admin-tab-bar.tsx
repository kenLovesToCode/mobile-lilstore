import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { SymbolView } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  adminPrimaryTabs,
  resolveAdminPrimaryTab,
} from "@/features/admin/navigation/admin-navigation";
import { adminDesignTokens, useAdminPalette } from "@/tamagui";

import { MotionPressable } from "./motion-pressable";
import { SoftCard } from "./soft-card";

export function AdminTabBar({ navigation, state }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const palette = useAdminPalette();
  const activeTab = resolveAdminPrimaryTab(state.routes[state.index]?.name ?? "dashboard");

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.wrapper,
        { paddingBottom: Math.max(insets.bottom, adminDesignTokens.space.sm) },
      ]}
    >
      <SoftCard style={styles.card} testID="admin-tab-bar" tone="accent">
        <View style={styles.row}>
          {adminPrimaryTabs.map((tab) => {
            const focused = activeTab === tab.key;
            const route = state.routes.find(
              (candidate) => candidate.name === tab.routeName,
            );

            if (!route) {
              return null;
            }

            const routeKey = route.key;
            const routeName = route.name;

            function onPress() {
              const event = navigation.emit({
                type: "tabPress",
                target: routeKey,
                canPreventDefault: true,
              });

              if (!focused && !event.defaultPrevented) {
                navigation.navigate(routeName as never);
              }
            }

            function onLongPress() {
              navigation.emit({
                type: "tabLongPress",
                target: routeKey,
              });
            }

            return (
              <MotionPressable
                key={tab.key}
                accessibilityLabel={tab.accessibilityLabel}
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                onLongPress={onLongPress}
                onPress={onPress}
                style={[
                  styles.button,
                  focused && {
                    backgroundColor: palette.primarySoft,
                    borderColor: palette.primary,
                  },
                ]}
                testID={`admin-tab-button-${tab.key}`}
                tone="ghost"
              >
                <View style={styles.buttonContent}>
                  <SymbolView
                    name={tab.icon}
                    size={18}
                    tintColor={focused ? palette.primary : palette.muted}
                    weight={focused ? "semibold" : "medium"}
                  />
                  <Text
                    style={[
                      styles.label,
                      { color: focused ? palette.primary : palette.muted },
                    ]}
                  >
                    {tab.label}
                  </Text>
                </View>
              </MotionPressable>
            );
          })}
        </View>
      </SoftCard>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingTop: adminDesignTokens.space.sm,
  },
  card: {
    paddingHorizontal: adminDesignTokens.space.sm,
    paddingVertical: adminDesignTokens.space.sm,
  },
  row: {
    flexDirection: "row",
    gap: adminDesignTokens.space.xs,
  },
  button: {
    flex: 1,
    minHeight: 58,
    borderRadius: adminDesignTokens.radius.field,
    paddingHorizontal: adminDesignTokens.space.xs,
  },
  buttonContent: {
    alignItems: "center",
    gap: adminDesignTokens.space.xxs,
    justifyContent: "center",
  },
  label: {
    ...adminDesignTokens.typography.chip,
  },
});
