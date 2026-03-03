import { getDb, bootstrapDatabase } from "@/db/db";
import { ADMIN_TABLE } from "@/db/schema";
import { updateEntryGateSnapshotAfterAdminChange } from "@/domain/services/entry-gate-runtime";
import {
  DEFAULT_SCRYPT_PARAMS,
  derivePasswordCredentialMaterial,
  serializeDerivedPasswordCredential,
  verifyPasswordCredentialMaterial,
} from "@/domain/services/password-derivation";

type CountRow = {
  admin_count: number;
};

const DEFAULT_CREATE_ADMIN_ERROR_MESSAGE =
  "We couldn't create the admin account right now. Please retry.";
const ADMIN_ALREADY_EXISTS_MESSAGE =
  "Admin setup is already complete. Please sign in.";
const INVALID_ADMIN_CREDENTIALS_MESSAGE = "Invalid username or password.";
const DEFAULT_AUTHENTICATE_ADMIN_ERROR_MESSAGE =
  "We couldn't sign you in right now. Please retry.";

type ScryptParams = {
  N: number;
  r: number;
  p: number;
  dkLen: number;
};

const STORED_CREDENTIAL_VALIDATION_ERRORS = new Set([
  "Invalid stored credential format.",
  "Unsupported scrypt parameters.",
  "Invalid hex value in stored credential.",
  "Stored credential hash length does not match parameters.",
]);

const AUTH_COST_PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;

let authCostProfilesCache:
  | {
      loadedAtMs: number;
      profiles: ScryptParams[];
    }
  | null = null;

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

type AdminCredentialsRow = {
  id: number;
  username: string;
  password_hash: string;
};

type AdminHashRow = {
  password_hash: string;
};

export type AuthenticateAdminInput = {
  username: string;
  password: string;
};

export type AuthenticateAdminResult =
  | {
      kind: "success";
      admin: {
        id: number;
        username: string;
      };
    }
  | {
      kind: "invalid-credentials";
      message: string;
    }
  | {
      kind: "error";
      message: string;
    };

export function normalizeAdminUsername(username: string) {
  return username.trim().toLowerCase();
}

function getSafeErrorReason(error: unknown) {
  if (error instanceof Error && error.name) {
    return error.name;
  }
  return "UnknownError";
}

function isStoredCredentialValidationError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  return STORED_CREDENTIAL_VALIDATION_ERRORS.has(error.message);
}

function clearAuthCostProfilesCache() {
  authCostProfilesCache = null;
}

function getDefaultScryptParams(): ScryptParams {
  return {
    N: DEFAULT_SCRYPT_PARAMS.N,
    r: DEFAULT_SCRYPT_PARAMS.r,
    p: DEFAULT_SCRYPT_PARAMS.p,
    dkLen: DEFAULT_SCRYPT_PARAMS.dkLen,
  };
}

function getScryptParamsKey(params: ScryptParams) {
  return `${params.N}:${params.r}:${params.p}:${params.dkLen}`;
}

function createDummyScryptCredential(params: ScryptParams) {
  return serializeDerivedPasswordCredential({
    algorithm: "scrypt",
    params,
    saltHex: "00".repeat(DEFAULT_SCRYPT_PARAMS.saltLen),
    hashHex: "00".repeat(params.dkLen),
  });
}

function parseStoredScryptParams(storageValue: string): ScryptParams | null {
  const match = /^scrypt\$N=(\d+)\$r=(\d+)\$p=(\d+)\$dkLen=(\d+)\$/.exec(
    storageValue,
  );
  if (!match) {
    return null;
  }

  return {
    N: Number.parseInt(match[1], 10),
    r: Number.parseInt(match[2], 10),
    p: Number.parseInt(match[3], 10),
    dkLen: Number.parseInt(match[4], 10),
  };
}

function estimateScryptCost(params: ScryptParams) {
  return {
    cpuCost: params.N * params.r * params.p,
    memoryCost: params.N * params.r,
    dkLen: params.dkLen,
  };
}

function canSafelyRefreshCredential(current: ScryptParams, next: ScryptParams) {
  const currentCost = estimateScryptCost(current);
  const nextCost = estimateScryptCost(next);
  return (
    nextCost.cpuCost >= currentCost.cpuCost &&
    nextCost.memoryCost >= currentCost.memoryCost &&
    nextCost.dkLen >= currentCost.dkLen
  );
}

function shouldRefreshStoredCredential(storageValue: string) {
  const currentParams = parseStoredScryptParams(storageValue);
  if (!currentParams) {
    return false;
  }

  const nextParams = getDefaultScryptParams();
  const hasParamDiff =
    currentParams.N !== nextParams.N ||
    currentParams.r !== nextParams.r ||
    currentParams.p !== nextParams.p ||
    currentParams.dkLen !== nextParams.dkLen;

  if (!hasParamDiff) {
    return false;
  }

  return canSafelyRefreshCredential(currentParams, nextParams);
}

function getAuthCostProfiles(passwordHashes: string[]) {
  const profiles = new Map<string, ScryptParams>();
  const defaultParams = getDefaultScryptParams();
  profiles.set(getScryptParamsKey(defaultParams), defaultParams);

  for (const passwordHash of passwordHashes) {
    const params = parseStoredScryptParams(passwordHash);
    if (!params) {
      continue;
    }
    profiles.set(getScryptParamsKey(params), params);
  }

  return Array.from(profiles.values());
}

async function getAuthCostProfilesForMissingUser(db: ReturnType<typeof getDb>) {
  const nowMs = Date.now();
  if (
    authCostProfilesCache &&
    nowMs - authCostProfilesCache.loadedAtMs < AUTH_COST_PROFILE_CACHE_TTL_MS
  ) {
    return authCostProfilesCache.profiles;
  }

  const authCostRows = await db.getAllAsync<AdminHashRow>(
    `SELECT password_hash FROM ${ADMIN_TABLE};`,
  );
  const profiles = getAuthCostProfiles(authCostRows.map((row) => row.password_hash));
  authCostProfilesCache = {
    loadedAtMs: nowMs,
    profiles,
  };
  return profiles;
}

async function runDummyAuthCostChecks(
  password: string,
  profiles: ScryptParams[],
  skipProfileKeys: Set<string>,
) {
  for (const profile of profiles) {
    const profileKey = getScryptParamsKey(profile);
    if (skipProfileKeys.has(profileKey)) {
      continue;
    }

    try {
      await verifyPasswordCredentialMaterial(
        password,
        createDummyScryptCredential(profile),
      );
    } catch {
      // Intentionally ignore parse/verify failures for timing equalization checks.
    }
  }
}

async function refreshAdminCredentialMaterial(
  adminId: number,
  password: string,
) {
  try {
    const nextCredential = await derivePasswordCredentialMaterial(password);
    const db = getDb();
    await db.runAsync(
      `UPDATE ${ADMIN_TABLE}
       SET password_hash = ?, updated_at_ms = ?
       WHERE id = ?;`,
      nextCredential.storageValue,
      Date.now(),
      adminId,
    );
    clearAuthCostProfilesCache();
  } catch (error: unknown) {
    console.warn("[auth-service] authenticateAdmin credential refresh skipped", {
      reason: getSafeErrorReason(error),
    });
  }
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
      clearAuthCostProfilesCache();
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
  } catch (error: unknown) {
    console.warn("[auth-service] createInitialMasterAdmin failed", {
      reason: getSafeErrorReason(error),
    });
    return {
      kind: "error",
      message: DEFAULT_CREATE_ADMIN_ERROR_MESSAGE,
    };
  }
}

export async function authenticateAdmin(
  input: AuthenticateAdminInput,
): Promise<AuthenticateAdminResult> {
  const normalizedUsername = normalizeAdminUsername(input.username);
  if (!normalizedUsername || !input.password) {
    return {
      kind: "invalid-credentials",
      message: INVALID_ADMIN_CREDENTIALS_MESSAGE,
    };
  }

  await bootstrapDatabase();
  const db = getDb();

  try {
    const adminRow = await db.getFirstAsync<AdminCredentialsRow>(
      `SELECT id, username, password_hash
       FROM ${ADMIN_TABLE}
       WHERE username = ?
       LIMIT 1;`,
      normalizedUsername,
    );

    if (!adminRow) {
      const authCostProfiles = await getAuthCostProfilesForMissingUser(db);
      await runDummyAuthCostChecks(input.password, authCostProfiles, new Set());
      return {
        kind: "invalid-credentials",
        message: INVALID_ADMIN_CREDENTIALS_MESSAGE,
      };
    }

    let isValidPassword = false;
    let credentialVerificationFailure: "none" | "invalid-material" | "runtime" =
      "none";
    try {
      isValidPassword = await verifyPasswordCredentialMaterial(
        input.password,
        adminRow.password_hash,
      );
    } catch (error: unknown) {
      credentialVerificationFailure = isStoredCredentialValidationError(error)
        ? "invalid-material"
        : "runtime";
      console.warn("[auth-service] authenticateAdmin failed", {
        reason:
          credentialVerificationFailure === "invalid-material"
            ? "CredentialVerificationError"
            : "CredentialVerificationRuntimeError",
      });
    }

    if (credentialVerificationFailure === "invalid-material") {
      return {
        kind: "invalid-credentials",
        message: INVALID_ADMIN_CREDENTIALS_MESSAGE,
      };
    }

    if (credentialVerificationFailure === "runtime") {
      return {
        kind: "error",
        message: DEFAULT_AUTHENTICATE_ADMIN_ERROR_MESSAGE,
      };
    }

    if (!isValidPassword) {
      return {
        kind: "invalid-credentials",
        message: INVALID_ADMIN_CREDENTIALS_MESSAGE,
      };
    }

    if (shouldRefreshStoredCredential(adminRow.password_hash)) {
      void refreshAdminCredentialMaterial(adminRow.id, input.password);
    }

    return {
      kind: "success",
      admin: {
        id: adminRow.id,
        username: adminRow.username,
      },
    };
  } catch (error: unknown) {
    console.warn("[auth-service] authenticateAdmin failed", {
      reason: getSafeErrorReason(error),
    });
    return {
      kind: "error",
      message: DEFAULT_AUTHENTICATE_ADMIN_ERROR_MESSAGE,
    };
  }
}
