"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHOPPER_PIN_UNIQUENESS_SCRYPT_PARAMS = exports.DEFAULT_SCRYPT_PARAMS = void 0;
exports.serializeDerivedPasswordCredential = serializeDerivedPasswordCredential;
exports.derivePasswordCredentialMaterial = derivePasswordCredentialMaterial;
exports.verifyPasswordCredentialMaterial = verifyPasswordCredentialMaterial;
exports.deriveShopperPinCredentialMaterial = deriveShopperPinCredentialMaterial;
exports.deriveShopperPinUniquenessKey = deriveShopperPinUniquenessKey;
exports.extractHashHexFromStoredCredential = extractHashHexFromStoredCredential;
const expo_crypto_1 = require("expo-crypto");
const scrypt_js_1 = require("scrypt-js");
exports.DEFAULT_SCRYPT_PARAMS = {
    // Security baseline for admin credentials. Stored hashes remain forward/backward
    // verifiable because each payload embeds its own scrypt params.
    N: 16384,
    r: 8,
    p: 1,
    dkLen: 32,
    saltLen: 16,
};
exports.SHOPPER_PIN_UNIQUENESS_SCRYPT_PARAMS = {
    // Keep shopper uniqueness derivation params explicit and stable so uniqueness
    // does not drift if default credential KDF params are tuned later.
    N: 16384,
    r: 8,
    p: 1,
    dkLen: 32,
};
const MIN_SCRYPT_N = 64;
const MAX_SCRYPT_N = 32768;
const MAX_SCRYPT_R = 16;
const MAX_SCRYPT_P = 4;
const MAX_SCRYPT_DK_LEN = 64;
function encodePassword(password) {
    if (typeof TextEncoder !== "undefined") {
        return new TextEncoder().encode(password);
    }
    throw new Error("TextEncoder is unavailable in this runtime.");
}
function bytesToHex(bytes) {
    return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}
function hexToBytes(hex) {
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
function constantTimeBytesEqual(left, right) {
    if (left.length !== right.length) {
        return false;
    }
    let diff = 0;
    for (let index = 0; index < left.length; index += 1) {
        diff |= left[index] ^ right[index];
    }
    return diff === 0;
}
function isPowerOfTwo(value) {
    return value > 1 && Number.isInteger(value) && (value & (value - 1)) === 0;
}
function hasSupportedScryptParams(params) {
    return (isPowerOfTwo(params.N) &&
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
        params.dkLen <= MAX_SCRYPT_DK_LEN);
}
function parseStoredCredential(storageValue) {
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
        return [key, value];
    });
    const values = Object.fromEntries(entries);
    const params = {
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
function serializeDerivedPasswordCredential(value) {
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
async function derivePasswordCredentialMaterial(password, options) {
    if (!password) {
        throw new Error("Password is required.");
    }
    const params = {
        N: options?.params?.N ?? exports.DEFAULT_SCRYPT_PARAMS.N,
        r: options?.params?.r ?? exports.DEFAULT_SCRYPT_PARAMS.r,
        p: options?.params?.p ?? exports.DEFAULT_SCRYPT_PARAMS.p,
        dkLen: options?.params?.dkLen ?? exports.DEFAULT_SCRYPT_PARAMS.dkLen,
    };
    if (!hasSupportedScryptParams(params)) {
        throw new Error("Unsupported scrypt parameters.");
    }
    const salt = options?.salt ??
        (0, expo_crypto_1.getRandomBytes)(options?.saltLen ?? exports.DEFAULT_SCRYPT_PARAMS.saltLen);
    if (!salt.length) {
        throw new Error("Salt generation failed.");
    }
    const derivedBytes = await (0, scrypt_js_1.scrypt)(encodePassword(password), salt, params.N, params.r, params.p, params.dkLen);
    const materialWithoutStorageValue = {
        algorithm: "scrypt",
        params,
        saltHex: bytesToHex(salt),
        hashHex: bytesToHex(derivedBytes),
    };
    return {
        ...materialWithoutStorageValue,
        storageValue: serializeDerivedPasswordCredential(materialWithoutStorageValue),
    };
}
async function verifyPasswordCredentialMaterial(password, storageValue) {
    if (!password || !storageValue) {
        throw new Error("Password and stored credential are required.");
    }
    const parsed = parseStoredCredential(storageValue);
    const derivedBytes = await (0, scrypt_js_1.scrypt)(encodePassword(password), parsed.salt, parsed.params.N, parsed.params.r, parsed.params.p, parsed.params.dkLen);
    return constantTimeBytesEqual(parsed.hash, derivedBytes);
}
async function deriveShopperPinCredentialMaterial(pin, deviceSaltHex) {
    return derivePasswordCredentialMaterial(pin, {
        salt: hexToBytes(deviceSaltHex),
    });
}
async function deriveShopperPinUniquenessKey(pin, deviceSaltHex) {
    const material = await derivePasswordCredentialMaterial(pin, {
        salt: hexToBytes(deviceSaltHex),
        params: exports.SHOPPER_PIN_UNIQUENESS_SCRYPT_PARAMS,
    });
    return material.hashHex;
}
function extractHashHexFromStoredCredential(storageValue) {
    const hashMatch = storageValue.match(/\$hash=([0-9a-f]+)$/i);
    if (!hashMatch) {
        throw new Error("Invalid stored credential format.");
    }
    return hashMatch[1].toLowerCase();
}
