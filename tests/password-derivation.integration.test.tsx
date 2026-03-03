const mockGetRandomBytes = jest.fn();

jest.mock("expo-crypto", () => ({
  getRandomBytes: (...args: unknown[]) => mockGetRandomBytes(...args),
}));

import {
  DEFAULT_SCRYPT_PARAMS,
  derivePasswordCredentialMaterial,
  deriveShopperPinCredentialMaterial,
  deriveShopperPinUniquenessKey,
  extractShopperPinUniquenessKeyFromCredentialIfCompatible,
  extractHashHexFromStoredCredential,
  verifyPasswordCredentialMaterial,
} from "@/domain/services/password-derivation";

beforeEach(() => {
  jest.clearAllMocks();
  mockGetRandomBytes.mockImplementation((size: number) => {
    return new Uint8Array(size).fill(7);
  });
});

describe("derivePasswordCredentialMaterial", () => {
  it("uses random salt generation by default and produces distinct derived material", async () => {
    mockGetRandomBytes
      .mockImplementationOnce((size: number) =>
        Uint8Array.from({ length: size }, (_, index) => index + 1),
      )
      .mockImplementationOnce((size: number) =>
        Uint8Array.from({ length: size }, (_, index) => index + 19),
      );

    const first = await derivePasswordCredentialMaterial("Password123!");
    const second = await derivePasswordCredentialMaterial("Password123!");

    expect(mockGetRandomBytes).toHaveBeenNthCalledWith(
      1,
      DEFAULT_SCRYPT_PARAMS.saltLen,
    );
    expect(mockGetRandomBytes).toHaveBeenNthCalledWith(
      2,
      DEFAULT_SCRYPT_PARAMS.saltLen,
    );
    expect(first.saltHex).not.toBe(second.saltHex);
    expect(first.hashHex).not.toBe(second.hashHex);
  });

  it("throws a safe runtime error when TextEncoder is unavailable", async () => {
    const globalWithEncoder = global as typeof globalThis & {
      TextEncoder?: typeof TextEncoder;
    };
    const originalTextEncoder = globalWithEncoder.TextEncoder;
    Reflect.set(globalWithEncoder, "TextEncoder", undefined);

    try {
      await expect(
        derivePasswordCredentialMaterial("Password123!"),
      ).rejects.toThrow("TextEncoder is unavailable in this runtime.");
    } finally {
      Reflect.set(globalWithEncoder, "TextEncoder", originalTextEncoder);
    }
  });
});

describe("verifyPasswordCredentialMaterial", () => {
  it("returns true for a matching password and false for a non-matching password", async () => {
    const material = await derivePasswordCredentialMaterial("Password123!", {
      salt: new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]),
      params: {
        N: 1024,
        r: 8,
        p: 1,
        dkLen: 32,
      },
    });

    await expect(
      verifyPasswordCredentialMaterial("Password123!", material.storageValue),
    ).resolves.toBe(true);
    await expect(
      verifyPasswordCredentialMaterial("WrongPassword!", material.storageValue),
    ).resolves.toBe(false);
  });

  it("throws for an invalid stored credential format", async () => {
    await expect(
      verifyPasswordCredentialMaterial("Password123!", "invalid-format"),
    ).rejects.toThrow("Invalid stored credential format.");
  });

  it("throws for unsupported scrypt parameters", async () => {
    await expect(
      verifyPasswordCredentialMaterial(
        "Password123!",
        "scrypt$N=1000$r=8$p=1$dkLen=32$salt=00112233$hash=44556677",
      ),
    ).rejects.toThrow("Unsupported scrypt parameters.");
  });

  it("throws for oversized scrypt parameters to prevent expensive verification payloads", async () => {
    await expect(
      verifyPasswordCredentialMaterial(
        "Password123!",
        "scrypt$N=65536$r=8$p=1$dkLen=32$salt=00112233445566778899aabbccddeeff$hash=00112233445566778899aabbccddeeff00112233445566778899aabbccddeeff",
      ),
    ).rejects.toThrow("Unsupported scrypt parameters.");
  });
});

describe("deriveShopperPinCredentialMaterial", () => {
  it("derives stable shopper PIN credentials for a device-scoped salt", async () => {
    const deviceSaltHex = "00112233445566778899aabbccddeeff";

    const first = await deriveShopperPinCredentialMaterial("1234", deviceSaltHex);
    const second = await deriveShopperPinCredentialMaterial("1234", deviceSaltHex);

    expect(first.storageValue).toBe(second.storageValue);
  });

  it("throws when the device-scoped salt is malformed", async () => {
    await expect(
      deriveShopperPinCredentialMaterial("1234", "not-hex"),
    ).rejects.toThrow("Invalid hex value in stored credential.");
  });
});

describe("deriveShopperPinUniquenessKey", () => {
  it("derives a stable key for the same pin + device salt", async () => {
    const deviceSaltHex = "00112233445566778899aabbccddeeff";

    const first = await deriveShopperPinUniquenessKey("1234", deviceSaltHex);
    const second = await deriveShopperPinUniquenessKey("1234", deviceSaltHex);

    expect(first).toBe(second);
  });

  it("produces different keys for different pins on the same device salt", async () => {
    const deviceSaltHex = "00112233445566778899aabbccddeeff";

    const first = await deriveShopperPinUniquenessKey("1234", deviceSaltHex);
    const second = await deriveShopperPinUniquenessKey("1235", deviceSaltHex);

    expect(first).not.toBe(second);
  });
});

describe("extractHashHexFromStoredCredential", () => {
  it("extracts the hash segment from a serialized credential", () => {
    const hash = extractHashHexFromStoredCredential(
      "scrypt$N=16384$r=8$p=1$dkLen=32$salt=00112233445566778899aabbccddeeff$hash=aabbccdd",
    );

    expect(hash).toBe("aabbccdd");
  });

  it("throws when stored credential has no hash segment", () => {
    expect(() =>
      extractHashHexFromStoredCredential(
        "scrypt$N=16384$r=8$p=1$dkLen=32$salt=00112233445566778899aabbccddeeff",
      ),
    ).toThrow("Invalid stored credential format.");
  });
});

describe("extractShopperPinUniquenessKeyFromCredentialIfCompatible", () => {
  it("returns hash when payload params and salt match device uniqueness strategy", () => {
    const hashHex = "aabbccdd".repeat(8);
    const key = extractShopperPinUniquenessKeyFromCredentialIfCompatible(
      `scrypt$N=16384$r=8$p=1$dkLen=32$salt=00112233445566778899aabbccddeeff$hash=${hashHex}`,
      "00112233445566778899aabbccddeeff",
    );

    expect(key).toBe(hashHex);
  });

  it("returns null when payload salt differs from device salt", () => {
    const hashHex = "aabbccdd".repeat(8);
    const key = extractShopperPinUniquenessKeyFromCredentialIfCompatible(
      `scrypt$N=16384$r=8$p=1$dkLen=32$salt=ffffffffffffffffffffffffffffffff$hash=${hashHex}`,
      "00112233445566778899aabbccddeeff",
    );

    expect(key).toBeNull();
  });
});
