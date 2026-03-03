export type AdminSessionIdentity = {
  id: number;
  username: string;
};

export type ActiveOwnerContext = {
  id: number;
  name: string;
};

type StoredAdminSessionIdentity = Readonly<AdminSessionIdentity>;
type StoredActiveOwnerContext = Readonly<ActiveOwnerContext>;

let currentAdminSession: StoredAdminSessionIdentity | null = null;
let currentActiveOwner: StoredActiveOwnerContext | null = null;
const listeners = new Set<() => void>();

function getSafeErrorReason(error: unknown) {
  if (error instanceof Error && error.name) {
    return error.name;
  }
  return "UnknownError";
}

function toImmutableAdminSession(
  admin: AdminSessionIdentity,
): StoredAdminSessionIdentity {
  return Object.freeze({
    id: admin.id,
    username: admin.username,
  });
}

function toImmutableOwnerContext(owner: ActiveOwnerContext): StoredActiveOwnerContext {
  return Object.freeze({
    id: owner.id,
    name: owner.name,
  });
}

function emitSessionChange() {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error: unknown) {
      console.warn("[admin-session] listener callback failed", {
        reason: getSafeErrorReason(error),
      });
    }
  }
}

export function getAdminSession() {
  return currentAdminSession;
}

export function isAdminAuthenticated() {
  return currentAdminSession !== null;
}

export function getActiveOwner() {
  return currentActiveOwner;
}

export function setAdminSession(admin: AdminSessionIdentity) {
  currentAdminSession = toImmutableAdminSession(admin);
  currentActiveOwner = null;
  emitSessionChange();
}

export function setActiveOwner(owner: ActiveOwnerContext) {
  currentActiveOwner = toImmutableOwnerContext(owner);
  emitSessionChange();
}

export function clearAdminSession() {
  currentAdminSession = null;
  currentActiveOwner = null;
  emitSessionChange();
}

export function subscribeToAdminSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
