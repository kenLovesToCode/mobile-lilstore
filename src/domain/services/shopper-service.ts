import { bootstrapDatabase, getDb } from "@/db/db";
import { SHOPPER_TABLE } from "@/db/schema";
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
const SHOPPER_PIN_INVALID_MESSAGE =
  "Shopper PIN must be at least 4 digits when provided.";
const SHOPPER_PIN_CONFLICT_MESSAGE =
  "A shopper with this PIN already exists for the active owner.";

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

function validateShopperName(name: string): OwnerScopeResult<never> | null {
  if (!name) {
    return invalidInputError(SHOPPER_NAME_INVALID_MESSAGE);
  }

  return null;
}

function validatePin(pin: string | null): OwnerScopeResult<never> | null {
  if (pin == null) {
    return null;
  }

  if (!/^\d{4,}$/.test(pin)) {
    return invalidInputError(SHOPPER_PIN_INVALID_MESSAGE);
  }

  return null;
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
  const pinError = validatePin(normalizedPin);
  if (pinError) {
    return pinError;
  }

  try {
    const insertResult = await db.runAsync(
      `INSERT INTO ${SHOPPER_TABLE} (
         owner_id, name, pin, created_at_ms, updated_at_ms
      ) VALUES (?, ?, ?, ?, ?);`,
      ownerContext.value.id,
      normalizedName,
      normalizedPin,
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
  const nameError = validateShopperName(normalizedName);
  if (nameError) {
    return nameError;
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
    await db.runAsync(
      `UPDATE ${SHOPPER_TABLE}
       SET name = ?, updated_at_ms = ?
       WHERE id = ? AND owner_id = ?;`,
      normalizedName,
      input.nowMs ?? Date.now(),
      input.shopperId,
      ownerContext.value.id,
    );

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
