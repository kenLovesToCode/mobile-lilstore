export type AdminSessionIdentity = {
  id: number;
  username: string;
};

type StoredAdminSessionIdentity = Readonly<AdminSessionIdentity>;

let currentAdminSession: StoredAdminSessionIdentity | null = null;
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

export function setAdminSession(admin: AdminSessionIdentity) {
  currentAdminSession = toImmutableAdminSession(admin);
  emitSessionChange();
}

export function clearAdminSession() {
  currentAdminSession = null;
  emitSessionChange();
}

export function subscribeToAdminSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
