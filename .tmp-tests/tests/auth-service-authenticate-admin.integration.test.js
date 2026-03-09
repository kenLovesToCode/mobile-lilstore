"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const mockBootstrapDatabase = jest.fn();
const mockGetDb = jest.fn();
const mockWarn = jest.spyOn(console, "warn").mockImplementation(() => { });
const mockVerifyPasswordCredentialMaterial = jest.fn();
const mockDerivePasswordCredentialMaterial = jest.fn();
const mockSerializeDerivedPasswordCredential = jest.fn((_value) => "scrypt$mock-dummy-material");
const mockDb = {
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn(),
    runAsync: jest.fn(),
};
const MOCK_DEFAULT_SCRYPT_PARAMS = {
    N: 16384,
    r: 8,
    p: 1,
    dkLen: 32,
    saltLen: 16,
};
jest.mock("@/db/db", () => ({
    bootstrapDatabase: (...args) => mockBootstrapDatabase(...args),
    getDb: (...args) => mockGetDb(...args),
}));
jest.mock("@/domain/services/password-derivation", () => ({
    DEFAULT_SCRYPT_PARAMS: MOCK_DEFAULT_SCRYPT_PARAMS,
    derivePasswordCredentialMaterial: (...args) => mockDerivePasswordCredentialMaterial(...args),
    serializeDerivedPasswordCredential: (value) => mockSerializeDerivedPasswordCredential(value),
    verifyPasswordCredentialMaterial: (...args) => mockVerifyPasswordCredentialMaterial(...args),
}));
let authenticateAdmin;
describe("authenticateAdmin", () => {
    beforeEach(() => {
        jest.resetModules();
        jest.clearAllMocks();
        mockGetDb.mockReturnValue(mockDb);
        mockBootstrapDatabase.mockResolvedValue(undefined);
        mockDerivePasswordCredentialMaterial.mockResolvedValue({
            storageValue: "scrypt$N=16384$r=8$p=1$dkLen=32$salt=abcd$hash=1234",
        });
        mockDb.getFirstAsync.mockResolvedValue({
            id: 7,
            username: "masteruser",
            password_hash: "scrypt$N=16384$r=8$p=1$dkLen=32$salt=0011$hash=2233",
        });
        mockDb.getAllAsync.mockResolvedValue([
            {
                password_hash: "scrypt$N=16384$r=8$p=1$dkLen=32$salt=0011$hash=2233",
            },
        ]);
        mockDb.runAsync.mockResolvedValue({ changes: 1 });
        mockVerifyPasswordCredentialMaterial.mockResolvedValue(true);
        ({ authenticateAdmin } = require("@/domain/services/auth-service"));
    });
    afterAll(() => {
        mockWarn.mockRestore();
    });
    it("authenticates a valid admin using normalized username + password verification", async () => {
        const result = await authenticateAdmin({
            username: "  MasterUser  ",
            password: "Password123!",
        });
        expect(mockBootstrapDatabase).toHaveBeenCalled();
        expect(mockDb.getFirstAsync).toHaveBeenCalledWith(expect.stringContaining("FROM admin"), "masteruser");
        expect(mockVerifyPasswordCredentialMaterial).toHaveBeenCalledWith("Password123!", "scrypt$N=16384$r=8$p=1$dkLen=32$salt=0011$hash=2233");
        expect(result).toEqual({
            kind: "success",
            admin: {
                id: 7,
                username: "masteruser",
            },
        });
        expect(mockDb.getAllAsync).not.toHaveBeenCalled();
    });
    it("returns a generic invalid-credentials message when username does not exist", async () => {
        mockDb.getFirstAsync.mockResolvedValueOnce(null);
        const result = await authenticateAdmin({
            username: "nope",
            password: "Password123!",
        });
        expect(result).toEqual({
            kind: "invalid-credentials",
            message: "Invalid username or password.",
        });
        expect(mockDb.getAllAsync).toHaveBeenCalledWith(expect.stringContaining("SELECT password_hash"));
        expect(mockVerifyPasswordCredentialMaterial).toHaveBeenCalledWith("Password123!", "scrypt$mock-dummy-material");
    });
    it("uses all known KDF profiles for missing-user auth checks to minimize timing skew", async () => {
        mockDb.getFirstAsync.mockResolvedValueOnce(null);
        mockDb.getAllAsync.mockResolvedValueOnce([
            { password_hash: "scrypt$N=8192$r=8$p=1$dkLen=32$salt=aa$hash=bb" },
            { password_hash: "scrypt$N=32768$r=8$p=1$dkLen=32$salt=cc$hash=dd" },
        ]);
        mockVerifyPasswordCredentialMaterial.mockResolvedValueOnce(false);
        mockVerifyPasswordCredentialMaterial.mockResolvedValueOnce(false);
        const result = await authenticateAdmin({
            username: "nope",
            password: "Password123!",
        });
        expect(result).toEqual({
            kind: "invalid-credentials",
            message: "Invalid username or password.",
        });
        expect(mockDb.getAllAsync).toHaveBeenCalledWith(expect.stringContaining("SELECT password_hash"));
        expect(mockVerifyPasswordCredentialMaterial).toHaveBeenCalledTimes(3);
    });
    it("returns a generic invalid-credentials message when password does not match", async () => {
        mockVerifyPasswordCredentialMaterial.mockResolvedValueOnce(false);
        const result = await authenticateAdmin({
            username: "masteruser",
            password: "wrong-password",
        });
        expect(result).toEqual({
            kind: "invalid-credentials",
            message: "Invalid username or password.",
        });
    });
    it("returns a safe error message when auth service throws", async () => {
        mockDb.getFirstAsync.mockRejectedValueOnce(new Error("db is locked"));
        const result = await authenticateAdmin({
            username: "masteruser",
            password: "Password123!",
        });
        expect(result).toEqual({
            kind: "error",
            message: "We couldn't sign you in right now. Please retry.",
        });
    });
    it("returns invalid-credentials when credential material is malformed", async () => {
        mockVerifyPasswordCredentialMaterial.mockRejectedValueOnce(new Error("Invalid stored credential format."));
        const result = await authenticateAdmin({
            username: "masteruser",
            password: "Password123!",
        });
        expect(result).toEqual({
            kind: "invalid-credentials",
            message: "Invalid username or password.",
        });
        expect(mockWarn).toHaveBeenCalledWith("[auth-service] authenticateAdmin failed", { reason: "CredentialVerificationError" });
    });
    it("returns a safe service error when verification fails for runtime reasons", async () => {
        mockVerifyPasswordCredentialMaterial.mockRejectedValueOnce(new Error("TextEncoder is unavailable in this runtime."));
        const result = await authenticateAdmin({
            username: "masteruser",
            password: "Password123!",
        });
        expect(result).toEqual({
            kind: "error",
            message: "We couldn't sign you in right now. Please retry.",
        });
        expect(mockWarn).toHaveBeenCalledWith("[auth-service] authenticateAdmin failed", { reason: "CredentialVerificationRuntimeError" });
    });
    it("refreshes stored credentials in the background when params are stale", async () => {
        mockDb.getFirstAsync.mockResolvedValueOnce({
            id: 7,
            username: "masteruser",
            password_hash: "scrypt$N=8192$r=8$p=1$dkLen=32$salt=0011$hash=2233",
        });
        const result = await authenticateAdmin({
            username: "masteruser",
            password: "Password123!",
        });
        expect(result).toEqual({
            kind: "success",
            admin: {
                id: 7,
                username: "masteruser",
            },
        });
        expect(mockDerivePasswordCredentialMaterial).toHaveBeenCalledWith("Password123!");
        await Promise.resolve();
        expect(mockDb.runAsync).toHaveBeenCalledWith(expect.stringContaining("UPDATE admin"), "scrypt$N=16384$r=8$p=1$dkLen=32$salt=abcd$hash=1234", expect.any(Number), 7);
    });
    it("does not refresh credentials when stored params are stronger than defaults", async () => {
        mockDb.getFirstAsync.mockResolvedValueOnce({
            id: 7,
            username: "masteruser",
            password_hash: "scrypt$N=32768$r=8$p=1$dkLen=32$salt=0011$hash=2233",
        });
        const result = await authenticateAdmin({
            username: "masteruser",
            password: "Password123!",
        });
        expect(result).toEqual({
            kind: "success",
            admin: {
                id: 7,
                username: "masteruser",
            },
        });
        expect(mockDerivePasswordCredentialMaterial).not.toHaveBeenCalled();
        expect(mockDb.runAsync).not.toHaveBeenCalled();
    });
});
