import { bootstrapDatabase, getDb } from "@/db/db";
import { PRODUCT_TABLE, SHOPPING_LIST_ITEM_TABLE } from "@/db/schema";
import {
  type OwnerScopeResult,
  invalidInputError,
  OWNER_SCOPE_MISMATCH_MESSAGE,
  OWNER_SCOPE_NOT_FOUND_MESSAGE,
  OWNER_SCOPE_UNAVAILABLE_MESSAGE,
  getSafeErrorReason,
  requireActiveOwnerContext,
} from "@/domain/services/owner-scope";

type ProductOwnerRow = {
  owner_id: number;
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

const SHOPPING_LIST_INPUT_INVALID_MESSAGE =
  "Quantity must be a positive integer and unit price must be a non-negative integer.";

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
    `SELECT owner_id FROM ${PRODUCT_TABLE} WHERE id = ? LIMIT 1;`,
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
      `SELECT id, owner_id, product_id, quantity, unit_price_cents, created_at_ms, updated_at_ms
       FROM ${SHOPPING_LIST_ITEM_TABLE}
       WHERE owner_id = ?
       ORDER BY created_at_ms DESC, id DESC;`,
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
