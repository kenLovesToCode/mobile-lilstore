import { bootstrapDatabase, getDb } from "@/db/db";
import { STORE_OWNER_TABLE } from "@/db/schema";
import { isAdminAuthenticated, setActiveOwner } from "@/domain/services/admin-session";

type OwnerRow = {
  id: number;
  name: string;
  created_at_ms: number;
  updated_at_ms: number;
};

export type Owner = {
  id: number;
  name: string;
  createdAtMs: number;
  updatedAtMs: number;
};

type OwnerServiceErrorCode =
  | "OWNER_NAME_REQUIRED"
  | "OWNER_NAME_TAKEN"
  | "OWNER_NOT_FOUND"
  | "OWNER_SWITCH_REQUIRES_ADMIN_SESSION"
  | "OWNER_SERVICE_UNAVAILABLE";

type OwnerServiceError = {
  code: OwnerServiceErrorCode;
  message: string;
};

export type OwnerServiceResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: OwnerServiceError };

export type CreateOwnerInput = {
  name: string;
  nowMs?: number;
};

const OWNER_NAME_REQUIRED_MESSAGE = "Owner name is required.";
const OWNER_NAME_TAKEN_MESSAGE = "An owner with that name already exists.";
const OWNER_NOT_FOUND_MESSAGE = "Owner not found.";
const OWNER_SWITCH_REQUIRES_ADMIN_SESSION_MESSAGE =
  "Please sign in as admin to switch owners.";
const OWNER_SERVICE_UNAVAILABLE_MESSAGE =
  "We couldn't update store owners right now. Please retry.";

function mapOwnerRow(row: OwnerRow): Owner {
  return {
    id: row.id,
    name: row.name,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
  };
}

function normalizeOwnerName(name: string) {
  return name.trim();
}

function isUniqueConstraintError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  return /UNIQUE constraint failed/i.test(error.message);
}

function safeErrorReason(error: unknown) {
  if (error instanceof Error && error.name) {
    return error.name;
  }
  return "UnknownError";
}

export async function createOwner(
  input: CreateOwnerInput,
): Promise<OwnerServiceResult<Owner>> {
  if (!isAdminAuthenticated()) {
    return {
      ok: false,
      error: {
        code: "OWNER_SWITCH_REQUIRES_ADMIN_SESSION",
        message: OWNER_SWITCH_REQUIRES_ADMIN_SESSION_MESSAGE,
      },
    };
  }

  const normalizedName = normalizeOwnerName(input.name);
  if (!normalizedName) {
    return {
      ok: false,
      error: {
        code: "OWNER_NAME_REQUIRED",
        message: OWNER_NAME_REQUIRED_MESSAGE,
      },
    };
  }

  await bootstrapDatabase();
  const db = getDb();
  const nowMs = input.nowMs ?? Date.now();

  try {
    const insertResult = await db.runAsync(
      `INSERT INTO ${STORE_OWNER_TABLE} (name, created_at_ms, updated_at_ms)
       VALUES (?, ?, ?);`,
      normalizedName,
      nowMs,
      nowMs,
    );

    const ownerId = Number(insertResult.lastInsertRowId);
    const createdOwner = await db.getFirstAsync<OwnerRow>(
      `SELECT id, name, created_at_ms, updated_at_ms
       FROM ${STORE_OWNER_TABLE}
       WHERE id = ?
       LIMIT 1;`,
      ownerId,
    );

    if (!createdOwner) {
      return {
        ok: false,
        error: {
          code: "OWNER_SERVICE_UNAVAILABLE",
          message: OWNER_SERVICE_UNAVAILABLE_MESSAGE,
        },
      };
    }

    return {
      ok: true,
      value: mapOwnerRow(createdOwner),
    };
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      return {
        ok: false,
        error: {
          code: "OWNER_NAME_TAKEN",
          message: OWNER_NAME_TAKEN_MESSAGE,
        },
      };
    }

    console.warn("[owner-service] createOwner failed", {
      reason: safeErrorReason(error),
    });

    return {
      ok: false,
      error: {
        code: "OWNER_SERVICE_UNAVAILABLE",
        message: OWNER_SERVICE_UNAVAILABLE_MESSAGE,
      },
    };
  }
}

export async function listOwners(): Promise<OwnerServiceResult<Owner[]>> {
  if (!isAdminAuthenticated()) {
    return {
      ok: false,
      error: {
        code: "OWNER_SWITCH_REQUIRES_ADMIN_SESSION",
        message: OWNER_SWITCH_REQUIRES_ADMIN_SESSION_MESSAGE,
      },
    };
  }

  await bootstrapDatabase();
  const db = getDb();

  try {
    const rows = await db.getAllAsync<OwnerRow>(
      `SELECT id, name, created_at_ms, updated_at_ms
       FROM ${STORE_OWNER_TABLE}
       ORDER BY created_at_ms DESC, id DESC;`,
    );

    return {
      ok: true,
      value: rows.map(mapOwnerRow),
    };
  } catch (error: unknown) {
    console.warn("[owner-service] listOwners failed", {
      reason: safeErrorReason(error),
    });

    return {
      ok: false,
      error: {
        code: "OWNER_SERVICE_UNAVAILABLE",
        message: OWNER_SERVICE_UNAVAILABLE_MESSAGE,
      },
    };
  }
}

export async function switchActiveOwner(
  ownerId: number,
): Promise<OwnerServiceResult<Owner>> {
  if (!isAdminAuthenticated()) {
    return {
      ok: false,
      error: {
        code: "OWNER_SWITCH_REQUIRES_ADMIN_SESSION",
        message: OWNER_SWITCH_REQUIRES_ADMIN_SESSION_MESSAGE,
      },
    };
  }

  await bootstrapDatabase();
  const db = getDb();

  try {
    const ownerRow = await db.getFirstAsync<OwnerRow>(
      `SELECT id, name, created_at_ms, updated_at_ms
       FROM ${STORE_OWNER_TABLE}
       WHERE id = ?
       LIMIT 1;`,
      ownerId,
    );

    if (!ownerRow) {
      return {
        ok: false,
        error: {
          code: "OWNER_NOT_FOUND",
          message: OWNER_NOT_FOUND_MESSAGE,
        },
      };
    }

    if (!isAdminAuthenticated()) {
      return {
        ok: false,
        error: {
          code: "OWNER_SWITCH_REQUIRES_ADMIN_SESSION",
          message: OWNER_SWITCH_REQUIRES_ADMIN_SESSION_MESSAGE,
        },
      };
    }

    setActiveOwner({
      id: ownerRow.id,
      name: ownerRow.name,
    });

    return {
      ok: true,
      value: mapOwnerRow(ownerRow),
    };
  } catch (error: unknown) {
    console.warn("[owner-service] switchActiveOwner failed", {
      reason: safeErrorReason(error),
    });

    return {
      ok: false,
      error: {
        code: "OWNER_SERVICE_UNAVAILABLE",
        message: OWNER_SERVICE_UNAVAILABLE_MESSAGE,
      },
    };
  }
}
