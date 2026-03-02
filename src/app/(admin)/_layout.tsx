import { Stack, usePathname } from "expo-router";
import React, { useSyncExternalStore } from "react";

import { DeferredRedirect } from "@/components/deferred-redirect";
import {
  isAdminAuthenticated,
  subscribeToAdminSession,
} from "@/domain/services/admin-session";

const PUBLIC_ADMIN_ROUTES = new Set(["/create-master-admin", "/login"]);

export default function AdminLayout() {
  const pathname = usePathname();
  const authenticated = useSyncExternalStore(
    subscribeToAdminSession,
    isAdminAuthenticated,
    () => false,
  );

  if (!authenticated && !PUBLIC_ADMIN_ROUTES.has(pathname)) {
    return <DeferredRedirect href="/login" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}
