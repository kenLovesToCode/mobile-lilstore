const mockGetRandomBytes = jest.fn();

jest.mock("expo-crypto", () => ({
  getRandomBytes: (...args: unknown[]) => mockGetRandomBytes(...args),
}));

import {
  DEFAULT_SCRYPT_PARAMS,
  derivePasswordCredentialMaterial,
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
