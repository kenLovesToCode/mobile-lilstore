import {
  SHOPPING_LIST_BUNDLE_OFFER_MIGRATION_STATEMENTS,
  ensureShoppingListBundleColumns,
} from "@/db/migrations/0007_shopping_list_bundle_offer";

type TableInfoRow = {
  name: string;
};

type SecretRow = {
  value: string;
};

type MigrationDbStub = {
  getAllAsync: <T>(query: string) => Promise<T[]>;
  execAsync: (query: string) => Promise<void>;
};

describe("shopping-list bundle migration", () => {
  it("repairs inconsistent legacy bundle rows when repair marker is missing", async () => {
    const getAllAsync = jest.fn(async (query: string) => {
      if (query.includes("PRAGMA table_info")) {
        return [
          { name: "id" },
          { name: "bundle_qty" },
          { name: "bundle_price_cents" },
        ] as TableInfoRow[];
      }
      if (query.includes("FROM app_secret")) {
        return [] as SecretRow[];
      }
      return [] as never[];
    });
    const execAsync = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
    const db: MigrationDbStub = {
      getAllAsync: getAllAsync as MigrationDbStub["getAllAsync"],
      execAsync,
    };

    await ensureShoppingListBundleColumns(db);

    expect(db.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE shopping_list_item"),
    );
    expect(db.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("bundle_qty = NULL"),
    );
    expect(db.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("bundle_price_cents = NULL"),
    );
    expect(db.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("CREATE TABLE IF NOT EXISTS app_secret"),
    );
    expect(db.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("shopping_list_bundle_repair_v1_complete"),
    );
    expect(db.execAsync).not.toHaveBeenCalledWith(
      expect.stringContaining("ADD COLUMN bundle_qty"),
    );
  });

  it("adds missing bundle columns and runs repair when columns are introduced", async () => {
    const getAllAsync = jest.fn(async (query: string) => {
      if (query.includes("PRAGMA table_info")) {
        return [{ name: "id" }] as TableInfoRow[];
      }
      if (query.includes("FROM app_secret")) {
        return [{ value: "done" }] as SecretRow[];
      }
      return [] as never[];
    });
    const execAsync = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
    const db: MigrationDbStub = {
      getAllAsync: getAllAsync as MigrationDbStub["getAllAsync"],
      execAsync,
    };

    await ensureShoppingListBundleColumns(db);

    expect(db.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("ADD COLUMN bundle_qty"),
    );
    expect(db.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("ADD COLUMN bundle_price_cents"),
    );
    expect(db.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE shopping_list_item"),
    );
    expect(db.execAsync).toHaveBeenCalledWith(
      expect.stringContaining("shopping_list_bundle_repair_v1_complete"),
    );
  });

  it("skips repair on subsequent bootstraps when repair marker already exists", async () => {
    const getAllAsync = jest.fn(async (query: string) => {
      if (query.includes("PRAGMA table_info")) {
        return [
          { name: "id" },
          { name: "bundle_qty" },
          { name: "bundle_price_cents" },
        ] as TableInfoRow[];
      }
      if (query.includes("FROM app_secret")) {
        return [{ value: "done" }] as SecretRow[];
      }
      return [] as never[];
    });
    const execAsync = jest.fn<Promise<void>, [string]>().mockResolvedValue(undefined);
    const db: MigrationDbStub = {
      getAllAsync: getAllAsync as MigrationDbStub["getAllAsync"],
      execAsync,
    };

    await ensureShoppingListBundleColumns(db);

    expect(db.execAsync).not.toHaveBeenCalledWith(
      expect.stringContaining("UPDATE shopping_list_item"),
    );
    expect(db.execAsync).not.toHaveBeenCalledWith(
      expect.stringContaining("ADD COLUMN bundle_qty"),
    );
    expect(db.execAsync).not.toHaveBeenCalledWith(
      expect.stringContaining("shopping_list_bundle_repair_v1_complete"),
    );
  });

  it("exports migration SQL for both bundle pair triggers", () => {
    const statements = SHOPPING_LIST_BUNDLE_OFFER_MIGRATION_STATEMENTS.join("\n");

    expect(statements).toContain("trg_shopping_list_item_bundle_pair_insert");
    expect(statements).toContain("trg_shopping_list_item_bundle_pair_update");
  });
});
