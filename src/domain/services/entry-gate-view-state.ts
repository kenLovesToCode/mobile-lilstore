import {
  ADMIN_LOGIN_ROUTE,
  CREATE_MASTER_ADMIN_ROUTE,
  type EntryRoute,
} from "./entry-gate";

export type EntryGateScreenViewState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "redirect"; href: EntryRoute };

type AdminShellRoute = typeof ADMIN_LOGIN_ROUTE | typeof CREATE_MASTER_ADMIN_ROUTE;

export type AdminGateScreenViewState =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "content" }
  | { kind: "redirect"; href: AdminShellRoute };

export function getEntryGateScreenViewState(
  targetRoute: EntryRoute | null,
  gateError: string | null,
): EntryGateScreenViewState {
  if (gateError) {
    return { kind: "error", message: gateError };
  }
  if (!targetRoute) {
    return { kind: "loading" };
  }
  return { kind: "redirect", href: targetRoute };
}

export function getCreateMasterAdminScreenViewState(
  showSetup: boolean | null,
  gateError: string | null,
): AdminGateScreenViewState {
  if (gateError) {
    return { kind: "error", message: gateError };
  }
  if (showSetup === null) {
    return { kind: "loading" };
  }
  if (!showSetup) {
    return { kind: "redirect", href: ADMIN_LOGIN_ROUTE };
  }
  return { kind: "content" };
}

export function getAdminLoginScreenViewState(
  showLogin: boolean | null,
  gateError: string | null,
): AdminGateScreenViewState {
  if (gateError) {
    return { kind: "error", message: gateError };
  }
  if (showLogin === null) {
    return { kind: "loading" };
  }
  if (!showLogin) {
    return { kind: "redirect", href: CREATE_MASTER_ADMIN_ROUTE };
  }
  return { kind: "content" };
}
