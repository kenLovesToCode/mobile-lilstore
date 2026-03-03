import {
  APP_SECRET_TABLE,
  CREATE_APP_SECRET_TABLE_SQL,
  CREATE_SHOPPING_LIST_ASSORTED_ITEM_OWNER_CREATED_AT_INDEX_SQL,
  CREATE_SHOPPING_LIST_ASSORTED_ITEM_OWNER_ID_UNIQUE_INDEX_SQL,
  CREATE_SHOPPING_LIST_ASSORTED_ITEM_TABLE_SQL,
  CREATE_SHOPPING_LIST_ASSORTED_MEMBER_OWNER_ASST_INDEX_SQL,
  CREATE_SHOPPING_LIST_ASSORTED_MEMBER_OWNER_ASST_PRODUCT_UNIQUE_INDEX_SQL,
  CREATE_SHOPPING_LIST_ASSORTED_MEMBER_OWNER_PRODUCT_INDEX_SQL,
  CREATE_SHOPPING_LIST_ASSORTED_MEMBER_TABLE_SQL,
  SHOPPING_LIST_ASSORTED_ITEM_TABLE,
  SHOPPING_LIST_ASSORTED_MEMBER_TABLE,
} from "@/db/schema";

type MigrationDb = {
  getAllAsync<T>(query: string): Promise<T[]>;
  execAsync(query: string): Promise<void>;
};

const ASSORTED_REPAIR_MIGRATION_KEY = "shopping_list_assorted_repair_v1_complete";

const REPAIR_INVALID_ASSORTED_PRICING_SQL = `
UPDATE ${SHOPPING_LIST_ASSORTED_ITEM_TABLE}
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

const REPAIR_DUPLICATE_MEMBERS_SQL = `
DELETE FROM ${SHOPPING_LIST_ASSORTED_MEMBER_TABLE}
WHERE id IN (
  SELECT dup.id
  FROM ${SHOPPING_LIST_ASSORTED_MEMBER_TABLE} AS dup
  JOIN ${SHOPPING_LIST_ASSORTED_MEMBER_TABLE} AS keep
    ON keep.owner_id = dup.owner_id
   AND keep.assorted_item_id = dup.assorted_item_id
   AND keep.product_id = dup.product_id
   AND keep.id < dup.id
);
`;

const REPAIR_ORPHANED_MEMBERS_SQL = `
DELETE FROM ${SHOPPING_LIST_ASSORTED_MEMBER_TABLE}
WHERE id IN (
  SELECT member.id
  FROM ${SHOPPING_LIST_ASSORTED_MEMBER_TABLE} AS member
  LEFT JOIN ${SHOPPING_LIST_ASSORTED_ITEM_TABLE} AS item
    ON item.id = member.assorted_item_id
   AND item.owner_id = member.owner_id
  LEFT JOIN product AS product
    ON product.id = member.product_id
   AND product.owner_id = member.owner_id
  WHERE item.id IS NULL OR product.id IS NULL
);
`;

const REPAIR_INVALID_GROUP_SIZE_SQL = `
DELETE FROM ${SHOPPING_LIST_ASSORTED_ITEM_TABLE}
WHERE id IN (
  SELECT item.id
  FROM ${SHOPPING_LIST_ASSORTED_ITEM_TABLE} AS item
  LEFT JOIN ${SHOPPING_LIST_ASSORTED_MEMBER_TABLE} AS member
    ON member.assorted_item_id = item.id
   AND member.owner_id = item.owner_id
  GROUP BY item.id, item.owner_id
  HAVING COUNT(member.id) < 2
);
`;

export const SHOPPING_LIST_ASSORTED_GROUP_MIGRATION_STATEMENTS = [
  CREATE_SHOPPING_LIST_ASSORTED_ITEM_OWNER_CREATED_AT_INDEX_SQL,
  CREATE_SHOPPING_LIST_ASSORTED_MEMBER_OWNER_ASST_PRODUCT_UNIQUE_INDEX_SQL,
  CREATE_SHOPPING_LIST_ASSORTED_MEMBER_OWNER_ASST_INDEX_SQL,
  CREATE_SHOPPING_LIST_ASSORTED_MEMBER_OWNER_PRODUCT_INDEX_SQL,
];

export async function ensureShoppingListAssortedTables(db: MigrationDb) {
  await db.execAsync(CREATE_APP_SECRET_TABLE_SQL);
  await db.execAsync(CREATE_SHOPPING_LIST_ASSORTED_ITEM_TABLE_SQL);
  await db.execAsync(CREATE_SHOPPING_LIST_ASSORTED_ITEM_OWNER_ID_UNIQUE_INDEX_SQL);
  await db.execAsync(CREATE_SHOPPING_LIST_ASSORTED_MEMBER_TABLE_SQL);

  const repairMarkerRows = await db.getAllAsync<{ value: string }>(
    `SELECT value
     FROM ${APP_SECRET_TABLE}
     WHERE key = '${ASSORTED_REPAIR_MIGRATION_KEY}'
     LIMIT 1;`,
  );
  const hasRepairMarker = repairMarkerRows.length > 0;
  if (hasRepairMarker) {
    return;
  }

  await db.execAsync(REPAIR_INVALID_ASSORTED_PRICING_SQL);
  await db.execAsync(REPAIR_DUPLICATE_MEMBERS_SQL);
  await db.execAsync(REPAIR_ORPHANED_MEMBERS_SQL);
  await db.execAsync(REPAIR_INVALID_GROUP_SIZE_SQL);

  const nowMs = Date.now();
  await db.execAsync(
    `INSERT INTO ${APP_SECRET_TABLE}(key, value, created_at_ms, updated_at_ms)
     VALUES ('${ASSORTED_REPAIR_MIGRATION_KEY}', 'done', ${nowMs}, ${nowMs})
     ON CONFLICT(key) DO UPDATE
     SET value = 'done',
         updated_at_ms = ${nowMs};`,
  );
}
