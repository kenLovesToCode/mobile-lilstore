import { CREATE_SHOPPER_PIN_HASH_UNIQUE_INDEX_SQL, SHOPPER_TABLE } from "@/db/schema";

export const SHOPPER_PIN_HASH_GLOBAL_UNIQUENESS_MIGRATION_STATEMENTS = [
  "DROP INDEX IF EXISTS idx_shopper_owner_pin_unique;",
  CREATE_SHOPPER_PIN_HASH_UNIQUE_INDEX_SQL,
];

type MigrationDb = {
  getAllAsync<T>(query: string): Promise<T[]>;
  execAsync(query: string): Promise<void>;
};

type TableInfoRow = {
  name: string;
};

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
