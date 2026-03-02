import { getRandomBytes } from "expo-crypto";
import { scrypt } from "scrypt-js";

export const DEFAULT_SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  dkLen: 32,
  saltLen: 16,
} as const;

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
