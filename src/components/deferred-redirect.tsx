import { type Href, useRootNavigationState, useRouter } from "expo-router";
import React, { useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";

type DeferredRedirectProps = {
  href: Href;
};

export function DeferredRedirect({ href }: DeferredRedirectProps) {
  const router = useRouter();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (!rootNavigationState?.key) {
      return;
    }

    const frameId = requestAnimationFrame(() => {
      router.replace(href);
    });

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [href, rootNavigationState?.key, router]);

  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="small" />
    </View>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
