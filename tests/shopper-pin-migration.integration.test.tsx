const mockDeriveShopperPinCredentialMaterial = jest.fn();
const mockDeriveShopperPinUniquenessKey = jest.fn();
const mockExtractShopperPinUniquenessKeyFromCredentialIfCompatible = jest.fn();

jest.mock("@/domain/services/password-derivation", () => ({
  deriveShopperPinCredentialMaterial: (...args: unknown[]) =>
    mockDeriveShopperPinCredentialMaterial(...args),
  deriveShopperPinUniquenessKey: (...args: unknown[]) =>
    mockDeriveShopperPinUniquenessKey(...args),
  extractShopperPinUniquenessKeyFromCredentialIfCompatible: (...args: unknown[]) =>
    mockExtractShopperPinUniquenessKeyFromCredentialIfCompatible(...args),
}));

import {
  SHOPPER_PIN_HASH_GLOBAL_UNIQUENESS_MIGRATION_STATEMENTS,
  backfillLegacyShopperPins,
  ensureShopperPinHashColumn,
  ensureShopperPinKeyColumn,
} from "@/db/migrations/0004_shopper_pin_hash_global_uniqueness";

describe("shopper pin hash migration compatibility", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("adds pin_hash column only when missing", async () => {
    const mockDb = {
      getAllAsync: jest
        .fn()
        .mockResolvedValueOnce([{ name: "id" }, { name: "owner_id" }]),
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 0 }),
    };

    await ensureShopperPinHashColumn(mockDb);

    expect(mockDb.execAsync).toHaveBeenCalledWith(
      "ALTER TABLE shopper ADD COLUMN pin_hash TEXT;",
    );
  });

  it("adds pin_key column only when missing", async () => {
    const mockDb = {
      getAllAsync: jest
        .fn()
        .mockResolvedValueOnce([{ name: "id" }, { name: "pin_hash" }]),
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 0 }),
    };

    await ensureShopperPinKeyColumn(mockDb);

    expect(mockDb.execAsync).toHaveBeenCalledWith(
      "ALTER TABLE shopper ADD COLUMN pin_key TEXT;",
    );
  });

  it("skips migration when columns already exist", async () => {
    const mockDb = {
      getAllAsync: jest
        .fn()
        .mockResolvedValueOnce([{ name: "id" }, { name: "pin_hash" }])
        .mockResolvedValueOnce([
          { name: "id" },
          { name: "pin_hash" },
          { name: "pin_key" },
        ]),
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 0 }),
    };

    await ensureShopperPinHashColumn(mockDb);
    await ensureShopperPinKeyColumn(mockDb);

    expect(mockDb.execAsync).not.toHaveBeenCalled();
  });

  it("backfills legacy plaintext pin rows and clears plaintext values", async () => {
    const mockDb = {
      getAllAsync: jest.fn().mockResolvedValueOnce([
        {
          id: 1,
          pin: "1234",
          pin_hash: null,
          pin_key: null,
        },
        {
          id: 2,
          pin: null,
          pin_hash:
            "scrypt$N=16384$r=8$p=1$dkLen=32$salt=00112233445566778899aabbccddeeff$hash=aabbccdd",
          pin_key: null,
        },
      ]),
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 0 }),
    };
    mockDeriveShopperPinCredentialMaterial.mockResolvedValue({
      storageValue:
        "scrypt$N=16384$r=8$p=1$dkLen=32$salt=00112233445566778899aabbccddeeff$hash=ffeeddcc",
    });
    mockDeriveShopperPinUniquenessKey.mockResolvedValue("ffeeddcc");
    mockExtractShopperPinUniquenessKeyFromCredentialIfCompatible.mockReturnValue(
      "aabbccdd",
    );

    await backfillLegacyShopperPins(
      mockDb,
      "00112233445566778899aabbccddeeff",
    );

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("SET pin_hash = ?, pin_key = ?, pin = NULL"),
      expect.stringContaining("$hash=ffeeddcc"),
      "ffeeddcc",
      1,
    );
    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("SET pin_key = ?"),
      "aabbccdd",
      2,
    );
  });

  it("clears incompatible legacy pin_key values when hash payload is not device-compatible", async () => {
    const mockDb = {
      getAllAsync: jest.fn().mockResolvedValueOnce([
        {
          id: 9,
          pin: null,
          pin_hash:
            "scrypt$N=16384$r=8$p=1$dkLen=32$salt=ffffffffffffffffffffffffffffffff$hash=0011",
          pin_key: "0011",
        },
      ]),
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 0 }),
    };
    mockExtractShopperPinUniquenessKeyFromCredentialIfCompatible.mockReturnValue(
      null,
    );

    await backfillLegacyShopperPins(
      mockDb,
      "00112233445566778899aabbccddeeff",
    );

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("SET pin_key = NULL"),
      9,
    );
  });

  it("clears duplicate pin_key rows so unique index creation can succeed", async () => {
    const mockDb = {
      getAllAsync: jest.fn().mockResolvedValueOnce([
        {
          id: 1,
          pin: "1234",
          pin_hash: null,
          pin_key: null,
        },
        {
          id: 2,
          pin: "1234",
          pin_hash: null,
          pin_key: null,
        },
      ]),
      execAsync: jest.fn().mockResolvedValue(undefined),
      runAsync: jest.fn().mockResolvedValue({ changes: 1, lastInsertRowId: 0 }),
    };
    mockDeriveShopperPinCredentialMaterial
      .mockResolvedValueOnce({
        storageValue:
          "scrypt$N=16384$r=8$p=1$dkLen=32$salt=00112233445566778899aabbccddeeff$hash=deadbeef",
      })
      .mockResolvedValueOnce({
        storageValue:
          "scrypt$N=16384$r=8$p=1$dkLen=32$salt=00112233445566778899aabbccddeeff$hash=deadbeef",
      });
    mockDeriveShopperPinUniquenessKey
      .mockResolvedValueOnce("deadbeef")
      .mockResolvedValueOnce("deadbeef");

    await backfillLegacyShopperPins(
      mockDb,
      "00112233445566778899aabbccddeeff",
    );

    expect(mockDb.runAsync).toHaveBeenCalledWith(
      expect.stringContaining("SET pin_hash = NULL, pin_key = NULL"),
      2,
    );
  });

  it("uses SQLite-compatible migration statements", () => {
    expect(SHOPPER_PIN_HASH_GLOBAL_UNIQUENESS_MIGRATION_STATEMENTS).toEqual(
      expect.arrayContaining([
        "DROP INDEX IF EXISTS idx_shopper_owner_pin_unique;",
        "DROP INDEX IF EXISTS idx_shopper_pin_hash_unique;",
        expect.stringContaining("idx_shopper_pin_key_unique"),
      ]),
    );
    expect(
      SHOPPER_PIN_HASH_GLOBAL_UNIQUENESS_MIGRATION_STATEMENTS.join("\n"),
    ).not.toContain("ADD COLUMN IF NOT EXISTS");
  });
});
