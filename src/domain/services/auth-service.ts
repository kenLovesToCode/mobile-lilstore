import { getDb, bootstrapDatabase } from "@/db/db";
import { ADMIN_TABLE } from "@/db/schema";
import { updateEntryGateSnapshotAfterAdminChange } from "@/domain/services/entry-gate-runtime";
import { derivePasswordCredentialMaterial } from "@/domain/services/password-derivation";

type CountRow = {
  admin_count: number;
};

const DEFAULT_CREATE_ADMIN_ERROR_MESSAGE =
  "We couldn't create the admin account right now. Please retry.";
const ADMIN_ALREADY_EXISTS_MESSAGE =
  "Admin setup is already complete. Please sign in.";

export type CreateInitialMasterAdminInput = {
  username: string;
  password: string;
  nowMs?: number;
};

export type CreateInitialMasterAdminResult =
  | {
      kind: "success";
      username: string;
      createdAtMs: number;
    }
  | {
      kind: "already-exists";
      message: string;
    }
  | {
      kind: "error";
      message: string;
    };

export function normalizeAdminUsername(username: string) {
  return username.trim().toLowerCase();
}

export async function getAdminCount() {
  await bootstrapDatabase();
  const db = getDb();
  const row = await db.getFirstAsync<CountRow>(
    `SELECT COUNT(*) as admin_count FROM ${ADMIN_TABLE};`,
  );
  return row?.admin_count ?? 0;
}

export async function hasAnyAdmin() {
  const adminCount = await getAdminCount();
  return adminCount >= 1;
}

export async function createInitialMasterAdmin(
  input: CreateInitialMasterAdminInput,
): Promise<CreateInitialMasterAdminResult> {
  const normalizedUsername = normalizeAdminUsername(input.username);
  if (!normalizedUsername || !input.password) {
    return {
      kind: "error",
      message: DEFAULT_CREATE_ADMIN_ERROR_MESSAGE,
    };
  }

  const createdAtMs = input.nowMs ?? Date.now();

  await bootstrapDatabase();
  const db = getDb();

  try {
    const precheckRow = await db.getFirstAsync<CountRow>(
      `SELECT COUNT(*) as admin_count FROM ${ADMIN_TABLE};`,
    );
    if ((precheckRow?.admin_count ?? 0) > 0) {
      updateEntryGateSnapshotAfterAdminChange(true);
      return {
        kind: "already-exists",
        message: ADMIN_ALREADY_EXISTS_MESSAGE,
      };
    }

    const credential = await derivePasswordCredentialMaterial(input.password);
    let adminWasCreated = false;

    await db.withExclusiveTransactionAsync(async (txn) => {
      const insertResult = await txn.runAsync(
        `INSERT INTO ${ADMIN_TABLE} (username, password_hash, created_at_ms, updated_at_ms)
         SELECT ?, ?, ?, ?
         WHERE NOT EXISTS (SELECT 1 FROM ${ADMIN_TABLE} LIMIT 1);`,
        normalizedUsername,
        credential.storageValue,
        createdAtMs,
        createdAtMs,
      );

      adminWasCreated = insertResult.changes > 0;
    });

    if (!adminWasCreated) {
      updateEntryGateSnapshotAfterAdminChange(true);
      return {
        kind: "already-exists",
        message: ADMIN_ALREADY_EXISTS_MESSAGE,
      };
    }

    if (adminWasCreated) {
      updateEntryGateSnapshotAfterAdminChange(true);
      return {
        kind: "success",
        username: normalizedUsername,
        createdAtMs,
      };
    }

    return {
      kind: "error",
      message: DEFAULT_CREATE_ADMIN_ERROR_MESSAGE,
    };
  } catch (error) {
    console.warn("[auth-service] createInitialMasterAdmin failed", error);
    return {
      kind: "error",
      message: DEFAULT_CREATE_ADMIN_ERROR_MESSAGE,
    };
  }
}
