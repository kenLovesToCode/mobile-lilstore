import { getDb, bootstrapDatabase } from "@/db/db";
import { ADMIN_TABLE } from "@/db/schema";

type CountRow = {
  admin_count: number;
};

export async function getAdminCount() {
  await bootstrapDatabase();
  const db = getDb();
  const row = await db.getFirstAsync<CountRow>(
    `SELECT COUNT(*) as admin_count FROM ${ADMIN_TABLE};`,
  );
  return row?.admin_count ?? 0;
}

export async function hasAnyAdmin() {
  const adminCount = await getAdminCount();
  return adminCount >= 1;
}
