import {
  CREATE_SHOPPER_PIN_KEY_UNIQUE_INDEX_SQL,
  SHOPPER_TABLE,
} from "@/db/schema";
import {
  deriveShopperPinCredentialMaterial,
  deriveShopperPinUniquenessKey,
  extractShopperPinUniquenessKeyFromCredentialIfCompatible,
} from "@/domain/services/password-derivation";

export const SHOPPER_PIN_HASH_GLOBAL_UNIQUENESS_MIGRATION_STATEMENTS = [
  "DROP INDEX IF EXISTS idx_shopper_owner_pin_unique;",
  "DROP INDEX IF EXISTS idx_shopper_pin_hash_unique;",
  CREATE_SHOPPER_PIN_KEY_UNIQUE_INDEX_SQL,
];

type MigrationDb = {
  getAllAsync<T>(query: string): Promise<T[]>;
  execAsync(query: string): Promise<void>;
  runAsync(query: string, ...params: unknown[]): Promise<unknown>;
};

type TableInfoRow = {
  name: string;
};

type LegacyShopperPinRow = {
  id: number;
  pin: string | null;
  pin_hash: string | null;
  pin_key: string | null;
};

const LEGACY_PIN_PATTERN = /^\d{4,}$/;

export async function ensureShopperPinHashColumn(db: MigrationDb) {
  const columns = await db.getAllAsync<TableInfoRow>(
    `PRAGMA table_info(${SHOPPER_TABLE});`,
  );
  const hasPinHash = columns.some((column) => column.name === "pin_hash");
  if (hasPinHash) {
    return;
  }

  await db.execAsync(`ALTER TABLE ${SHOPPER_TABLE} ADD COLUMN pin_hash TEXT;`);
}

export async function ensureShopperPinKeyColumn(db: MigrationDb) {
  const columns = await db.getAllAsync<TableInfoRow>(
    `PRAGMA table_info(${SHOPPER_TABLE});`,
  );
  const hasPinKey = columns.some((column) => column.name === "pin_key");
  if (hasPinKey) {
    return;
  }

  await db.execAsync(`ALTER TABLE ${SHOPPER_TABLE} ADD COLUMN pin_key TEXT;`);
}

export async function backfillLegacyShopperPins(
  db: MigrationDb,
  deviceSaltHex: string,
) {
  const seenPinKeys = new Map<string, number>();
  const rows = await db.getAllAsync<LegacyShopperPinRow>(
    `SELECT id, pin, pin_hash, pin_key
     FROM ${SHOPPER_TABLE}
     ORDER BY id ASC;`,
  );

  for (const row of rows) {
    let resolvedPinKey: string | null = null;
    const existingPinKey = row.pin_key?.trim().toLowerCase() ?? null;
    const normalizedLegacyPin = row.pin?.trim() ?? null;
    if (normalizedLegacyPin == null || normalizedLegacyPin.length === 0) {
      if (row.pin != null) {
        await db.runAsync(
          `UPDATE ${SHOPPER_TABLE}
           SET pin = NULL
           WHERE id = ?;`,
          row.id,
        );
      }
    } else if (LEGACY_PIN_PATTERN.test(normalizedLegacyPin)) {
      const [derivedPinMaterial, pinKey] = await Promise.all([
        deriveShopperPinCredentialMaterial(normalizedLegacyPin, deviceSaltHex),
        deriveShopperPinUniquenessKey(normalizedLegacyPin, deviceSaltHex),
      ]);
      await db.runAsync(
        `UPDATE ${SHOPPER_TABLE}
         SET pin_hash = ?, pin_key = ?, pin = NULL
         WHERE id = ?;`,
        derivedPinMaterial.storageValue,
        pinKey,
        row.id,
      );
      resolvedPinKey = pinKey;
    } else {
      await db.runAsync(
        `UPDATE ${SHOPPER_TABLE}
         SET pin = NULL
         WHERE id = ?;`,
        row.id,
      );
    }

    if (!resolvedPinKey && row.pin_hash) {
      try {
        const compatiblePinKey =
          extractShopperPinUniquenessKeyFromCredentialIfCompatible(
            row.pin_hash,
            deviceSaltHex,
          );
        if (compatiblePinKey) {
          if (existingPinKey !== compatiblePinKey) {
            await db.runAsync(
              `UPDATE ${SHOPPER_TABLE}
               SET pin_key = ?
               WHERE id = ?;`,
              compatiblePinKey,
              row.id,
            );
          }
          resolvedPinKey = compatiblePinKey;
        } else if (existingPinKey) {
          await db.runAsync(
            `UPDATE ${SHOPPER_TABLE}
             SET pin_key = NULL
             WHERE id = ?;`,
            row.id,
          );
        }
      } catch {
        if (existingPinKey) {
          await db.runAsync(
            `UPDATE ${SHOPPER_TABLE}
             SET pin_key = NULL
             WHERE id = ?;`,
            row.id,
          );
        }
      }
    } else if (!resolvedPinKey && existingPinKey) {
      await db.runAsync(
        `UPDATE ${SHOPPER_TABLE}
         SET pin_key = NULL
         WHERE id = ?;`,
        row.id,
      );
    }

    if (resolvedPinKey) {
      const existingShopperId = seenPinKeys.get(resolvedPinKey);
      if (typeof existingShopperId === "number" && existingShopperId !== row.id) {
        await db.runAsync(
          `UPDATE ${SHOPPER_TABLE}
           SET pin_hash = NULL, pin_key = NULL, pin = NULL
           WHERE id = ?;`,
          row.id,
        );
        continue;
      }
      seenPinKeys.set(resolvedPinKey, row.id);
    }
  }
}
