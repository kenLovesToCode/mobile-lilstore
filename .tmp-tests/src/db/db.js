"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.getDb = getDb;
exports.bootstrapDatabase = bootstrapDatabase;
const SQLite = __importStar(require("expo-sqlite"));
const _0001_initial_1 = require("@/db/migrations/0001_initial");
const _0002_store_owner_1 = require("@/db/migrations/0002_store_owner");
const _0003_owner_scoped_entities_1 = require("@/db/migrations/0003_owner_scoped_entities");
const _0004_shopper_pin_hash_global_uniqueness_1 = require("@/db/migrations/0004_shopper_pin_hash_global_uniqueness");
const _0005_device_secret_salt_1 = require("@/db/migrations/0005_device_secret_salt");
const DATABASE_NAME = "lilstore.db";
const db = SQLite.openDatabaseSync(DATABASE_NAME);
const SHOPPER_PIN_SALT_SECRET_KEY = "shopper_pin_salt_hex";
const BASE_MIGRATION_STATEMENTS = [
    "PRAGMA foreign_keys = ON;",
    ..._0001_initial_1.INITIAL_MIGRATION_STATEMENTS,
    ..._0002_store_owner_1.STORE_OWNER_MIGRATION_STATEMENTS,
    ..._0003_owner_scoped_entities_1.OWNER_SCOPED_ENTITY_MIGRATION_STATEMENTS,
];
let bootstrapPromise = null;
function getDb() {
    return db;
}
async function bootstrapDatabase() {
    if (!bootstrapPromise) {
        bootstrapPromise = (async () => {
            for (const statement of BASE_MIGRATION_STATEMENTS) {
                await db.execAsync(statement);
            }
            await (0, _0004_shopper_pin_hash_global_uniqueness_1.ensureShopperPinHashColumn)(db);
            await (0, _0004_shopper_pin_hash_global_uniqueness_1.ensureShopperPinKeyColumn)(db);
            for (const statement of _0005_device_secret_salt_1.DEVICE_SECRET_SALT_MIGRATION_STATEMENTS) {
                await db.execAsync(statement);
            }
            const deviceSaltRow = await db.getFirstAsync("SELECT value FROM app_secret WHERE key = ? LIMIT 1;", SHOPPER_PIN_SALT_SECRET_KEY);
            if (!deviceSaltRow?.value) {
                throw new Error("Device shopper PIN salt is unavailable during migration.");
            }
            await (0, _0004_shopper_pin_hash_global_uniqueness_1.backfillLegacyShopperPins)(db, deviceSaltRow.value);
            for (const statement of _0004_shopper_pin_hash_global_uniqueness_1.SHOPPER_PIN_HASH_GLOBAL_UNIQUENESS_MIGRATION_STATEMENTS) {
                await db.execAsync(statement);
            }
        })();
    }
    try {
        await bootstrapPromise;
    }
    catch (error) {
        bootstrapPromise = null;
        throw error;
    }
}
