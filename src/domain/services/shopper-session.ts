export type ShopperSessionIdentity = {
  shopperId: number;
  ownerId: number;
  displayName: string;
  startedAtMs?: number;
};

type StoredShopperSessionIdentity = Readonly<ShopperSessionIdentity>;

let currentShopperSession: StoredShopperSessionIdentity | null = null;
const listeners = new Set<() => void>();

function getSafeErrorReason(error: unknown) {
  if (error instanceof Error && error.name) {
    return error.name;
  }
  return "UnknownError";
}

function toImmutableShopperSession(
  shopperSession: ShopperSessionIdentity,
): StoredShopperSessionIdentity {
  const immutable: ShopperSessionIdentity = {
    shopperId: shopperSession.shopperId,
    ownerId: shopperSession.ownerId,
    displayName: shopperSession.displayName,
  };

  if (typeof shopperSession.startedAtMs === "number") {
    immutable.startedAtMs = shopperSession.startedAtMs;
  }

  return Object.freeze(immutable);
}

function emitSessionChange() {
  for (const listener of listeners) {
    try {
      listener();
    } catch (error: unknown) {
      console.warn("[shopper-session] listener callback failed", {
        reason: getSafeErrorReason(error),
      });
    }
  }
}

export function getShopperSession() {
  return currentShopperSession;
}

export function hasActiveShopperSession() {
  return currentShopperSession !== null;
}

export function setShopperSession(shopperSession: ShopperSessionIdentity) {
  currentShopperSession = toImmutableShopperSession(shopperSession);
  emitSessionChange();
}

export function clearShopperSession() {
  currentShopperSession = null;
  emitSessionChange();
}

export function subscribeToShopperSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
