import { CREATE_PRODUCT_OWNER_ARCHIVED_CREATED_AT_INDEX_SQL, PRODUCT_TABLE } from "@/db/schema";

type MigrationDb = {
  getAllAsync<T>(query: string): Promise<T[]>;
  execAsync(query: string): Promise<void>;
};

type TableInfoRow = {
  name: string;
};

export const PRODUCT_ARCHIVE_LIFECYCLE_MIGRATION_STATEMENTS = [
  CREATE_PRODUCT_OWNER_ARCHIVED_CREATED_AT_INDEX_SQL,
];

export async function ensureProductArchiveColumn(db: MigrationDb) {
  const columns = await db.getAllAsync<TableInfoRow>(
    `PRAGMA table_info(${PRODUCT_TABLE});`,
  );
  const hasArchivedAt = columns.some((column) => column.name === "archived_at_ms");
  if (hasArchivedAt) {
    return;
  }

  await db.execAsync(`ALTER TABLE ${PRODUCT_TABLE} ADD COLUMN archived_at_ms INTEGER;`);
}
