import * as SQLite from "expo-sqlite";

import { INITIAL_MIGRATION_STATEMENTS } from "@/db/migrations/0001_initial";
import { STORE_OWNER_MIGRATION_STATEMENTS } from "@/db/migrations/0002_store_owner";
import { OWNER_SCOPED_ENTITY_MIGRATION_STATEMENTS } from "@/db/migrations/0003_owner_scoped_entities";
import {
  SHOPPER_PIN_HASH_GLOBAL_UNIQUENESS_MIGRATION_STATEMENTS,
  ensureShopperPinHashColumn,
} from "@/db/migrations/0004_shopper_pin_hash_global_uniqueness";
import { DEVICE_SECRET_SALT_MIGRATION_STATEMENTS } from "@/db/migrations/0005_device_secret_salt";

const DATABASE_NAME = "lilstore.db";
const db = SQLite.openDatabaseSync(DATABASE_NAME);

const BASE_MIGRATION_STATEMENTS = [
  "PRAGMA foreign_keys = ON;",
  ...INITIAL_MIGRATION_STATEMENTS,
  ...STORE_OWNER_MIGRATION_STATEMENTS,
  ...OWNER_SCOPED_ENTITY_MIGRATION_STATEMENTS,
];

let bootstrapPromise: Promise<void> | null = null;

export function getDb() {
  return db;
}

export async function bootstrapDatabase() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      for (const statement of BASE_MIGRATION_STATEMENTS) {
        await db.execAsync(statement);
      }

      await ensureShopperPinHashColumn(db);

      for (const statement of SHOPPER_PIN_HASH_GLOBAL_UNIQUENESS_MIGRATION_STATEMENTS) {
        await db.execAsync(statement);
      }

      for (const statement of DEVICE_SECRET_SALT_MIGRATION_STATEMENTS) {
        await db.execAsync(statement);
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
