export const ADMIN_TABLE = "admin";

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
