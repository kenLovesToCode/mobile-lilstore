"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_LOGIN_ROUTE = exports.CREATE_MASTER_ADMIN_ROUTE = void 0;
exports.determineEntryRoute = determineEntryRoute;
exports.shouldExposeMasterAdminSetup = shouldExposeMasterAdminSetup;
exports.CREATE_MASTER_ADMIN_ROUTE = "/(admin)/create-master-admin";
exports.ADMIN_LOGIN_ROUTE = "/(admin)/login";
function determineEntryRoute(adminExists) {
    if (adminExists) {
        return exports.ADMIN_LOGIN_ROUTE;
    }
    return exports.CREATE_MASTER_ADMIN_ROUTE;
}
function shouldExposeMasterAdminSetup(adminExists) {
    return !adminExists;
}
