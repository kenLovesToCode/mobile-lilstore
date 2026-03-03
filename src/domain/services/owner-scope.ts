import {
  getActiveOwner,
  isAdminAuthenticated,
  type ActiveOwnerContext,
} from "@/domain/services/admin-session";

export type OwnerScopeErrorCode =
  | "OWNER_SCOPE_REQUIRES_ADMIN_SESSION"
  | "OWNER_SCOPE_REQUIRES_ACTIVE_OWNER"
  | "OWNER_SCOPE_INVALID_INPUT"
  | "OWNER_SCOPE_CONFLICT"
  | "OWNER_SCOPE_MISMATCH"
  | "OWNER_SCOPE_NOT_FOUND"
  | "OWNER_SCOPE_UNAVAILABLE";

export type OwnerScopeError = {
  code: OwnerScopeErrorCode;
  message: string;
};

export type OwnerScopeResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: OwnerScopeError };

export const OWNER_SCOPE_REQUIRES_ADMIN_SESSION_MESSAGE =
  "Please sign in as admin to continue.";
export const OWNER_SCOPE_REQUIRES_ACTIVE_OWNER_MESSAGE =
  "Select an active owner before managing owner-scoped data.";
export const OWNER_SCOPE_INVALID_INPUT_MESSAGE =
  "Please provide valid inputs for this operation.";
export const OWNER_SCOPE_CONFLICT_MESSAGE =
  "This operation conflicts with existing owner-scoped data.";
export const OWNER_SCOPE_MISMATCH_MESSAGE =
  "The requested record belongs to a different owner.";
export const OWNER_SCOPE_NOT_FOUND_MESSAGE =
  "Record not found in the active owner scope.";
export const OWNER_SCOPE_UNAVAILABLE_MESSAGE =
  "We couldn't process that owner-scoped operation right now. Please retry.";

export function getSafeErrorReason(error: unknown) {
  if (error instanceof Error && error.name) {
    return error.name;
  }
  return "UnknownError";
}

export function invalidInputError(
  message: string = OWNER_SCOPE_INVALID_INPUT_MESSAGE,
): OwnerScopeResult<never> {
  return {
    ok: false,
    error: {
      code: "OWNER_SCOPE_INVALID_INPUT",
      message,
    },
  };
}

export function conflictError(
  message: string = OWNER_SCOPE_CONFLICT_MESSAGE,
): OwnerScopeResult<never> {
  return {
    ok: false,
    error: {
      code: "OWNER_SCOPE_CONFLICT",
      message,
    },
  };
}

export function requireActiveOwnerContext(): OwnerScopeResult<ActiveOwnerContext> {
  if (!isAdminAuthenticated()) {
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_REQUIRES_ADMIN_SESSION",
        message: OWNER_SCOPE_REQUIRES_ADMIN_SESSION_MESSAGE,
      },
    };
  }

  const activeOwner = getActiveOwner();
  if (!activeOwner) {
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_REQUIRES_ACTIVE_OWNER",
        message: OWNER_SCOPE_REQUIRES_ACTIVE_OWNER_MESSAGE,
      },
    };
  }

  return {
    ok: true,
    value: activeOwner,
  };
}
