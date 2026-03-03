import { bootstrapDatabase, getDb } from "@/db/db";
import { APP_SECRET_TABLE, SHOPPER_TABLE } from "@/db/schema";
import {
  SHOPPER_PIN_UNIQUENESS_SCRYPT_PARAMS,
  deriveShopperPinCredentialMaterial,
  deriveShopperPinUniquenessKey,
  verifyPasswordCredentialMaterial,
} from "@/domain/services/password-derivation";
import {
  type OwnerScopeResult,
  conflictError,
  invalidInputError,
  OWNER_SCOPE_MISMATCH_MESSAGE,
  OWNER_SCOPE_NOT_FOUND_MESSAGE,
  OWNER_SCOPE_UNAVAILABLE_MESSAGE,
  getSafeErrorReason,
  requireActiveOwnerContext,
} from "@/domain/services/owner-scope";

type ShopperRow = {
  id: number;
  owner_id: number;
  name: string;
  created_at_ms: number;
  updated_at_ms: number;
};

export type Shopper = {
  id: number;
  ownerId: number;
  name: string;
  createdAtMs: number;
  updatedAtMs: number;
};

export type CreateShopperInput = {
  name: string;
  pin?: string | null;
  nowMs?: number;
};

export type UpdateShopperInput = {
  shopperId: number;
  name: string;
  pin?: string | null;
  nowMs?: number;
};

function mapShopper(row: ShopperRow): Shopper {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
  };
}

function normalize(value: string) {
  return value.trim();
}

function normalizePin(pin: string | null | undefined) {
  if (pin == null) {
    return null;
  }
  const normalized = pin.trim();
  return normalized.length > 0 ? normalized : null;
}

const SHOPPER_NAME_INVALID_MESSAGE = "Shopper name is required.";
const SHOPPER_PIN_INVALID_MESSAGE = "Shopper PIN must be at least 4 digits.";
const SHOPPER_PIN_CONFLICT_MESSAGE =
  "A shopper with this PIN already exists on this device.";
const SHOPPER_PIN_NOT_FOUND_MESSAGE = "No shopper was found for this PIN.";
const SHOPPER_PIN_LOOKUP_AMBIGUOUS_MESSAGE =
  "PIN lookup is ambiguous for this device. Reset shopper PINs before continuing.";
const SHOPPER_PIN_SALT_SECRET_KEY = "shopper_pin_salt_hex";

export type ShopperPinLookupIdentity = {
  shopperId: number;
  ownerId: number;
  displayName: string;
};

async function findShopperById(shopperId: number) {
  const db = getDb();
  return db.getFirstAsync<ShopperRow>(
    `SELECT id, owner_id, name, created_at_ms, updated_at_ms
     FROM ${SHOPPER_TABLE}
     WHERE id = ?
     LIMIT 1;`,
    shopperId,
  );
}

async function findShopperWithLegacyPin(
  pin: string,
  excludeShopperId?: number,
): Promise<{ id: number } | null> {
  const db = getDb();
  if (typeof excludeShopperId === "number") {
    return db.getFirstAsync<{ id: number }>(
      `SELECT id
       FROM ${SHOPPER_TABLE}
       WHERE pin = ?
         AND id != ?
       LIMIT 1;`,
      pin,
      excludeShopperId,
    );
  }

  return db.getFirstAsync<{ id: number }>(
    `SELECT id
     FROM ${SHOPPER_TABLE}
     WHERE pin = ?
     LIMIT 1;`,
    pin,
  );
}

type LegacyPinHashRow = {
  id: number;
  pin_hash: string | null;
};

type ShopperLookupRow = {
  id: number;
  owner_id: number;
  name: string;
};

type LegacyPinHashLookupRow = ShopperLookupRow & {
  pin_hash: string | null;
};

function buildCompatibleLegacyPinHashStorageValue(
  pinKey: string,
  deviceSaltHex: string,
) {
  const normalizedDeviceSalt = deviceSaltHex.trim().toLowerCase();
  const normalizedPinKey = pinKey.trim().toLowerCase();
  return [
    "scrypt",
    `N=${SHOPPER_PIN_UNIQUENESS_SCRYPT_PARAMS.N}`,
    `r=${SHOPPER_PIN_UNIQUENESS_SCRYPT_PARAMS.r}`,
    `p=${SHOPPER_PIN_UNIQUENESS_SCRYPT_PARAMS.p}`,
    `dkLen=${SHOPPER_PIN_UNIQUENESS_SCRYPT_PARAMS.dkLen}`,
    `salt=${normalizedDeviceSalt}`,
    `hash=${normalizedPinKey}`,
  ].join("$");
}

async function findShopperWithLegacyPinHashConflict(
  pin: string,
  excludeShopperId?: number,
): Promise<{ id: number } | null> {
  const db = getDb();
  const rows =
    typeof excludeShopperId === "number"
      ? await db.getAllAsync<LegacyPinHashRow>(
          `SELECT id, pin_hash
           FROM ${SHOPPER_TABLE}
           WHERE pin_hash IS NOT NULL
             AND (pin_key IS NULL OR length(trim(pin_key)) = 0)
             AND id != ?;`,
          excludeShopperId,
        )
      : await db.getAllAsync<LegacyPinHashRow>(
          `SELECT id, pin_hash
           FROM ${SHOPPER_TABLE}
           WHERE pin_hash IS NOT NULL
             AND (pin_key IS NULL OR length(trim(pin_key)) = 0);`,
        );

  for (const row of rows) {
    if (!row.pin_hash) {
      continue;
    }
    try {
      const isMatch = await verifyPasswordCredentialMaterial(pin, row.pin_hash);
      if (isMatch) {
        return { id: row.id };
      }
    } catch {
      // Malformed legacy payloads should not block writes; they are repaired via update flows.
    }
  }

  return null;
}

async function findShoppersByPinKey(pinKey: string) {
  const db = getDb();
  return db.getAllAsync<ShopperLookupRow>(
    `SELECT id, owner_id, name
     FROM ${SHOPPER_TABLE}
     WHERE pin_key = ?;`,
    pinKey,
  );
}

async function findShoppersWithLegacyPin(pin: string) {
  const db = getDb();
  return db.getAllAsync<ShopperLookupRow>(
    `SELECT id, owner_id, name
     FROM ${SHOPPER_TABLE}
     WHERE pin = ?;`,
    pin,
  );
}

async function findShoppersWithLegacyPinHash(
  pin: string,
  pinKey: string,
  deviceSaltHex: string,
  excludedShopperIds: Set<number>,
) {
  const db = getDb();
  const matches: ShopperLookupRow[] = [];
  const compatibleLegacyHashStorageValue = buildCompatibleLegacyPinHashStorageValue(
    pinKey,
    deviceSaltHex,
  );

  const compatibleRows = await db.getAllAsync<ShopperLookupRow>(
    `SELECT id, owner_id, name
     FROM ${SHOPPER_TABLE}
     WHERE pin_hash = ?
       AND pin_hash IS NOT NULL
       AND (pin_key IS NULL OR length(trim(pin_key)) = 0);`,
    compatibleLegacyHashStorageValue,
  );

  for (const row of compatibleRows) {
    if (!excludedShopperIds.has(row.id)) {
      matches.push(row);
    }
  }

  const rows = await db.getAllAsync<LegacyPinHashLookupRow>(
    `SELECT id, owner_id, name, pin_hash
     FROM ${SHOPPER_TABLE}
     WHERE pin_hash IS NOT NULL
       AND (pin_key IS NULL OR length(trim(pin_key)) = 0)
       AND pin_hash != ?;`,
    compatibleLegacyHashStorageValue,
  );

  for (const row of rows) {
    if (excludedShopperIds.has(row.id) || !row.pin_hash) {
      continue;
    }
    try {
      const isMatch = await verifyPasswordCredentialMaterial(pin, row.pin_hash);
      if (isMatch) {
        matches.push({
          id: row.id,
          owner_id: row.owner_id,
          name: row.name,
        });
      }
    } catch {
      // Malformed payloads should fail-safe to no match.
    }
  }

  return matches;
}

function validateShopperName(name: string): OwnerScopeResult<never> | null {
  if (!name) {
    return invalidInputError(SHOPPER_NAME_INVALID_MESSAGE);
  }

  return null;
}

function validatePin(
  pin: string | null,
  options?: { required?: boolean },
): OwnerScopeResult<never> | null {
  if (pin == null) {
    if (options?.required) {
      return invalidInputError(SHOPPER_PIN_INVALID_MESSAGE);
    }
    return null;
  }

  if (!/^\d{4,}$/.test(pin)) {
    return invalidInputError(SHOPPER_PIN_INVALID_MESSAGE);
  }

  return null;
}

async function getDeviceShopperPinSalt() {
  const db = getDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value
     FROM ${APP_SECRET_TABLE}
     WHERE key = ?
     LIMIT 1;`,
    SHOPPER_PIN_SALT_SECRET_KEY,
  );

  if (!row?.value) {
    throw new Error("Device shopper PIN salt is unavailable.");
  }

  return row.value;
}

export async function createShopper(
  input: CreateShopperInput,
): Promise<OwnerScopeResult<Shopper>> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  const db = getDb();
  const nowMs = input.nowMs ?? Date.now();
  const normalizedName = normalize(input.name);
  const normalizedPin = normalizePin(input.pin);
  const nameError = validateShopperName(normalizedName);
  if (nameError) {
    return nameError;
  }
  const pinError = validatePin(normalizedPin, { required: true });
  if (pinError) {
    return pinError;
  }
  try {
    if (normalizedPin == null) {
      return invalidInputError(SHOPPER_PIN_INVALID_MESSAGE);
    }

    const deviceSalt = await getDeviceShopperPinSalt();
    const [derivedPinMaterial, pinKey] = await Promise.all([
      deriveShopperPinCredentialMaterial(normalizedPin, deviceSalt),
      deriveShopperPinUniquenessKey(normalizedPin, deviceSalt),
    ]);

    const conflictingLegacyPin = await findShopperWithLegacyPin(normalizedPin);
    if (conflictingLegacyPin) {
      return conflictError(SHOPPER_PIN_CONFLICT_MESSAGE);
    }
    const conflictingLegacyPinHash =
      await findShopperWithLegacyPinHashConflict(normalizedPin);
    if (conflictingLegacyPinHash) {
      return conflictError(SHOPPER_PIN_CONFLICT_MESSAGE);
    }

    const insertResult = await db.runAsync(
      `INSERT INTO ${SHOPPER_TABLE} (
         owner_id, name, pin_hash, pin_key, pin, created_at_ms, updated_at_ms
      ) VALUES (?, ?, ?, ?, NULL, ?, ?);`,
      ownerContext.value.id,
      normalizedName,
      derivedPinMaterial?.storageValue ?? null,
      pinKey,
      nowMs,
      nowMs,
    );

    const created = await findShopperById(Number(insertResult.lastInsertRowId));
    if (!created) {
      return {
        ok: false,
        error: {
          code: "OWNER_SCOPE_UNAVAILABLE",
          message: OWNER_SCOPE_UNAVAILABLE_MESSAGE,
        },
      };
    }

    return { ok: true, value: mapShopper(created) };
  } catch (error: unknown) {
    if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
      return conflictError(SHOPPER_PIN_CONFLICT_MESSAGE);
    }

    console.warn("[shopper-service] createShopper failed", {
      reason: getSafeErrorReason(error),
    });
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_UNAVAILABLE",
        message: OWNER_SCOPE_UNAVAILABLE_MESSAGE,
      },
    };
  }
}

export async function listShoppers(): Promise<OwnerScopeResult<Shopper[]>> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  const db = getDb();

  try {
    const rows = await db.getAllAsync<ShopperRow>(
      `SELECT id, owner_id, name, created_at_ms, updated_at_ms
       FROM ${SHOPPER_TABLE}
       WHERE owner_id = ?
       ORDER BY created_at_ms DESC, id DESC;`,
      ownerContext.value.id,
    );

    return { ok: true, value: rows.map(mapShopper) };
  } catch (error: unknown) {
    console.warn("[shopper-service] listShoppers failed", {
      reason: getSafeErrorReason(error),
    });
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_UNAVAILABLE",
        message: OWNER_SCOPE_UNAVAILABLE_MESSAGE,
      },
    };
  }
}

export async function getShopperById(
  shopperId: number,
): Promise<OwnerScopeResult<Shopper>> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();

  try {
    const row = await findShopperById(shopperId);
    if (!row) {
      return {
        ok: false,
        error: {
          code: "OWNER_SCOPE_NOT_FOUND",
          message: OWNER_SCOPE_NOT_FOUND_MESSAGE,
        },
      };
    }

    if (row.owner_id !== ownerContext.value.id) {
      return {
        ok: false,
        error: {
          code: "OWNER_SCOPE_MISMATCH",
          message: OWNER_SCOPE_MISMATCH_MESSAGE,
        },
      };
    }

    return { ok: true, value: mapShopper(row) };
  } catch (error: unknown) {
    console.warn("[shopper-service] getShopperById failed", {
      reason: getSafeErrorReason(error),
    });
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_UNAVAILABLE",
        message: OWNER_SCOPE_UNAVAILABLE_MESSAGE,
      },
    };
  }
}

export async function updateShopper(
  input: UpdateShopperInput,
): Promise<OwnerScopeResult<Shopper>> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  const db = getDb();
  const existing = await findShopperById(input.shopperId);
  const normalizedName = normalize(input.name);
  const shouldUpdatePin = Object.prototype.hasOwnProperty.call(input, "pin");
  const normalizedPin = shouldUpdatePin ? normalizePin(input.pin) : undefined;
  const nameError = validateShopperName(normalizedName);
  if (nameError) {
    return nameError;
  }
  if (shouldUpdatePin) {
    const pinError = validatePin(normalizedPin ?? null, { required: true });
    if (pinError) {
      return pinError;
    }
  }

  if (!existing) {
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_NOT_FOUND",
        message: OWNER_SCOPE_NOT_FOUND_MESSAGE,
      },
    };
  }

  if (existing.owner_id !== ownerContext.value.id) {
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_MISMATCH",
        message: OWNER_SCOPE_MISMATCH_MESSAGE,
      },
    };
  }

  try {
    if (normalizedPin != null) {
      const conflictingLegacyPin = await findShopperWithLegacyPin(
        normalizedPin,
        input.shopperId,
      );
      if (conflictingLegacyPin) {
        return conflictError(SHOPPER_PIN_CONFLICT_MESSAGE);
      }
      const conflictingLegacyPinHash =
        await findShopperWithLegacyPinHashConflict(
          normalizedPin,
          input.shopperId,
        );
      if (conflictingLegacyPinHash) {
        return conflictError(SHOPPER_PIN_CONFLICT_MESSAGE);
      }
    }

    if (shouldUpdatePin) {
      const deviceSalt = await getDeviceShopperPinSalt();
      if (normalizedPin == null) {
        return invalidInputError(SHOPPER_PIN_INVALID_MESSAGE);
      }
      const [derivedPinMaterial, pinKey] = await Promise.all([
        deriveShopperPinCredentialMaterial(normalizedPin, deviceSalt),
        deriveShopperPinUniquenessKey(normalizedPin, deviceSalt),
      ]);
      await db.runAsync(
        `UPDATE ${SHOPPER_TABLE}
         SET name = ?, pin_hash = ?, pin_key = ?, pin = NULL, updated_at_ms = ?
         WHERE id = ? AND owner_id = ?;`,
        normalizedName,
        derivedPinMaterial?.storageValue ?? null,
        pinKey,
        input.nowMs ?? Date.now(),
        input.shopperId,
        ownerContext.value.id,
      );
    } else {
      await db.runAsync(
        `UPDATE ${SHOPPER_TABLE}
         SET name = ?, updated_at_ms = ?
         WHERE id = ? AND owner_id = ?;`,
        normalizedName,
        input.nowMs ?? Date.now(),
        input.shopperId,
        ownerContext.value.id,
      );
    }

    const updated = await findShopperById(input.shopperId);
    if (!updated) {
      return {
        ok: false,
        error: {
          code: "OWNER_SCOPE_NOT_FOUND",
          message: OWNER_SCOPE_NOT_FOUND_MESSAGE,
        },
      };
    }
    return { ok: true, value: mapShopper(updated) };
  } catch (error: unknown) {
    if (error instanceof Error && /UNIQUE constraint failed/i.test(error.message)) {
      return conflictError(SHOPPER_PIN_CONFLICT_MESSAGE);
    }
    console.warn("[shopper-service] updateShopper failed", {
      reason: getSafeErrorReason(error),
    });
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_UNAVAILABLE",
        message: OWNER_SCOPE_UNAVAILABLE_MESSAGE,
      },
    };
  }
}

export async function lookupShopperByPin(
  rawPin: string,
): Promise<OwnerScopeResult<ShopperPinLookupIdentity>> {
  const normalizedPin = normalizePin(rawPin);
  const pinError = validatePin(normalizedPin, { required: true });
  if (pinError) {
    return pinError;
  }

  if (normalizedPin == null) {
    return invalidInputError(SHOPPER_PIN_INVALID_MESSAGE);
  }

  await bootstrapDatabase();

  try {
    const deviceSalt = await getDeviceShopperPinSalt();
    const pinKey = await deriveShopperPinUniquenessKey(normalizedPin, deviceSalt);
    const matchesById = new Map<number, ShopperLookupRow>();

    const pinKeyMatches = await findShoppersByPinKey(pinKey);
    for (const row of pinKeyMatches) {
      matchesById.set(row.id, row);
    }

    const legacyPinMatches = await findShoppersWithLegacyPin(normalizedPin);
    for (const row of legacyPinMatches) {
      matchesById.set(row.id, row);
    }

    const legacyPinHashMatches = await findShoppersWithLegacyPinHash(
      normalizedPin,
      pinKey,
      deviceSalt,
      new Set<number>(matchesById.keys()),
    );
    for (const row of legacyPinHashMatches) {
      matchesById.set(row.id, row);
    }

    if (matchesById.size === 0) {
      return {
        ok: false,
        error: {
          code: "OWNER_SCOPE_NOT_FOUND",
          message: SHOPPER_PIN_NOT_FOUND_MESSAGE,
        },
      };
    }

    if (matchesById.size > 1) {
      return conflictError(SHOPPER_PIN_LOOKUP_AMBIGUOUS_MESSAGE);
    }

    const [resolvedShopper] = Array.from(matchesById.values());
    return {
      ok: true,
      value: {
        shopperId: resolvedShopper.id,
        ownerId: resolvedShopper.owner_id,
        displayName: resolvedShopper.name,
      },
    };
  } catch (error: unknown) {
    console.warn("[shopper-service] lookupShopperByPin failed", {
      reason: getSafeErrorReason(error),
    });
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_UNAVAILABLE",
        message: OWNER_SCOPE_UNAVAILABLE_MESSAGE,
      },
    };
  }
}

export async function resolveShopperEntryByPin(
  rawPin: string,
): Promise<OwnerScopeResult<ShopperPinLookupIdentity>> {
  return lookupShopperByPin(rawPin);
}
