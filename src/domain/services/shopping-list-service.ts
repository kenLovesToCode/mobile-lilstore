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
  bundle_qty: number | null;
  bundle_price_cents: number | null;
  created_at_ms: number;
  updated_at_ms: number;
};

export type ShoppingListItem = {
  id: number;
  ownerId: number;
  productId: number;
  quantity: number;
  unitPriceCents: number;
  bundleQty: number | null;
  bundlePriceCents: number | null;
  createdAtMs: number;
  updatedAtMs: number;
};

export type AddShoppingListItemInput = {
  productId: number;
  quantity: number;
  unitPriceCents: number;
  bundleQty?: number | null;
  bundlePriceCents?: number | null;
  nowMs?: number;
};

export type UpdateShoppingListItemInput = {
  itemId: number;
  quantity: number;
  unitPriceCents: number;
  bundleQty?: number | null;
  bundlePriceCents?: number | null;
  nowMs?: number;
};

export type RemoveShoppingListItemInput = {
  itemId: number;
};

export type RemoveShoppingListItemResult = {
  removedItemId: number;
};

const SHOPPING_LIST_INPUT_INVALID_MESSAGE =
  "Quantity must be a positive integer, unit price must be a non-negative integer, and bundle offers must include both fields with bundle quantity >= 2 and bundle price > 0.";
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
    bundleQty: row.bundle_qty ?? null,
    bundlePriceCents: row.bundle_price_cents ?? null,
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
    `SELECT id,
            owner_id,
            product_id,
            quantity,
            unit_price_cents,
            bundle_qty,
            bundle_price_cents,
            created_at_ms,
            updated_at_ms
     FROM ${SHOPPING_LIST_ITEM_TABLE}
     WHERE id = ?
     LIMIT 1;`,
    itemId,
  );
}

type BundlePricingValidationResult = {
  bundleQty: number | null;
  bundlePriceCents: number | null;
  invalid: OwnerScopeResult<never> | null;
};

function validateBundlePricing(
  bundleQtyInput: number | null | undefined,
  bundlePriceInput: number | null | undefined,
): BundlePricingValidationResult {
  const hasBundleQtyInput = bundleQtyInput !== undefined;
  const hasBundlePriceInput = bundlePriceInput !== undefined;
  if (hasBundleQtyInput !== hasBundlePriceInput) {
    return {
      bundleQty: null,
      bundlePriceCents: null,
      invalid: invalidInputError(SHOPPING_LIST_INPUT_INVALID_MESSAGE),
    };
  }

  const bundleQty = bundleQtyInput ?? null;
  const bundlePriceCents = bundlePriceInput ?? null;

  const hasBundleQty = bundleQty != null;
  const hasBundlePrice = bundlePriceCents != null;
  if (hasBundleQty !== hasBundlePrice) {
    return {
      bundleQty: null,
      bundlePriceCents: null,
      invalid: invalidInputError(SHOPPING_LIST_INPUT_INVALID_MESSAGE),
    };
  }

  if (!hasBundleQty && !hasBundlePrice) {
    return {
      bundleQty: null,
      bundlePriceCents: null,
      invalid: null,
    };
  }
  if (bundleQty == null || bundlePriceCents == null) {
    return {
      bundleQty: null,
      bundlePriceCents: null,
      invalid: invalidInputError(SHOPPING_LIST_INPUT_INVALID_MESSAGE),
    };
  }

  if (
    !Number.isInteger(bundleQty) ||
    bundleQty < 2 ||
    !Number.isInteger(bundlePriceCents) ||
    bundlePriceCents <= 0
  ) {
    return {
      bundleQty: null,
      bundlePriceCents: null,
      invalid: invalidInputError(SHOPPING_LIST_INPUT_INVALID_MESSAGE),
    };
  }

  return {
    bundleQty,
    bundlePriceCents,
    invalid: null,
  };
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
  const bundlePricing = validateBundlePricing(input.bundleQty, input.bundlePriceCents);
  if (bundlePricing.invalid) {
    return bundlePricing.invalid;
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
         owner_id, product_id, quantity, unit_price_cents, bundle_qty, bundle_price_cents, created_at_ms, updated_at_ms
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      ownerContext.value.id,
      input.productId,
      input.quantity,
      input.unitPriceCents,
      bundlePricing.bundleQty,
      bundlePricing.bundlePriceCents,
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
              item.bundle_qty,
              item.bundle_price_cents,
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
  const hasBundleInput =
    input.bundleQty !== undefined || input.bundlePriceCents !== undefined;
  const providedBundlePricing = hasBundleInput
    ? validateBundlePricing(input.bundleQty, input.bundlePriceCents)
    : null;
  if (providedBundlePricing?.invalid) {
    return providedBundlePricing.invalid;
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

  const bundlePricing = providedBundlePricing ?? {
    bundleQty: existing.bundle_qty ?? null,
    bundlePriceCents: existing.bundle_price_cents ?? null,
    invalid: null,
  };

  try {
    await db.runAsync(
      `UPDATE ${SHOPPING_LIST_ITEM_TABLE}
       SET quantity = ?, unit_price_cents = ?, bundle_qty = ?, bundle_price_cents = ?, updated_at_ms = ?
       WHERE id = ? AND owner_id = ?;`,
      input.quantity,
      input.unitPriceCents,
      bundlePricing.bundleQty,
      bundlePricing.bundlePriceCents,
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
