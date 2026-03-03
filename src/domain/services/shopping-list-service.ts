import { bootstrapDatabase, getDb } from "@/db/db";
import { PRODUCT_TABLE, SHOPPING_LIST_ITEM_TABLE } from "@/db/schema";
import {
  type OwnerScopeResult,
  conflictError,
  invalidInputError,
  OWNER_SCOPE_MISMATCH_MESSAGE,
  OWNER_SCOPE_NOT_FOUND_MESSAGE,
  OWNER_SCOPE_UNAVAILABLE_MESSAGE,
  getSafeErrorReason,
  requireActiveOwnerContext,
} from "@/domain/services/owner-scope";

type ProductOwnerRow = {
  owner_id: number;
  archived_at_ms: number | null;
};

type ShoppingListItemRow = {
  id: number;
  owner_id: number;
  product_id: number;
  quantity: number;
  unit_price_cents: number;
  created_at_ms: number;
  updated_at_ms: number;
};

export type ShoppingListItem = {
  id: number;
  ownerId: number;
  productId: number;
  quantity: number;
  unitPriceCents: number;
  createdAtMs: number;
  updatedAtMs: number;
};

export type AddShoppingListItemInput = {
  productId: number;
  quantity: number;
  unitPriceCents: number;
  nowMs?: number;
};

export type UpdateShoppingListItemInput = {
  itemId: number;
  quantity: number;
  unitPriceCents: number;
  nowMs?: number;
};

export type RemoveShoppingListItemInput = {
  itemId: number;
};

export type RemoveShoppingListItemResult = {
  removedItemId: number;
};

const SHOPPING_LIST_INPUT_INVALID_MESSAGE =
  "Quantity must be a positive integer and unit price must be a non-negative integer.";
const SHOPPING_LIST_ARCHIVED_PRODUCT_CONFLICT_MESSAGE =
  "Archived products cannot be used in active shopping-list entries. Select an active product.";
const SHOPPING_LIST_DUPLICATE_PRODUCT_CONFLICT_MESSAGE =
  "This product is already published in the shopping list for the active owner.";
const SHOPPING_LIST_OWNER_PRODUCT_UNIQUE_INDEX_NAME =
  "idx_shopping_list_item_owner_product_unique";

function mapItem(row: ShoppingListItemRow): ShoppingListItem {
  return {
    id: row.id,
    ownerId: row.owner_id,
    productId: row.product_id,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
  };
}

async function findProductOwner(productId: number) {
  const db = getDb();
  return db.getFirstAsync<ProductOwnerRow>(
    `SELECT owner_id, archived_at_ms FROM ${PRODUCT_TABLE} WHERE id = ? LIMIT 1;`,
    productId,
  );
}

async function findItem(itemId: number) {
  const db = getDb();
  return db.getFirstAsync<ShoppingListItemRow>(
    `SELECT id, owner_id, product_id, quantity, unit_price_cents, created_at_ms, updated_at_ms
     FROM ${SHOPPING_LIST_ITEM_TABLE}
     WHERE id = ?
     LIMIT 1;`,
    itemId,
  );
}

function validatePricing(
  quantity: number,
  unitPriceCents: number,
): OwnerScopeResult<never> | null {
  if (
    !Number.isInteger(quantity) ||
    quantity <= 0 ||
    !Number.isInteger(unitPriceCents) ||
    unitPriceCents < 0
  ) {
    return invalidInputError(SHOPPING_LIST_INPUT_INVALID_MESSAGE);
  }

  return null;
}

function mapAddConflictError(error: unknown): OwnerScopeResult<never> | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const message = error.message ?? "";
  if (!/UNIQUE constraint failed/i.test(message)) {
    return null;
  }

  const isDuplicateProductConstraint =
    message.includes(SHOPPING_LIST_OWNER_PRODUCT_UNIQUE_INDEX_NAME) ||
    /owner_id,\s*product_id/i.test(message);

  if (isDuplicateProductConstraint) {
    return conflictError(SHOPPING_LIST_DUPLICATE_PRODUCT_CONFLICT_MESSAGE);
  }

  return conflictError();
}

export async function addShoppingListItem(
  input: AddShoppingListItemInput,
): Promise<OwnerScopeResult<ShoppingListItem>> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  const db = getDb();
  const invalidPricing = validatePricing(input.quantity, input.unitPriceCents);
  if (invalidPricing) {
    return invalidPricing;
  }

  const productOwner = await findProductOwner(input.productId);
  if (!productOwner) {
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_NOT_FOUND",
        message: OWNER_SCOPE_NOT_FOUND_MESSAGE,
      },
    };
  }

  if (productOwner.owner_id !== ownerContext.value.id) {
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_MISMATCH",
        message: OWNER_SCOPE_MISMATCH_MESSAGE,
      },
    };
  }
  if (productOwner.archived_at_ms != null) {
    return conflictError(SHOPPING_LIST_ARCHIVED_PRODUCT_CONFLICT_MESSAGE);
  }

  const nowMs = input.nowMs ?? Date.now();

  try {
    const insertResult = await db.runAsync(
      `INSERT INTO ${SHOPPING_LIST_ITEM_TABLE} (
         owner_id, product_id, quantity, unit_price_cents, created_at_ms, updated_at_ms
       ) VALUES (?, ?, ?, ?, ?, ?);`,
      ownerContext.value.id,
      input.productId,
      input.quantity,
      input.unitPriceCents,
      nowMs,
      nowMs,
    );

    const created = await findItem(Number(insertResult.lastInsertRowId));
    if (!created) {
      return {
        ok: false,
        error: {
          code: "OWNER_SCOPE_UNAVAILABLE",
          message: OWNER_SCOPE_UNAVAILABLE_MESSAGE,
        },
      };
    }

    return { ok: true, value: mapItem(created) };
  } catch (error: unknown) {
    const mappedConflict = mapAddConflictError(error);
    if (mappedConflict) {
      return mappedConflict;
    }

    console.warn("[shopping-list-service] addShoppingListItem failed", {
      reason: getSafeErrorReason(error),
    });
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_UNAVAILABLE",
        message: OWNER_SCOPE_UNAVAILABLE_MESSAGE,
      },
    };
  }
}

export async function listShoppingListItems(): Promise<
  OwnerScopeResult<ShoppingListItem[]>
> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  const db = getDb();

  try {
    const rows = await db.getAllAsync<ShoppingListItemRow>(
      `SELECT item.id,
              item.owner_id,
              item.product_id,
              item.quantity,
              item.unit_price_cents,
              item.created_at_ms,
              item.updated_at_ms
       FROM ${SHOPPING_LIST_ITEM_TABLE} AS item
       INNER JOIN ${PRODUCT_TABLE} AS product
         ON product.id = item.product_id
        AND product.owner_id = item.owner_id
       WHERE item.owner_id = ?
         AND product.archived_at_ms IS NULL
       ORDER BY item.created_at_ms DESC, item.id DESC;`,
      ownerContext.value.id,
    );
    return { ok: true, value: rows.map(mapItem) };
  } catch (error: unknown) {
    console.warn("[shopping-list-service] listShoppingListItems failed", {
      reason: getSafeErrorReason(error),
    });
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_UNAVAILABLE",
        message: OWNER_SCOPE_UNAVAILABLE_MESSAGE,
      },
    };
  }
}

export async function updateShoppingListItem(
  input: UpdateShoppingListItemInput,
): Promise<OwnerScopeResult<ShoppingListItem>> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  const db = getDb();
  const invalidPricing = validatePricing(input.quantity, input.unitPriceCents);
  if (invalidPricing) {
    return invalidPricing;
  }

  const existing = await findItem(input.itemId);
  if (!existing) {
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_NOT_FOUND",
        message: OWNER_SCOPE_NOT_FOUND_MESSAGE,
      },
    };
  }

  if (existing.owner_id !== ownerContext.value.id) {
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_MISMATCH",
        message: OWNER_SCOPE_MISMATCH_MESSAGE,
      },
    };
  }

  const productOwner = await findProductOwner(existing.product_id);
  if (!productOwner) {
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_NOT_FOUND",
        message: OWNER_SCOPE_NOT_FOUND_MESSAGE,
      },
    };
  }
  if (productOwner.owner_id !== ownerContext.value.id) {
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_MISMATCH",
        message: OWNER_SCOPE_MISMATCH_MESSAGE,
      },
    };
  }
  if (productOwner.archived_at_ms != null) {
    return conflictError(SHOPPING_LIST_ARCHIVED_PRODUCT_CONFLICT_MESSAGE);
  }

  try {
    await db.runAsync(
      `UPDATE ${SHOPPING_LIST_ITEM_TABLE}
       SET quantity = ?, unit_price_cents = ?, updated_at_ms = ?
       WHERE id = ? AND owner_id = ?;`,
      input.quantity,
      input.unitPriceCents,
      input.nowMs ?? Date.now(),
      input.itemId,
      ownerContext.value.id,
    );

    const updated = await findItem(input.itemId);
    if (!updated) {
      return {
        ok: false,
        error: {
          code: "OWNER_SCOPE_NOT_FOUND",
          message: OWNER_SCOPE_NOT_FOUND_MESSAGE,
        },
      };
    }

    return { ok: true, value: mapItem(updated) };
  } catch (error: unknown) {
    console.warn("[shopping-list-service] updateShoppingListItem failed", {
      reason: getSafeErrorReason(error),
    });
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_UNAVAILABLE",
        message: OWNER_SCOPE_UNAVAILABLE_MESSAGE,
      },
    };
  }
}

export async function removeShoppingListItem(
  input: RemoveShoppingListItemInput,
): Promise<OwnerScopeResult<RemoveShoppingListItemResult>> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  const db = getDb();
  const existing = await findItem(input.itemId);

  if (!existing) {
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_NOT_FOUND",
        message: OWNER_SCOPE_NOT_FOUND_MESSAGE,
      },
    };
  }

  if (existing.owner_id !== ownerContext.value.id) {
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_MISMATCH",
        message: OWNER_SCOPE_MISMATCH_MESSAGE,
      },
    };
  }

  try {
    const deleteResult = await db.runAsync(
      `DELETE FROM ${SHOPPING_LIST_ITEM_TABLE}
       WHERE id = ? AND owner_id = ?;`,
      input.itemId,
      ownerContext.value.id,
    );

    if (deleteResult.changes < 1) {
      return {
        ok: false,
        error: {
          code: "OWNER_SCOPE_NOT_FOUND",
          message: OWNER_SCOPE_NOT_FOUND_MESSAGE,
        },
      };
    }

    return {
      ok: true,
      value: {
        removedItemId: input.itemId,
      },
    };
  } catch (error: unknown) {
    console.warn("[shopping-list-service] removeShoppingListItem failed", {
      reason: getSafeErrorReason(error),
    });
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_UNAVAILABLE",
        message: OWNER_SCOPE_UNAVAILABLE_MESSAGE,
      },
    };
  }
}
