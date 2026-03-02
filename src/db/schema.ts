export const ADMIN_TABLE = "admin";
export const STORE_OWNER_TABLE = "store_owner";

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
