"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEVICE_SECRET_SALT_MIGRATION_STATEMENTS = void 0;
const schema_1 = require("@/db/schema");
const SHOPPER_PIN_SALT_SECRET_KEY = "shopper_pin_salt_hex";
exports.DEVICE_SECRET_SALT_MIGRATION_STATEMENTS = [
    schema_1.CREATE_APP_SECRET_TABLE_SQL,
    `INSERT INTO ${schema_1.APP_SECRET_TABLE}(key, value)
   SELECT '${SHOPPER_PIN_SALT_SECRET_KEY}', lower(hex(randomblob(16)))
   WHERE NOT EXISTS (
     SELECT 1 FROM ${schema_1.APP_SECRET_TABLE}
     WHERE key = '${SHOPPER_PIN_SALT_SECRET_KEY}'
   );`,
];
