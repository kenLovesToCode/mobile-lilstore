import {
  SHOPPING_LIST_ASSORTED_GROUP_MIGRATION_STATEMENTS,
  ensureShoppingListAssortedTables,
} from "@/db/migrations/0008_shopping_list_assorted_groups";

type SecretRow = {
  value: string;
};

type MigrationDbStub = {
  getAllAsync: <T>(query: string) => Promise<T[]>;
  execAsync: (query: string) => Promise<void>;
};

describe("shopping-list assorted-group migration", () => {
  it("creates assorted tables and runs one-time repair when marker is missing", async () => {
    const getAllAsync = jest.fn(async (query: string) => {
      if (query.includes("shopping_list_assorted_repair_v1_complete")) {
        return [] as SecretRow[];
      }
      return [] as never[];
    });
    const execAsync = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
    const db: MigrationDbStub = {
      getAllAsync: getAllAsync as MigrationDbStub["getAllAsync"],
      execAsync,
    };

    await ensureShoppingListAssortedTables(db);

    expect(db.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS app_secret"),
    );
    expect(db.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS shopping_list_assorted_item"),
    );
    expect(db.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS shopping_list_assorted_member"),
    );
    expect(db.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM shopping_list_assorted_member"),
    );
    expect(db.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("shopping_list_assorted_repair_v1_complete"),
    );
  });

  it("skips repair when migration marker already exists", async () => {
    const getAllAsync = jest.fn(async (query: string) => {
      if (query.includes("shopping_list_assorted_repair_v1_complete")) {
        return [{ value: "done" }] as SecretRow[];
      }
      return [] as never[];
    });
    const execAsync = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
    const db: MigrationDbStub = {
      getAllAsync: getAllAsync as MigrationDbStub["getAllAsync"],
      execAsync,
    };

    await ensureShoppingListAssortedTables(db);

    expect(db.execAsync).not.toHaveBeenCalledWith(
      expect.stringContaining("DELETE FROM shopping_list_assorted_member"),
    );
    expect(db.execAsync).not.toHaveBeenCalledWith(
      expect.stringContaining("shopping_list_assorted_repair_v1_complete"),
    );
  });

  it("exports SQL statements for assorted indexes", () => {
    const statements = SHOPPING_LIST_ASSORTED_GROUP_MIGRATION_STATEMENTS.join("\n");

    expect(statements).toContain("idx_shopping_list_assorted_item_owner_created_at");
    expect(statements).toContain("idx_shopping_list_assorted_member_owner_assorted_product_unique");
    expect(statements).toContain("idx_shopping_list_assorted_member_owner_product");
  });
});
