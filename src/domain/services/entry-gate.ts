export const CREATE_MASTER_ADMIN_ROUTE = "/(admin)/create-master-admin" as const;
export const ADMIN_LOGIN_ROUTE = "/(admin)/login" as const;

export type EntryRoute = typeof CREATE_MASTER_ADMIN_ROUTE | typeof ADMIN_LOGIN_ROUTE;

export function determineEntryRoute(adminExists: boolean): EntryRoute {
  if (adminExists) {
    return ADMIN_LOGIN_ROUTE;
  }
  return CREATE_MASTER_ADMIN_ROUTE;
}

export function shouldExposeMasterAdminSetup(adminExists: boolean) {
  return !adminExists;
}
