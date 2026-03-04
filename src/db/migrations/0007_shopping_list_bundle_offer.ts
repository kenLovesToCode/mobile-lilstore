import {
  APP_SECRET_TABLE,
  CREATE_APP_SECRET_TABLE_SQL,
  SHOPPING_LIST_ITEM_TABLE,
} from "@/db/schema";

type MigrationDb = {
  getAllAsync<T>(query: string): Promise<T[]>;
  execAsync(query: string): Promise<void>;
};

type TableInfoRow = {
  name: string;
};

const BUNDLE_PAIR_INSERT_TRIGGER_NAME =
  "trg_shopping_list_item_bundle_pair_insert";
const BUNDLE_PAIR_UPDATE_TRIGGER_NAME =
  "trg_shopping_list_item_bundle_pair_update";
const BUNDLE_REPAIR_MIGRATION_KEY = "shopping_list_bundle_repair_v1_complete";

const CREATE_BUNDLE_PAIR_INSERT_TRIGGER_SQL = `
CREATE TRIGGER IF NOT EXISTS ${BUNDLE_PAIR_INSERT_TRIGGER_NAME}
BEFORE INSERT ON ${SHOPPING_LIST_ITEM_TABLE}
FOR EACH ROW
WHEN (
  (NEW.bundle_qty IS NULL AND NEW.bundle_price_cents IS NOT NULL) OR
  (NEW.bundle_qty IS NOT NULL AND NEW.bundle_price_cents IS NULL)
)
BEGIN
  SELECT RAISE(ABORT, 'shopping_list_item bundle fields must be both null or both set');
END;
`;

const CREATE_BUNDLE_PAIR_UPDATE_TRIGGER_SQL = `
CREATE TRIGGER IF NOT EXISTS ${BUNDLE_PAIR_UPDATE_TRIGGER_NAME}
BEFORE UPDATE OF bundle_qty, bundle_price_cents ON ${SHOPPING_LIST_ITEM_TABLE}
FOR EACH ROW
WHEN (
  (NEW.bundle_qty IS NULL AND NEW.bundle_price_cents IS NOT NULL) OR
  (NEW.bundle_qty IS NOT NULL AND NEW.bundle_price_cents IS NULL)
)
BEGIN
  SELECT RAISE(ABORT, 'shopping_list_item bundle fields must be both null or both set');
END;
`;

const REPAIR_LEGACY_BUNDLE_INTEGRITY_SQL = `
UPDATE ${SHOPPING_LIST_ITEM_TABLE}
SET bundle_qty = NULL,
    bundle_price_cents = NULL
WHERE
  (bundle_qty IS NULL AND bundle_price_cents IS NOT NULL) OR
  (bundle_qty IS NOT NULL AND bundle_price_cents IS NULL) OR
  (
    bundle_qty IS NOT NULL AND
    (typeof(bundle_qty) != 'integer' OR bundle_qty < 2)
  ) OR
  (
    bundle_price_cents IS NOT NULL AND
    (typeof(bundle_price_cents) != 'integer' OR bundle_price_cents <= 0)
  );
`;

export const SHOPPING_LIST_BUNDLE_OFFER_MIGRATION_STATEMENTS = [
  CREATE_BUNDLE_PAIR_INSERT_TRIGGER_SQL,
  CREATE_BUNDLE_PAIR_UPDATE_TRIGGER_SQL,
];

export async function ensureShoppingListBundleColumns(db: MigrationDb) {
  await db.execAsync(CREATE_APP_SECRET_TABLE_SQL);

  const columns = await db.getAllAsync<TableInfoRow>(
    `PRAGMA table_info(${SHOPPING_LIST_ITEM_TABLE});`,
  );
  const hasBundleQtyColumn = columns.some((column) => column.name === "bundle_qty");
  let addedColumn = false;
  if (!hasBundleQtyColumn) {
    addedColumn = true;
    await db.execAsync(
      `ALTER TABLE ${SHOPPING_LIST_ITEM_TABLE}
       ADD COLUMN bundle_qty INTEGER
       CHECK (bundle_qty IS NULL OR (typeof(bundle_qty) = 'integer' AND bundle_qty >= 2));`,
    );
  }

  const hasBundlePriceColumn = columns.some(
    (column) => column.name === "bundle_price_cents",
  );
  if (!hasBundlePriceColumn) {
    addedColumn = true;
    await db.execAsync(
      `ALTER TABLE ${SHOPPING_LIST_ITEM_TABLE}
       ADD COLUMN bundle_price_cents INTEGER
       CHECK (bundle_price_cents IS NULL OR (typeof(bundle_price_cents) = 'integer' AND bundle_price_cents > 0));`,
    );
  }

  const repairMarkerRows = await db.getAllAsync<{ value: string }>(
    `SELECT value
     FROM ${APP_SECRET_TABLE}
     WHERE key = '${BUNDLE_REPAIR_MIGRATION_KEY}'
     LIMIT 1;`,
  );
  const hasRepairMarker = repairMarkerRows.length > 0;

  // Run repair once per DB, and re-run if columns are newly introduced on a later upgrade.
  if (addedColumn || !hasRepairMarker) {
    await db.execAsync(REPAIR_LEGACY_BUNDLE_INTEGRITY_SQL);
    await db.execAsync(
      `UPDATE ${APP_SECRET_TABLE}
       SET value = 'done'
       WHERE key = '${BUNDLE_REPAIR_MIGRATION_KEY}';`,
    );
    await db.execAsync(
      `INSERT INTO ${APP_SECRET_TABLE}(key, value)
       SELECT '${BUNDLE_REPAIR_MIGRATION_KEY}', 'done'
       WHERE NOT EXISTS (
         SELECT 1
         FROM ${APP_SECRET_TABLE}
         WHERE key = '${BUNDLE_REPAIR_MIGRATION_KEY}'
       );`,
    );
  }
}
