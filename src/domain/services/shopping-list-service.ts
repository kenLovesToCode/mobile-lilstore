import { bootstrapDatabase, getDb } from "@/db/db";
import {
  PRODUCT_TABLE,
  SHOPPING_LIST_ASSORTED_ITEM_TABLE,
  SHOPPING_LIST_ASSORTED_MEMBER_TABLE,
  SHOPPING_LIST_ITEM_TABLE,
} from "@/db/schema";
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
  id: number;
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

type AssortedItemRow = {
  id: number;
  owner_id: number;
  name: string;
  quantity: number;
  unit_price_cents: number;
  bundle_qty: number | null;
  bundle_price_cents: number | null;
  created_at_ms: number;
  updated_at_ms: number;
};

type AssortedListRow = AssortedItemRow & {
  member_count: number;
};

type AssortedMemberRow = {
  assorted_item_id: number;
  product_id: number;
};

export type StandardShoppingListItem = {
  id: number;
  ownerId: number;
  productId: number;
  quantity: number;
  unitPriceCents: number;
  bundleQty: number | null;
  bundlePriceCents: number | null;
  createdAtMs: number;
  updatedAtMs: number;
  itemType?: "standard";
};

export type AssortedShoppingListItem = {
  id: number;
  ownerId: number;
  name: string;
  quantity: number;
  unitPriceCents: number;
  bundleQty: number | null;
  bundlePriceCents: number | null;
  memberProductIds: number[];
  memberCount: number;
  createdAtMs: number;
  updatedAtMs: number;
  itemType: "assorted";
};

export type ShoppingListItem = StandardShoppingListItem | AssortedShoppingListItem;

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

export type CreateAssortedShoppingListItemInput = {
  name: string;
  quantity: number;
  unitPriceCents: number;
  bundleQty?: number | null;
  bundlePriceCents?: number | null;
  memberProductIds: number[];
  nowMs?: number;
};

export type UpdateAssortedShoppingListItemInput = {
  itemId: number;
  name: string;
  quantity: number;
  unitPriceCents: number;
  bundleQty?: number | null;
  bundlePriceCents?: number | null;
  memberProductIds: number[];
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
const ASSORTED_NAME_INVALID_MESSAGE = "Assorted entry name is required.";
const ASSORTED_MEMBERS_INVALID_MESSAGE =
  "Assorted shopping-list entries must include at least two unique active member products for the active owner.";
const ASSORTED_ARCHIVED_MEMBER_CONFLICT_MESSAGE =
  "Archived products cannot be members of assorted shopping-list entries. Select active products only.";
const ASSORTED_MEMBER_UNIQUE_INDEX_NAME =
  "idx_shopping_list_assorted_member_owner_assorted_product_unique";

function mapStandardItem(
  row: ShoppingListItemRow,
  options?: { includeItemType?: boolean },
): StandardShoppingListItem {
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
    ...(options?.includeItemType ? { itemType: "standard" as const } : {}),
  };
}

function mapAssortedItem(
  row: AssortedItemRow,
  memberProductIds: number[],
): AssortedShoppingListItem {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    quantity: row.quantity,
    unitPriceCents: row.unit_price_cents,
    bundleQty: row.bundle_qty ?? null,
    bundlePriceCents: row.bundle_price_cents ?? null,
    memberProductIds,
    memberCount: memberProductIds.length,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
    itemType: "assorted",
  };
}

async function findProductOwner(productId: number) {
  const db = getDb();
  return db.getFirstAsync<ProductOwnerRow>(
    `SELECT id, owner_id, archived_at_ms FROM ${PRODUCT_TABLE} WHERE id = ? LIMIT 1;`,
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

async function findAssortedItem(itemId: number) {
  const db = getDb();
  return db.getFirstAsync<AssortedItemRow>(
    `SELECT id,
            owner_id,
            name,
            quantity,
            unit_price_cents,
            bundle_qty,
            bundle_price_cents,
            created_at_ms,
            updated_at_ms
     FROM ${SHOPPING_LIST_ASSORTED_ITEM_TABLE}
     WHERE id = ?
     LIMIT 1;`,
    itemId,
  );
}

async function findAssortedMembers(itemId: number, ownerId: number) {
  const db = getDb();
  const rows = await db.getAllAsync<{ product_id: number }>(
    `SELECT member.product_id
     FROM ${SHOPPING_LIST_ASSORTED_MEMBER_TABLE} AS member
     INNER JOIN ${PRODUCT_TABLE} AS product
       ON product.id = member.product_id
      AND product.owner_id = member.owner_id
      AND product.archived_at_ms IS NULL
     WHERE member.assorted_item_id = ?
       AND member.owner_id = ?
     ORDER BY member.id ASC;`,
    itemId,
    ownerId,
  );

  return rows.map((row) => row.product_id);
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

function normalizeAssortedName(name: string) {
  return name.trim();
}

function normalizeAssortedMembers(memberProductIds: number[]): number[] | null {
  if (!Array.isArray(memberProductIds)) {
    return null;
  }

  const normalized: number[] = [];
  const seen = new Set<number>();
  for (const memberProductId of memberProductIds) {
    if (!Number.isInteger(memberProductId) || memberProductId <= 0) {
      return null;
    }
    if (seen.has(memberProductId)) {
      return null;
    }
    seen.add(memberProductId);
    normalized.push(memberProductId);
  }

  if (normalized.length < 2) {
    return null;
  }

  return normalized;
}

async function validateAssortedMemberProducts(
  ownerId: number,
  memberProductIds: number[],
): Promise<OwnerScopeResult<never> | null> {
  const db = getDb();
  const placeholders = memberProductIds.map(() => "?").join(", ");
  const rows = await db.getAllAsync<ProductOwnerRow>(
    `SELECT id, owner_id, archived_at_ms
     FROM ${PRODUCT_TABLE}
     WHERE id IN (${placeholders});`,
    ...memberProductIds,
  );

  const rowById = new Map<number, ProductOwnerRow>();
  for (const row of rows) {
    rowById.set(row.id, row);
  }

  for (const memberProductId of memberProductIds) {
    const row = rowById.get(memberProductId);
    if (!row) {
      return {
        ok: false,
        error: {
          code: "OWNER_SCOPE_NOT_FOUND",
          message: OWNER_SCOPE_NOT_FOUND_MESSAGE,
        },
      };
    }
    if (row.owner_id !== ownerId) {
      return {
        ok: false,
        error: {
          code: "OWNER_SCOPE_MISMATCH",
          message: OWNER_SCOPE_MISMATCH_MESSAGE,
        },
      };
    }
    if (row.archived_at_ms != null) {
      return conflictError(ASSORTED_ARCHIVED_MEMBER_CONFLICT_MESSAGE);
    }
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

function mapAssortedConflictError(error: unknown): OwnerScopeResult<never> | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const message = error.message ?? "";
  if (!/UNIQUE constraint failed/i.test(message)) {
    return null;
  }

  const duplicateMemberConstraint =
    message.includes(ASSORTED_MEMBER_UNIQUE_INDEX_NAME) ||
    /assorted_item_id,\s*product_id/i.test(message);

  if (duplicateMemberConstraint) {
    return invalidInputError(ASSORTED_MEMBERS_INVALID_MESSAGE);
  }

  return conflictError();
}

async function listAssortedRows(ownerId: number): Promise<AssortedListRow[]> {
  const db = getDb();
  return db.getAllAsync<AssortedListRow>(
    `SELECT item.id,
            item.owner_id,
            item.name,
            item.quantity,
            item.unit_price_cents,
            item.bundle_qty,
            item.bundle_price_cents,
            item.created_at_ms,
            item.updated_at_ms,
            COUNT(product.id) AS member_count
     FROM ${SHOPPING_LIST_ASSORTED_ITEM_TABLE} AS item
     LEFT JOIN ${SHOPPING_LIST_ASSORTED_MEMBER_TABLE} AS member
       ON member.assorted_item_id = item.id
      AND member.owner_id = item.owner_id
     LEFT JOIN ${PRODUCT_TABLE} AS product
       ON product.id = member.product_id
      AND product.owner_id = member.owner_id
      AND product.archived_at_ms IS NULL
     WHERE item.owner_id = ?
     GROUP BY item.id,
              item.owner_id,
              item.name,
              item.quantity,
              item.unit_price_cents,
              item.bundle_qty,
              item.bundle_price_cents,
              item.created_at_ms,
              item.updated_at_ms
     ORDER BY item.created_at_ms DESC, item.id DESC;`,
    ownerId,
  );
}

async function listAssortedMemberRows(ownerId: number): Promise<AssortedMemberRow[]> {
  const db = getDb();
  return db.getAllAsync<AssortedMemberRow>(
    `SELECT member.assorted_item_id, member.product_id
     FROM ${SHOPPING_LIST_ASSORTED_MEMBER_TABLE} AS member
     INNER JOIN ${PRODUCT_TABLE} AS product
       ON product.id = member.product_id
      AND product.owner_id = member.owner_id
      AND product.archived_at_ms IS NULL
     WHERE member.owner_id = ?
     ORDER BY member.assorted_item_id ASC, member.id ASC;`,
    ownerId,
  );
}

function buildAssortedMemberMap(rows: AssortedMemberRow[]) {
  const map = new Map<number, number[]>();

  for (const row of rows) {
    const existing = map.get(row.assorted_item_id);
    if (existing) {
      existing.push(row.product_id);
      continue;
    }
    map.set(row.assorted_item_id, [row.product_id]);
  }

  return map;
}

export async function addShoppingListItem(
  input: AddShoppingListItemInput,
): Promise<OwnerScopeResult<StandardShoppingListItem>> {
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

    return { ok: true, value: mapStandardItem(created) };
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

export async function createAssortedShoppingListItem(
  input: CreateAssortedShoppingListItemInput,
): Promise<OwnerScopeResult<AssortedShoppingListItem>> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  const db = getDb();
  const normalizedName = normalizeAssortedName(input.name);
  if (!normalizedName) {
    return invalidInputError(ASSORTED_NAME_INVALID_MESSAGE);
  }

  const invalidPricing = validatePricing(input.quantity, input.unitPriceCents);
  if (invalidPricing) {
    return invalidPricing;
  }
  const bundlePricing = validateBundlePricing(input.bundleQty, input.bundlePriceCents);
  if (bundlePricing.invalid) {
    return bundlePricing.invalid;
  }

  const normalizedMemberProductIds = normalizeAssortedMembers(input.memberProductIds);
  if (!normalizedMemberProductIds) {
    return invalidInputError(ASSORTED_MEMBERS_INVALID_MESSAGE);
  }

  const memberValidationError = await validateAssortedMemberProducts(
    ownerContext.value.id,
    normalizedMemberProductIds,
  );
  if (memberValidationError) {
    return memberValidationError;
  }

  const nowMs = input.nowMs ?? Date.now();
  let inTransaction = false;
  try {
    await db.runAsync("BEGIN IMMEDIATE TRANSACTION;");
    inTransaction = true;

    const insertResult = await db.runAsync(
      `INSERT INTO ${SHOPPING_LIST_ASSORTED_ITEM_TABLE} (
         owner_id, name, quantity, unit_price_cents, bundle_qty, bundle_price_cents, created_at_ms, updated_at_ms
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
      ownerContext.value.id,
      normalizedName,
      input.quantity,
      input.unitPriceCents,
      bundlePricing.bundleQty,
      bundlePricing.bundlePriceCents,
      nowMs,
      nowMs,
    );

    const assortedItemId = Number(insertResult.lastInsertRowId);
    for (const memberProductId of normalizedMemberProductIds) {
      await db.runAsync(
        `INSERT INTO ${SHOPPING_LIST_ASSORTED_MEMBER_TABLE} (
           owner_id, assorted_item_id, product_id, created_at_ms
         ) VALUES (?, ?, ?, ?);`,
        ownerContext.value.id,
        assortedItemId,
        memberProductId,
        nowMs,
      );
    }

    await db.runAsync("COMMIT;");
    inTransaction = false;

    const created = await findAssortedItem(assortedItemId);
    if (!created) {
      return {
        ok: false,
        error: {
          code: "OWNER_SCOPE_UNAVAILABLE",
          message: OWNER_SCOPE_UNAVAILABLE_MESSAGE,
        },
      };
    }

    const memberProductIds = await findAssortedMembers(assortedItemId, ownerContext.value.id);
    return {
      ok: true,
      value: mapAssortedItem(created, memberProductIds),
    };
  } catch (error: unknown) {
    if (inTransaction) {
      try {
        await db.runAsync("ROLLBACK;");
      } catch {
        // Preserve original assorted create error if rollback also fails.
      }
    }

    const mappedConflict = mapAssortedConflictError(error);
    if (mappedConflict) {
      return mappedConflict;
    }

    console.warn("[shopping-list-service] createAssortedShoppingListItem failed", {
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

export async function listAssortedShoppingListItems(): Promise<
  OwnerScopeResult<AssortedShoppingListItem[]>
> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();

  try {
    const [assortedRows, memberRows] = await Promise.all([
      listAssortedRows(ownerContext.value.id),
      listAssortedMemberRows(ownerContext.value.id),
    ]);

    const memberMap = buildAssortedMemberMap(memberRows);
    const assortedItems = assortedRows.map((row) => {
      const memberProductIds = memberMap.get(row.id) ?? [];
      return mapAssortedItem(row, memberProductIds);
    });

    return {
      ok: true,
      value: assortedItems,
    };
  } catch (error: unknown) {
    console.warn("[shopping-list-service] listAssortedShoppingListItems failed", {
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

export async function listShoppingListItems(): Promise<OwnerScopeResult<ShoppingListItem[]>> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  const db = getDb();

  try {
    const standardRowsPromise = db.getAllAsync<ShoppingListItemRow>(
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

    const [standardRows, assortedRows, assortedMemberRows] = await Promise.all([
      standardRowsPromise,
      listAssortedRows(ownerContext.value.id),
      listAssortedMemberRows(ownerContext.value.id),
    ]);

    const standardItems = standardRows.map((row) =>
      mapStandardItem(row, { includeItemType: true }),
    );
    const assortedMemberMap = buildAssortedMemberMap(assortedMemberRows);
    const assortedItems = assortedRows.map((row) => {
      const memberProductIds = assortedMemberMap.get(row.id) ?? [];
      return mapAssortedItem(row, memberProductIds);
    });

    const allItems: ShoppingListItem[] = [...standardItems, ...assortedItems];
    allItems.sort((a, b) => {
      if (b.createdAtMs !== a.createdAtMs) {
        return b.createdAtMs - a.createdAtMs;
      }
      return b.id - a.id;
    });

    return { ok: true, value: allItems };
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
): Promise<OwnerScopeResult<StandardShoppingListItem>> {
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

    return { ok: true, value: mapStandardItem(updated) };
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

export async function updateAssortedShoppingListItem(
  input: UpdateAssortedShoppingListItemInput,
): Promise<OwnerScopeResult<AssortedShoppingListItem>> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  const db = getDb();
  const normalizedName = normalizeAssortedName(input.name);
  if (!normalizedName) {
    return invalidInputError(ASSORTED_NAME_INVALID_MESSAGE);
  }

  const invalidPricing = validatePricing(input.quantity, input.unitPriceCents);
  if (invalidPricing) {
    return invalidPricing;
  }

  const existing = await findAssortedItem(input.itemId);
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

  const hasBundleInput =
    input.bundleQty !== undefined || input.bundlePriceCents !== undefined;
  const providedBundlePricing = hasBundleInput
    ? validateBundlePricing(input.bundleQty, input.bundlePriceCents)
    : null;
  if (providedBundlePricing?.invalid) {
    return providedBundlePricing.invalid;
  }

  const normalizedMemberProductIds = normalizeAssortedMembers(input.memberProductIds);
  if (!normalizedMemberProductIds) {
    return invalidInputError(ASSORTED_MEMBERS_INVALID_MESSAGE);
  }

  const memberValidationError = await validateAssortedMemberProducts(
    ownerContext.value.id,
    normalizedMemberProductIds,
  );
  if (memberValidationError) {
    return memberValidationError;
  }

  const bundlePricing = providedBundlePricing ?? {
    bundleQty: existing.bundle_qty ?? null,
    bundlePriceCents: existing.bundle_price_cents ?? null,
    invalid: null,
  };

  const nowMs = input.nowMs ?? Date.now();
  let inTransaction = false;
  try {
    await db.runAsync("BEGIN IMMEDIATE TRANSACTION;");
    inTransaction = true;

    await db.runAsync(
      `UPDATE ${SHOPPING_LIST_ASSORTED_ITEM_TABLE}
       SET name = ?,
           quantity = ?,
           unit_price_cents = ?,
           bundle_qty = ?,
           bundle_price_cents = ?,
           updated_at_ms = ?
       WHERE id = ? AND owner_id = ?;`,
      normalizedName,
      input.quantity,
      input.unitPriceCents,
      bundlePricing.bundleQty,
      bundlePricing.bundlePriceCents,
      nowMs,
      input.itemId,
      ownerContext.value.id,
    );

    await db.runAsync(
      `DELETE FROM ${SHOPPING_LIST_ASSORTED_MEMBER_TABLE}
       WHERE assorted_item_id = ? AND owner_id = ?;`,
      input.itemId,
      ownerContext.value.id,
    );

    for (const memberProductId of normalizedMemberProductIds) {
      await db.runAsync(
        `INSERT INTO ${SHOPPING_LIST_ASSORTED_MEMBER_TABLE} (
           owner_id, assorted_item_id, product_id, created_at_ms
         ) VALUES (?, ?, ?, ?);`,
        ownerContext.value.id,
        input.itemId,
        memberProductId,
        nowMs,
      );
    }

    await db.runAsync("COMMIT;");
    inTransaction = false;

    const updated = await findAssortedItem(input.itemId);
    if (!updated) {
      return {
        ok: false,
        error: {
          code: "OWNER_SCOPE_NOT_FOUND",
          message: OWNER_SCOPE_NOT_FOUND_MESSAGE,
        },
      };
    }

    const memberProductIds = await findAssortedMembers(input.itemId, ownerContext.value.id);
    return {
      ok: true,
      value: mapAssortedItem(updated, memberProductIds),
    };
  } catch (error: unknown) {
    if (inTransaction) {
      try {
        await db.runAsync("ROLLBACK;");
      } catch {
        // Preserve original assorted update error if rollback also fails.
      }
    }

    const mappedConflict = mapAssortedConflictError(error);
    if (mappedConflict) {
      return mappedConflict;
    }

    console.warn("[shopping-list-service] updateAssortedShoppingListItem failed", {
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
