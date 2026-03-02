import {
  DEFAULT_SCRYPT_PARAMS,
  derivePasswordCredentialMaterial,
} from "@/domain/services/password-derivation";

const mockGetRandomBytes = jest.fn();

jest.mock("expo-crypto", () => ({
  getRandomBytes: (...args: unknown[]) => mockGetRandomBytes(...args),
}));

describe("password derivation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetRandomBytes.mockReturnValue(
      new Uint8Array([1, 35, 69, 103, 137, 171, 205, 239, 16, 50, 84, 118, 152, 186, 220, 254]),
    );
  });

  it("derives deterministic output for fixed password + salt", async () => {
    const fixedSalt = new Uint8Array([
      170, 187, 204, 221, 1, 2, 3, 4, 9, 8, 7, 6, 16, 32, 48, 64,
    ]);

    const first = await derivePasswordCredentialMaterial("Password123!", {
      salt: fixedSalt,
    });
    const second = await derivePasswordCredentialMaterial("Password123!", {
      salt: fixedSalt,
    });

    expect(first.hashHex).toBe(second.hashHex);
    expect(first.saltHex).toBe(second.saltHex);
    expect(first.params).toEqual({
      N: DEFAULT_SCRYPT_PARAMS.N,
      r: DEFAULT_SCRYPT_PARAMS.r,
      p: DEFAULT_SCRYPT_PARAMS.p,
      dkLen: DEFAULT_SCRYPT_PARAMS.dkLen,
    });
    expect(first.storageValue).not.toContain("Password123!");
    expect(first.storageValue).toContain(`salt=${first.saltHex}`);
    expect(first.storageValue).toContain(`hash=${first.hashHex}`);
  });

  it("produces different hashes for different salts", async () => {
    const password = "Password123!";

    const materialA = await derivePasswordCredentialMaterial(password, {
      salt: new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
    });
    const materialB = await derivePasswordCredentialMaterial(password, {
      salt: new Uint8Array([2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2]),
    });

    expect(materialA.hashHex).not.toBe(materialB.hashHex);
    expect(materialA.saltHex).not.toBe(materialB.saltHex);
  });

  it("uses expo-crypto random bytes when no salt is provided", async () => {
    const material = await derivePasswordCredentialMaterial("Password123!");

    expect(mockGetRandomBytes).toHaveBeenCalledWith(DEFAULT_SCRYPT_PARAMS.saltLen);
    expect(material.saltHex).toBe("0123456789abcdef1032547698badcfe");
  });

  it("fails safely when TextEncoder is unavailable", async () => {
    const originalTextEncoder = global.TextEncoder;
    try {
      // Simulate a runtime where TextEncoder is not installed.
      (global as { TextEncoder?: typeof TextEncoder }).TextEncoder = undefined;

      await expect(
        derivePasswordCredentialMaterial("Password123!", {
          salt: new Uint8Array([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]),
        }),
      ).rejects.toThrow("TextEncoder is unavailable in this runtime.");
    } finally {
      (global as { TextEncoder?: typeof TextEncoder }).TextEncoder =
        originalTextEncoder;
    }
  });
});
