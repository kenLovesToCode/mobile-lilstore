"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STORE_OWNER_MIGRATION_STATEMENTS = void 0;
const schema_1 = require("@/db/schema");
exports.STORE_OWNER_MIGRATION_STATEMENTS = [
    schema_1.CREATE_STORE_OWNER_TABLE_SQL,
    schema_1.CREATE_STORE_OWNER_NAME_UNIQUE_INDEX_SQL,
    schema_1.CREATE_STORE_OWNER_UPDATED_AT_INDEX_SQL,
];
