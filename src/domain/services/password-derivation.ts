import { getRandomBytes } from "expo-crypto";
import { scrypt } from "scrypt-js";

export const DEFAULT_SCRYPT_PARAMS = {
  // Security baseline for admin credentials. Stored hashes remain forward/backward
  // verifiable because each payload embeds its own scrypt params.
  N: 16384,
  r: 8,
  p: 1,
  dkLen: 32,
  saltLen: 16,
} as const;

const MIN_SCRYPT_N = 64;
const MAX_SCRYPT_N = 32768;
const MAX_SCRYPT_R = 16;
const MAX_SCRYPT_P = 4;
const MAX_SCRYPT_DK_LEN = 64;

type ScryptParams = {
  N: number;
  r: number;
  p: number;
  dkLen: number;
};

export type DerivedPasswordCredentialMaterial = {
  algorithm: "scrypt";
  params: ScryptParams;
  saltHex: string;
  hashHex: string;
  storageValue: string;
};

export type DerivePasswordCredentialOptions = {
  salt?: Uint8Array;
  params?: Partial<ScryptParams>;
  saltLen?: number;
};

function encodePassword(password: string) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(password);
  }
  throw new Error("TextEncoder is unavailable in this runtime.");
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
    "",
  );
}

function hexToBytes(hex: string) {
  if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) {
    throw new Error("Invalid hex value in stored credential.");
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    const byteHex = hex.slice(index * 2, index * 2 + 2);
    bytes[index] = Number.parseInt(byteHex, 16);
  }
  return bytes;
}

function constantTimeBytesEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left[index] ^ right[index];
  }
  return diff === 0;
}

function isPowerOfTwo(value: number) {
  return value > 1 && Number.isInteger(value) && (value & (value - 1)) === 0;
}

function hasSupportedScryptParams(params: ScryptParams) {
  return (
    isPowerOfTwo(params.N) &&
    params.N >= MIN_SCRYPT_N &&
    params.N <= MAX_SCRYPT_N &&
    Number.isInteger(params.r) &&
    params.r > 0 &&
    params.r <= MAX_SCRYPT_R &&
    Number.isInteger(params.p) &&
    params.p > 0 &&
    params.p <= MAX_SCRYPT_P &&
    Number.isInteger(params.dkLen) &&
    params.dkLen > 0 &&
    params.dkLen <= MAX_SCRYPT_DK_LEN
  );
}

type ParsedStoredCredential = {
  algorithm: "scrypt";
  params: ScryptParams;
  salt: Uint8Array;
  hash: Uint8Array;
};

function parseStoredCredential(storageValue: string): ParsedStoredCredential {
  const chunks = storageValue.split("$");
  if (chunks.length !== 7 || chunks[0] !== "scrypt") {
    throw new Error("Invalid stored credential format.");
  }

  const entries = chunks.slice(1).map((chunk) => {
    const separatorIndex = chunk.indexOf("=");
    if (separatorIndex <= 0) {
      throw new Error("Invalid stored credential format.");
    }
    const key = chunk.slice(0, separatorIndex);
    const value = chunk.slice(separatorIndex + 1);
    return [key, value] as const;
  });

  const values = Object.fromEntries(entries);
  const params: ScryptParams = {
    N: Number.parseInt(values.N ?? "", 10),
    r: Number.parseInt(values.r ?? "", 10),
    p: Number.parseInt(values.p ?? "", 10),
    dkLen: Number.parseInt(values.dkLen ?? "", 10),
  };

  if (!hasSupportedScryptParams(params)) {
    throw new Error("Unsupported scrypt parameters.");
  }

  const salt = hexToBytes(values.salt ?? "");
  const hash = hexToBytes(values.hash ?? "");
  if (hash.length !== params.dkLen) {
    throw new Error("Stored credential hash length does not match parameters.");
  }

  return {
    algorithm: "scrypt",
    params,
    salt,
    hash,
  };
}

export function serializeDerivedPasswordCredential(
  value: Omit<DerivedPasswordCredentialMaterial, "storageValue">,
) {
  return [
    value.algorithm,
    `N=${value.params.N}`,
    `r=${value.params.r}`,
    `p=${value.params.p}`,
    `dkLen=${value.params.dkLen}`,
    `salt=${value.saltHex}`,
    `hash=${value.hashHex}`,
  ].join("$");
}

export async function derivePasswordCredentialMaterial(
  password: string,
  options?: DerivePasswordCredentialOptions,
): Promise<DerivedPasswordCredentialMaterial> {
  if (!password) {
    throw new Error("Password is required.");
  }

  const params: ScryptParams = {
    N: options?.params?.N ?? DEFAULT_SCRYPT_PARAMS.N,
    r: options?.params?.r ?? DEFAULT_SCRYPT_PARAMS.r,
    p: options?.params?.p ?? DEFAULT_SCRYPT_PARAMS.p,
    dkLen: options?.params?.dkLen ?? DEFAULT_SCRYPT_PARAMS.dkLen,
  };
  if (!hasSupportedScryptParams(params)) {
    throw new Error("Unsupported scrypt parameters.");
  }

  const salt =
    options?.salt ??
    getRandomBytes(options?.saltLen ?? DEFAULT_SCRYPT_PARAMS.saltLen);

  if (!salt.length) {
    throw new Error("Salt generation failed.");
  }

  const derivedBytes = await scrypt(
    encodePassword(password),
    salt,
    params.N,
    params.r,
    params.p,
    params.dkLen,
  );

  const materialWithoutStorageValue = {
    algorithm: "scrypt" as const,
    params,
    saltHex: bytesToHex(salt),
    hashHex: bytesToHex(derivedBytes),
  };

  return {
    ...materialWithoutStorageValue,
    storageValue: serializeDerivedPasswordCredential(materialWithoutStorageValue),
  };
}

export async function verifyPasswordCredentialMaterial(
  password: string,
  storageValue: string,
) {
  if (!password || !storageValue) {
    throw new Error("Password and stored credential are required.");
  }

  const parsed = parseStoredCredential(storageValue);
  const derivedBytes = await scrypt(
    encodePassword(password),
    parsed.salt,
    parsed.params.N,
    parsed.params.r,
    parsed.params.p,
    parsed.params.dkLen,
  );

  return constantTimeBytesEqual(parsed.hash, derivedBytes);
}
