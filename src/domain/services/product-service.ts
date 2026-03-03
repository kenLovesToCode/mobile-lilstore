import { bootstrapDatabase, getDb } from "@/db/db";
import { PRODUCT_TABLE, SHOPPING_LIST_ITEM_TABLE } from "@/db/schema";
import {
  type OwnerScopeResult,
  OWNER_SCOPE_NOT_FOUND_MESSAGE,
  OWNER_SCOPE_UNAVAILABLE_MESSAGE,
  conflictError,
  getSafeErrorReason,
  invalidInputError,
  OWNER_SCOPE_MISMATCH_MESSAGE,
  requireActiveOwnerContext,
} from "@/domain/services/owner-scope";

type ProductRow = {
  id: number;
  owner_id: number;
  name: string;
  barcode: string;
  archived_at_ms: number | null;
  created_at_ms: number;
  updated_at_ms: number;
};

type ProductDependencyCountRow = {
  total: number;
};

export type Product = {
  id: number;
  ownerId: number;
  name: string;
  barcode: string;
  createdAtMs: number;
  updatedAtMs: number;
};

export type CreateProductInput = {
  name: string;
  barcode: string;
  nowMs?: number;
};

export type UpdateProductInput = {
  productId: number;
  name: string;
  barcode: string;
  nowMs?: number;
};

export type ArchiveProductInput = {
  productId: number;
  nowMs?: number;
};

export type DeleteProductInput = {
  productId: number;
};

type ListProductsOptions = {
  includeArchived?: boolean;
};

type DeleteProductResult = {
  deletedProductId: number;
};

function mapProduct(row: ProductRow): Product {
  return {
    id: row.id,
    ownerId: row.owner_id,
    name: row.name,
    barcode: row.barcode,
    createdAtMs: row.created_at_ms,
    updatedAtMs: row.updated_at_ms,
  };
}

function normalizeInput(value: string) {
  return value.trim();
}

const PRODUCT_BARCODE_CONFLICT_MESSAGE =
  "A product with this barcode already exists for the active owner.";
const PRODUCT_INPUT_INVALID_MESSAGE =
  "Product name and barcode are required.";
const PRODUCT_DELETE_DEPENDENCY_CONFLICT_MESSAGE =
  "This product is still used by shopping-list items. Remove those references first, or archive the product instead.";
const PRODUCT_OWNER_BARCODE_UNIQUE_INDEX_NAME = "idx_product_owner_barcode_unique";

function mapConflictError(error: unknown): OwnerScopeResult<never> | null {
  if (!(error instanceof Error)) {
    return null;
  }

  const message = error.message ?? "";
  if (!/UNIQUE constraint failed/i.test(message)) {
    return null;
  }

  const isBarcodeConflict =
    message.includes(PRODUCT_OWNER_BARCODE_UNIQUE_INDEX_NAME) ||
    /lower\(barcode\)/i.test(message) ||
    /\bbarcode\b/i.test(message);

  if (isBarcodeConflict) {
    return conflictError(PRODUCT_BARCODE_CONFLICT_MESSAGE);
  }

  return conflictError();
}

function validateProductInput(name: string, barcode: string): OwnerScopeResult<never> | null {
  if (!name || !barcode) {
    return invalidInputError(PRODUCT_INPUT_INVALID_MESSAGE);
  }

  return null;
}

async function findProductById(productId: number) {
  const db = getDb();
  return db.getFirstAsync<ProductRow>(
    `SELECT id, owner_id, name, barcode, archived_at_ms, created_at_ms, updated_at_ms
     FROM ${PRODUCT_TABLE}
     WHERE id = ?
     LIMIT 1;`,
    productId,
  );
}

async function countProductDependencies(productId: number, ownerId: number) {
  const db = getDb();
  return db.getFirstAsync<ProductDependencyCountRow>(
    `SELECT COUNT(*) AS total
     FROM ${SHOPPING_LIST_ITEM_TABLE}
     WHERE owner_id = ? AND product_id = ?;`,
    ownerId,
    productId,
  );
}

function isForeignKeyConstraintError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }
  return /FOREIGN KEY constraint failed/i.test(error.message ?? "");
}

export async function createProduct(
  input: CreateProductInput,
): Promise<OwnerScopeResult<Product>> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  const db = getDb();
  const nowMs = input.nowMs ?? Date.now();
  const normalizedName = normalizeInput(input.name);
  const normalizedBarcode = normalizeInput(input.barcode);
  const invalidInput = validateProductInput(normalizedName, normalizedBarcode);
  if (invalidInput) {
    return invalidInput;
  }

  try {
    const insertResult = await db.runAsync(
      `INSERT INTO ${PRODUCT_TABLE} (
         owner_id, name, barcode, archived_at_ms, created_at_ms, updated_at_ms
       ) VALUES (?, ?, ?, NULL, ?, ?);`,
      ownerContext.value.id,
      normalizedName,
      normalizedBarcode,
      nowMs,
      nowMs,
    );

    const created = await db.getFirstAsync<ProductRow>(
      `SELECT id, owner_id, name, barcode, archived_at_ms, created_at_ms, updated_at_ms
       FROM ${PRODUCT_TABLE}
       WHERE id = ?
       LIMIT 1;`,
      Number(insertResult.lastInsertRowId),
    );

    if (!created) {
      return {
        ok: false,
        error: {
          code: "OWNER_SCOPE_UNAVAILABLE",
          message: OWNER_SCOPE_UNAVAILABLE_MESSAGE,
        },
      };
    }

    return { ok: true, value: mapProduct(created) };
  } catch (error: unknown) {
    const mapped = mapConflictError(error);
    if (mapped) {
      return mapped;
    }

    console.warn("[product-service] createProduct failed", {
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

export async function listProducts(
  options: ListProductsOptions = {},
): Promise<OwnerScopeResult<Product[]>> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  const db = getDb();

  try {
    const archivedFilter = options.includeArchived ? "" : "AND archived_at_ms IS NULL";
    const rows = await db.getAllAsync<ProductRow>(
      `SELECT id, owner_id, name, barcode, archived_at_ms, created_at_ms, updated_at_ms
       FROM ${PRODUCT_TABLE}
       WHERE owner_id = ?
       ${archivedFilter}
       ORDER BY created_at_ms DESC, id DESC;`,
      ownerContext.value.id,
    );
    return { ok: true, value: rows.map(mapProduct) };
  } catch (error: unknown) {
    console.warn("[product-service] listProducts failed", {
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

export async function getProductById(
  productId: number,
): Promise<OwnerScopeResult<Product>> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  try {
    const row = await findProductById(productId);
    if (!row) {
      return {
        ok: false,
        error: {
          code: "OWNER_SCOPE_NOT_FOUND",
          message: OWNER_SCOPE_NOT_FOUND_MESSAGE,
        },
      };
    }

    if (row.owner_id !== ownerContext.value.id) {
      return {
        ok: false,
        error: {
          code: "OWNER_SCOPE_MISMATCH",
          message: OWNER_SCOPE_MISMATCH_MESSAGE,
        },
      };
    }

    return { ok: true, value: mapProduct(row) };
  } catch (error: unknown) {
    console.warn("[product-service] getProductById failed", {
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

export async function updateProduct(
  input: UpdateProductInput,
): Promise<OwnerScopeResult<Product>> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  const db = getDb();
  const existing = await findProductById(input.productId);
  const normalizedName = normalizeInput(input.name);
  const normalizedBarcode = normalizeInput(input.barcode);
  const invalidInput = validateProductInput(normalizedName, normalizedBarcode);
  if (invalidInput) {
    return invalidInput;
  }

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
      `UPDATE ${PRODUCT_TABLE}
       SET name = ?, barcode = ?, updated_at_ms = ?
       WHERE id = ? AND owner_id = ?;`,
      normalizedName,
      normalizedBarcode,
      input.nowMs ?? Date.now(),
      input.productId,
      ownerContext.value.id,
    );

    const updated = await findProductById(input.productId);
    if (!updated) {
      return {
        ok: false,
        error: {
          code: "OWNER_SCOPE_NOT_FOUND",
          message: OWNER_SCOPE_NOT_FOUND_MESSAGE,
        },
      };
    }

    return { ok: true, value: mapProduct(updated) };
  } catch (error: unknown) {
    const mapped = mapConflictError(error);
    if (mapped) {
      return mapped;
    }

    console.warn("[product-service] updateProduct failed", {
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

export async function archiveProduct(
  input: ArchiveProductInput,
): Promise<OwnerScopeResult<Product>> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  try {
    const db = getDb();
    const existing = await findProductById(input.productId);
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

    const nowMs = input.nowMs ?? Date.now();

    await db.runAsync(
      `UPDATE ${PRODUCT_TABLE}
       SET archived_at_ms = COALESCE(archived_at_ms, ?),
           updated_at_ms = ?
       WHERE id = ? AND owner_id = ?;`,
      nowMs,
      nowMs,
      input.productId,
      ownerContext.value.id,
    );

    const updated = await findProductById(input.productId);
    if (!updated) {
      return {
        ok: false,
        error: {
          code: "OWNER_SCOPE_NOT_FOUND",
          message: OWNER_SCOPE_NOT_FOUND_MESSAGE,
        },
      };
    }

    return { ok: true, value: mapProduct(updated) };
  } catch (error: unknown) {
    console.warn("[product-service] archiveProduct failed", {
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

export async function deleteProduct(
  input: DeleteProductInput,
): Promise<OwnerScopeResult<DeleteProductResult>> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  try {
    const db = getDb();
    const existing = await findProductById(input.productId);
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

    const dependencyCount = await countProductDependencies(
      input.productId,
      ownerContext.value.id,
    );
    if ((dependencyCount?.total ?? 0) > 0) {
      return conflictError(PRODUCT_DELETE_DEPENDENCY_CONFLICT_MESSAGE);
    }

    await db.runAsync(
      `DELETE FROM ${PRODUCT_TABLE}
       WHERE id = ? AND owner_id = ?;`,
      input.productId,
      ownerContext.value.id,
    );
    return {
      ok: true,
      value: {
        deletedProductId: input.productId,
      },
    };
  } catch (error: unknown) {
    if (isForeignKeyConstraintError(error)) {
      return conflictError(PRODUCT_DELETE_DEPENDENCY_CONFLICT_MESSAGE);
    }

    console.warn("[product-service] deleteProduct failed", {
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
