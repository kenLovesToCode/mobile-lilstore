export const ADMIN_TABLE = "admin";
export const APP_SECRET_TABLE = "app_secret";
export const STORE_OWNER_TABLE = "store_owner";
export const PRODUCT_TABLE = "product";
export const SHOPPER_TABLE = "shopper";
export const SHOPPING_LIST_ITEM_TABLE = "shopping_list_item";
export const SHOPPING_LIST_ASSORTED_ITEM_TABLE = "shopping_list_assorted_item";
export const SHOPPING_LIST_ASSORTED_MEMBER_TABLE = "shopping_list_assorted_member";
export const PURCHASE_TABLE = "purchase";
export const PAYMENT_TABLE = "payment";

// Keep schema values centralized so Drizzle models can map directly in later stories.
export const CREATE_ADMIN_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${ADMIN_TABLE} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
`;

export const CREATE_APP_SECRET_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${APP_SECRET_TABLE} (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export const CREATE_STORE_OWNER_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${STORE_OWNER_TABLE} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
`;

export const CREATE_STORE_OWNER_NAME_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_owner_name_unique
ON ${STORE_OWNER_TABLE}(lower(name));
`;

export const CREATE_STORE_OWNER_UPDATED_AT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_store_owner_updated_at
ON ${STORE_OWNER_TABLE}(updated_at_ms DESC, id DESC);
`;

export const CREATE_PRODUCT_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${PRODUCT_TABLE} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  barcode TEXT NOT NULL,
  archived_at_ms INTEGER,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES ${STORE_OWNER_TABLE}(id) ON DELETE CASCADE
);
`;

export const CREATE_PRODUCT_OWNER_BARCODE_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_owner_barcode_unique
ON ${PRODUCT_TABLE}(owner_id, lower(barcode));
`;

export const CREATE_PRODUCT_OWNER_CREATED_AT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_product_owner_created_at
ON ${PRODUCT_TABLE}(owner_id, created_at_ms DESC, id DESC);
`;

export const CREATE_PRODUCT_OWNER_ARCHIVED_CREATED_AT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_product_owner_archived_created_at
ON ${PRODUCT_TABLE}(owner_id, archived_at_ms, created_at_ms DESC, id DESC);
`;

export const CREATE_PRODUCT_OWNER_ID_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_owner_id_unique
ON ${PRODUCT_TABLE}(owner_id, id);
`;

export const CREATE_SHOPPER_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${SHOPPER_TABLE} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  pin_hash TEXT,
  pin_key TEXT,
  -- Legacy column retained for backward-safe local migrations.
  pin TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES ${STORE_OWNER_TABLE}(id) ON DELETE CASCADE
);
`;

export const CREATE_SHOPPER_OWNER_CREATED_AT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_shopper_owner_created_at
ON ${SHOPPER_TABLE}(owner_id, created_at_ms DESC, id DESC);
`;

export const CREATE_SHOPPER_OWNER_PIN_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopper_owner_pin_unique
ON ${SHOPPER_TABLE}(owner_id, pin)
WHERE pin IS NOT NULL;
`;

export const CREATE_SHOPPER_PIN_HASH_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopper_pin_hash_unique
ON ${SHOPPER_TABLE}(pin_hash)
WHERE pin_hash IS NOT NULL;
`;

export const CREATE_SHOPPER_PIN_KEY_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopper_pin_key_unique
ON ${SHOPPER_TABLE}(pin_key)
WHERE pin_key IS NOT NULL;
`;

export const CREATE_SHOPPER_OWNER_ID_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopper_owner_id_unique
ON ${SHOPPER_TABLE}(owner_id, id);
`;

export const CREATE_SHOPPING_LIST_ITEM_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${SHOPPING_LIST_ITEM_TABLE} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  bundle_qty INTEGER CHECK (bundle_qty IS NULL OR (typeof(bundle_qty) = 'integer' AND bundle_qty >= 2)),
  bundle_price_cents INTEGER CHECK (bundle_price_cents IS NULL OR (typeof(bundle_price_cents) = 'integer' AND bundle_price_cents > 0)),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  CHECK (
    (bundle_qty IS NULL AND bundle_price_cents IS NULL) OR
    (bundle_qty IS NOT NULL AND bundle_price_cents IS NOT NULL)
  ),
  FOREIGN KEY (owner_id) REFERENCES ${STORE_OWNER_TABLE}(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id, product_id) REFERENCES ${PRODUCT_TABLE}(owner_id, id) ON DELETE RESTRICT
);
`;

export const CREATE_SHOPPING_LIST_ITEM_OWNER_CREATED_AT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_shopping_list_item_owner_created_at
ON ${SHOPPING_LIST_ITEM_TABLE}(owner_id, created_at_ms DESC, id DESC);
`;

export const CREATE_SHOPPING_LIST_ITEM_OWNER_PRODUCT_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_list_item_owner_product_unique
ON ${SHOPPING_LIST_ITEM_TABLE}(owner_id, product_id);
`;

export const CREATE_SHOPPING_LIST_ASSORTED_ITEM_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${SHOPPING_LIST_ASSORTED_ITEM_TABLE} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) > 0),
  quantity INTEGER NOT NULL CHECK (typeof(quantity) = 'integer' AND quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (typeof(unit_price_cents) = 'integer' AND unit_price_cents >= 0),
  bundle_qty INTEGER CHECK (bundle_qty IS NULL OR (typeof(bundle_qty) = 'integer' AND bundle_qty >= 2)),
  bundle_price_cents INTEGER CHECK (bundle_price_cents IS NULL OR (typeof(bundle_price_cents) = 'integer' AND bundle_price_cents > 0)),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  CHECK (
    (bundle_qty IS NULL AND bundle_price_cents IS NULL) OR
    (bundle_qty IS NOT NULL AND bundle_price_cents IS NOT NULL)
  ),
  FOREIGN KEY (owner_id) REFERENCES ${STORE_OWNER_TABLE}(id) ON DELETE CASCADE
);
`;

export const CREATE_SHOPPING_LIST_ASSORTED_ITEM_OWNER_ID_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_list_assorted_item_owner_id_unique
ON ${SHOPPING_LIST_ASSORTED_ITEM_TABLE}(owner_id, id);
`;

export const CREATE_SHOPPING_LIST_ASSORTED_ITEM_OWNER_CREATED_AT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_shopping_list_assorted_item_owner_created_at
ON ${SHOPPING_LIST_ASSORTED_ITEM_TABLE}(owner_id, created_at_ms DESC, id DESC);
`;

export const CREATE_SHOPPING_LIST_ASSORTED_MEMBER_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${SHOPPING_LIST_ASSORTED_MEMBER_TABLE} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  assorted_item_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  created_at_ms INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES ${STORE_OWNER_TABLE}(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id, assorted_item_id)
    REFERENCES ${SHOPPING_LIST_ASSORTED_ITEM_TABLE}(owner_id, id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id, product_id) REFERENCES ${PRODUCT_TABLE}(owner_id, id) ON DELETE RESTRICT
);
`;

export const CREATE_SHOPPING_LIST_ASSORTED_MEMBER_OWNER_ASST_PRODUCT_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopping_list_assorted_member_owner_assorted_product_unique
ON ${SHOPPING_LIST_ASSORTED_MEMBER_TABLE}(owner_id, assorted_item_id, product_id);
`;

export const CREATE_SHOPPING_LIST_ASSORTED_MEMBER_OWNER_ASST_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_shopping_list_assorted_member_owner_assorted
ON ${SHOPPING_LIST_ASSORTED_MEMBER_TABLE}(owner_id, assorted_item_id, id DESC);
`;

export const CREATE_SHOPPING_LIST_ASSORTED_MEMBER_OWNER_PRODUCT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_shopping_list_assorted_member_owner_product
ON ${SHOPPING_LIST_ASSORTED_MEMBER_TABLE}(owner_id, product_id);
`;

export const CREATE_PURCHASE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${PURCHASE_TABLE} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  shopper_id INTEGER NOT NULL,
  total_cents INTEGER NOT NULL CHECK (total_cents > 0),
  created_at_ms INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES ${STORE_OWNER_TABLE}(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id, shopper_id) REFERENCES ${SHOPPER_TABLE}(owner_id, id) ON DELETE RESTRICT
);
`;

export const CREATE_PURCHASE_OWNER_CREATED_AT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_purchase_owner_created_at
ON ${PURCHASE_TABLE}(owner_id, created_at_ms DESC, id DESC);
`;

export const CREATE_PAYMENT_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${PAYMENT_TABLE} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  shopper_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  created_at_ms INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES ${STORE_OWNER_TABLE}(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id, shopper_id) REFERENCES ${SHOPPER_TABLE}(owner_id, id) ON DELETE RESTRICT
);
`;

export const CREATE_PAYMENT_OWNER_CREATED_AT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_payment_owner_created_at
ON ${PAYMENT_TABLE}(owner_id, created_at_ms DESC, id DESC);
`;
