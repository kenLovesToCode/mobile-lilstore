import * as SQLite from "expo-sqlite";

import { INITIAL_MIGRATION_STATEMENTS } from "@/db/migrations/0001_initial";

const DATABASE_NAME = "lilstore.db";
const db = SQLite.openDatabaseSync(DATABASE_NAME);

let bootstrapPromise: Promise<void> | null = null;

export function getDb() {
  return db;
}

export async function bootstrapDatabase() {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      for (const statement of INITIAL_MIGRATION_STATEMENTS) {
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
