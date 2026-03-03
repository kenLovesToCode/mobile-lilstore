import {
  SHOPPER_PIN_HASH_GLOBAL_UNIQUENESS_MIGRATION_STATEMENTS,
  ensureShopperPinHashColumn,
} from "@/db/migrations/0004_shopper_pin_hash_global_uniqueness";

describe("shopper pin hash migration compatibility", () => {
  it("adds pin_hash column only when missing", async () => {
    const mockDb = {
      getAllAsync: jest
        .fn()
        .mockResolvedValueOnce([{ name: "id" }, { name: "owner_id" }]),
      execAsync: jest.fn().mockResolvedValue(undefined),
    };

    await ensureShopperPinHashColumn(mockDb);

    expect(mockDb.execAsync).toHaveBeenCalledWith(
      "ALTER TABLE shopper ADD COLUMN pin_hash TEXT;",
    );
  });

  it("skips pin_hash column migration when column already exists", async () => {
    const mockDb = {
      getAllAsync: jest
        .fn()
        .mockResolvedValueOnce([{ name: "id" }, { name: "pin_hash" }]),
      execAsync: jest.fn().mockResolvedValue(undefined),
    };

    await ensureShopperPinHashColumn(mockDb);

    expect(mockDb.execAsync).not.toHaveBeenCalled();
  });

  it("uses SQLite-compatible migration statements", () => {
    expect(SHOPPER_PIN_HASH_GLOBAL_UNIQUENESS_MIGRATION_STATEMENTS).toEqual(
      expect.arrayContaining([
        "DROP INDEX IF EXISTS idx_shopper_owner_pin_unique;",
        expect.stringContaining("CREATE UNIQUE INDEX IF NOT EXISTS"),
      ]),
    );
    expect(
      SHOPPER_PIN_HASH_GLOBAL_UNIQUENESS_MIGRATION_STATEMENTS.join("\n"),
    ).not.toContain("ADD COLUMN IF NOT EXISTS");
  });
});
