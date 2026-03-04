import * as SQLite from "expo-sqlite";

import { INITIAL_MIGRATION_STATEMENTS } from "@/db/migrations/0001_initial";
import { STORE_OWNER_MIGRATION_STATEMENTS } from "@/db/migrations/0002_store_owner";
import { OWNER_SCOPED_ENTITY_MIGRATION_STATEMENTS } from "@/db/migrations/0003_owner_scoped_entities";
import {
  SHOPPER_PIN_HASH_GLOBAL_UNIQUENESS_MIGRATION_STATEMENTS,
  backfillLegacyShopperPins,
  ensureShopperPinHashColumn,
  ensureShopperPinKeyColumn,
} from "@/db/migrations/0004_shopper_pin_hash_global_uniqueness";
import { DEVICE_SECRET_SALT_MIGRATION_STATEMENTS } from "@/db/migrations/0005_device_secret_salt";
import {
  PRODUCT_ARCHIVE_LIFECYCLE_MIGRATION_STATEMENTS,
  ensureProductArchiveColumn,
} from "@/db/migrations/0006_product_archive_lifecycle";
import {
  SHOPPING_LIST_BUNDLE_OFFER_MIGRATION_STATEMENTS,
  ensureShoppingListBundleColumns,
} from "@/db/migrations/0007_shopping_list_bundle_offer";
import {
  SHOPPING_LIST_ASSORTED_GROUP_MIGRATION_STATEMENTS,
  ensureShoppingListAssortedTables,
} from "@/db/migrations/0008_shopping_list_assorted_groups";

const DATABASE_NAME = "lilstore.db";
const SHOPPER_PIN_SALT_SECRET_KEY = "shopper_pin_salt_hex";
const SHOPPER_PIN_MIGRATION_STATE_KEY = "shopper_pin_migration_v4_complete";

const BASE_MIGRATION_STATEMENTS = [
  "PRAGMA foreign_keys = ON;",
  ...INITIAL_MIGRATION_STATEMENTS,
  ...STORE_OWNER_MIGRATION_STATEMENTS,
  ...OWNER_SCOPED_ENTITY_MIGRATION_STATEMENTS,
];

let bootstrapPromise: Promise<void> | null = null;
let database: SQLite.SQLiteDatabase | null = null;
let databaseInitPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export function getDb() {
  if (!database) {
    throw new Error("Database is not initialized. Call bootstrapDatabase() first.");
  }
  return database;
}

async function initializeDatabase() {
  if (database) {
    return database;
  }
  if (!databaseInitPromise) {
    databaseInitPromise = (async () => {
      try {
        database = SQLite.openDatabaseSync(DATABASE_NAME);
      } catch (error) {
        console.warn("[db] openDatabaseSync failed; falling back to async open.", {
          reason: error instanceof Error ? error.message : String(error),
        });
        database = await SQLite.openDatabaseAsync(DATABASE_NAME);
      }
      return database;
    })();
  }

  try {
    return await databaseInitPromise;
  } catch (error) {
    databaseInitPromise = null;
    database = null;
    throw error;
  }
}

export async function bootstrapDatabase() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const db = await initializeDatabase();
      for (const statement of BASE_MIGRATION_STATEMENTS) {
        await db.execAsync(statement);
      }
      await ensureProductArchiveColumn(db);
      for (const statement of PRODUCT_ARCHIVE_LIFECYCLE_MIGRATION_STATEMENTS) {
        await db.execAsync(statement);
      }
      await ensureShoppingListBundleColumns(db);
      for (const statement of SHOPPING_LIST_BUNDLE_OFFER_MIGRATION_STATEMENTS) {
        await db.execAsync(statement);
      }
      await ensureShoppingListAssortedTables(db);
      for (const statement of SHOPPING_LIST_ASSORTED_GROUP_MIGRATION_STATEMENTS) {
        await db.execAsync(statement);
      }
      for (const statement of DEVICE_SECRET_SALT_MIGRATION_STATEMENTS) {
        await db.execAsync(statement);
      }
      const migrationStateRow = await db.getFirstAsync<{ value: string }>(
        "SELECT value FROM app_secret WHERE key = ? LIMIT 1;",
        SHOPPER_PIN_MIGRATION_STATE_KEY,
      );
      if (!migrationStateRow?.value) {
        await db.execAsync("BEGIN IMMEDIATE TRANSACTION;");
        let didCommit = false;
        try {
          await ensureShopperPinHashColumn(db);
          await ensureShopperPinKeyColumn(db);

          const deviceSaltRow = await db.getFirstAsync<{ value: string }>(
            "SELECT value FROM app_secret WHERE key = ? LIMIT 1;",
            SHOPPER_PIN_SALT_SECRET_KEY,
          );
          if (!deviceSaltRow?.value) {
            throw new Error("Device shopper PIN salt is unavailable during migration.");
          }

          await backfillLegacyShopperPins(db, deviceSaltRow.value);

          for (const statement of SHOPPER_PIN_HASH_GLOBAL_UNIQUENESS_MIGRATION_STATEMENTS) {
            await db.execAsync(statement);
          }

          await db.runAsync(
            `UPDATE app_secret
             SET value = ?
             WHERE key = ?;`,
            "done",
            SHOPPER_PIN_MIGRATION_STATE_KEY,
          );
          await db.runAsync(
            `INSERT INTO app_secret (key, value)
             SELECT ?, ?
             WHERE NOT EXISTS (
               SELECT 1 FROM app_secret WHERE key = ?
             );`,
            SHOPPER_PIN_MIGRATION_STATE_KEY,
            "done",
            SHOPPER_PIN_MIGRATION_STATE_KEY,
          );
          await db.execAsync("COMMIT;");
          didCommit = true;
        } catch (error) {
          if (!didCommit) {
            try {
              await db.execAsync("ROLLBACK;");
            } catch {
              // Preserve original migration error if rollback also fails.
            }
          }
          throw error;
        }
      }
    })();
  }

  try {
    await bootstrapPromise;
  } catch (error) {
    bootstrapPromise = null;
    throw error;
  }
}
