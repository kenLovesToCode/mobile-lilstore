"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CREATE_PAYMENT_OWNER_CREATED_AT_INDEX_SQL = exports.CREATE_PAYMENT_TABLE_SQL = exports.CREATE_PURCHASE_OWNER_CREATED_AT_INDEX_SQL = exports.CREATE_PURCHASE_TABLE_SQL = exports.CREATE_SHOPPING_LIST_ITEM_OWNER_CREATED_AT_INDEX_SQL = exports.CREATE_SHOPPING_LIST_ITEM_TABLE_SQL = exports.CREATE_SHOPPER_OWNER_ID_UNIQUE_INDEX_SQL = exports.CREATE_SHOPPER_PIN_KEY_UNIQUE_INDEX_SQL = exports.CREATE_SHOPPER_PIN_HASH_UNIQUE_INDEX_SQL = exports.CREATE_SHOPPER_OWNER_PIN_UNIQUE_INDEX_SQL = exports.CREATE_SHOPPER_OWNER_CREATED_AT_INDEX_SQL = exports.CREATE_SHOPPER_TABLE_SQL = exports.CREATE_PRODUCT_OWNER_ID_UNIQUE_INDEX_SQL = exports.CREATE_PRODUCT_OWNER_CREATED_AT_INDEX_SQL = exports.CREATE_PRODUCT_OWNER_BARCODE_UNIQUE_INDEX_SQL = exports.CREATE_PRODUCT_TABLE_SQL = exports.CREATE_STORE_OWNER_UPDATED_AT_INDEX_SQL = exports.CREATE_STORE_OWNER_NAME_UNIQUE_INDEX_SQL = exports.CREATE_STORE_OWNER_TABLE_SQL = exports.CREATE_APP_SECRET_TABLE_SQL = exports.CREATE_ADMIN_TABLE_SQL = exports.PAYMENT_TABLE = exports.PURCHASE_TABLE = exports.SHOPPING_LIST_ITEM_TABLE = exports.SHOPPER_TABLE = exports.PRODUCT_TABLE = exports.STORE_OWNER_TABLE = exports.APP_SECRET_TABLE = exports.ADMIN_TABLE = void 0;
exports.ADMIN_TABLE = "admin";
exports.APP_SECRET_TABLE = "app_secret";
exports.STORE_OWNER_TABLE = "store_owner";
exports.PRODUCT_TABLE = "product";
exports.SHOPPER_TABLE = "shopper";
exports.SHOPPING_LIST_ITEM_TABLE = "shopping_list_item";
exports.PURCHASE_TABLE = "purchase";
exports.PAYMENT_TABLE = "payment";
// Keep schema values centralized so Drizzle models can map directly in later stories.
exports.CREATE_ADMIN_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${exports.ADMIN_TABLE} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
`;
exports.CREATE_APP_SECRET_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${exports.APP_SECRET_TABLE} (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  updated_at_ms INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
`;
exports.CREATE_STORE_OWNER_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${exports.STORE_OWNER_TABLE} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL
);
`;
exports.CREATE_STORE_OWNER_NAME_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_store_owner_name_unique
ON ${exports.STORE_OWNER_TABLE}(lower(name));
`;
exports.CREATE_STORE_OWNER_UPDATED_AT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_store_owner_updated_at
ON ${exports.STORE_OWNER_TABLE}(updated_at_ms DESC, id DESC);
`;
exports.CREATE_PRODUCT_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${exports.PRODUCT_TABLE} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  barcode TEXT NOT NULL,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES ${exports.STORE_OWNER_TABLE}(id) ON DELETE CASCADE
);
`;
exports.CREATE_PRODUCT_OWNER_BARCODE_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_owner_barcode_unique
ON ${exports.PRODUCT_TABLE}(owner_id, lower(barcode));
`;
exports.CREATE_PRODUCT_OWNER_CREATED_AT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_product_owner_created_at
ON ${exports.PRODUCT_TABLE}(owner_id, created_at_ms DESC, id DESC);
`;
exports.CREATE_PRODUCT_OWNER_ID_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_product_owner_id_unique
ON ${exports.PRODUCT_TABLE}(owner_id, id);
`;
exports.CREATE_SHOPPER_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${exports.SHOPPER_TABLE} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  pin_hash TEXT,
  pin_key TEXT,
  -- Legacy column retained for backward-safe local migrations.
  pin TEXT,
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES ${exports.STORE_OWNER_TABLE}(id) ON DELETE CASCADE
);
`;
exports.CREATE_SHOPPER_OWNER_CREATED_AT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_shopper_owner_created_at
ON ${exports.SHOPPER_TABLE}(owner_id, created_at_ms DESC, id DESC);
`;
exports.CREATE_SHOPPER_OWNER_PIN_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopper_owner_pin_unique
ON ${exports.SHOPPER_TABLE}(owner_id, pin)
WHERE pin IS NOT NULL;
`;
exports.CREATE_SHOPPER_PIN_HASH_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopper_pin_hash_unique
ON ${exports.SHOPPER_TABLE}(pin_hash)
WHERE pin_hash IS NOT NULL;
`;
exports.CREATE_SHOPPER_PIN_KEY_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopper_pin_key_unique
ON ${exports.SHOPPER_TABLE}(pin_key)
WHERE pin_key IS NOT NULL;
`;
exports.CREATE_SHOPPER_OWNER_ID_UNIQUE_INDEX_SQL = `
CREATE UNIQUE INDEX IF NOT EXISTS idx_shopper_owner_id_unique
ON ${exports.SHOPPER_TABLE}(owner_id, id);
`;
exports.CREATE_SHOPPING_LIST_ITEM_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${exports.SHOPPING_LIST_ITEM_TABLE} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  product_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price_cents INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  created_at_ms INTEGER NOT NULL,
  updated_at_ms INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES ${exports.STORE_OWNER_TABLE}(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id, product_id) REFERENCES ${exports.PRODUCT_TABLE}(owner_id, id) ON DELETE RESTRICT
);
`;
exports.CREATE_SHOPPING_LIST_ITEM_OWNER_CREATED_AT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_shopping_list_item_owner_created_at
ON ${exports.SHOPPING_LIST_ITEM_TABLE}(owner_id, created_at_ms DESC, id DESC);
`;
exports.CREATE_PURCHASE_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${exports.PURCHASE_TABLE} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  shopper_id INTEGER NOT NULL,
  total_cents INTEGER NOT NULL CHECK (total_cents > 0),
  created_at_ms INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES ${exports.STORE_OWNER_TABLE}(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id, shopper_id) REFERENCES ${exports.SHOPPER_TABLE}(owner_id, id) ON DELETE RESTRICT
);
`;
exports.CREATE_PURCHASE_OWNER_CREATED_AT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_purchase_owner_created_at
ON ${exports.PURCHASE_TABLE}(owner_id, created_at_ms DESC, id DESC);
`;
exports.CREATE_PAYMENT_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS ${exports.PAYMENT_TABLE} (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL,
  shopper_id INTEGER NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  created_at_ms INTEGER NOT NULL,
  FOREIGN KEY (owner_id) REFERENCES ${exports.STORE_OWNER_TABLE}(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_id, shopper_id) REFERENCES ${exports.SHOPPER_TABLE}(owner_id, id) ON DELETE RESTRICT
);
`;
exports.CREATE_PAYMENT_OWNER_CREATED_AT_INDEX_SQL = `
CREATE INDEX IF NOT EXISTS idx_payment_owner_created_at
ON ${exports.PAYMENT_TABLE}(owner_id, created_at_ms DESC, id DESC);
`;
