import { bootstrapDatabase, getDb } from "@/db/db";
import { PRODUCT_TABLE } from "@/db/schema";
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
  created_at_ms: number;
  updated_at_ms: number;
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
    `SELECT id, owner_id, name, barcode, created_at_ms, updated_at_ms
     FROM ${PRODUCT_TABLE}
     WHERE id = ?
     LIMIT 1;`,
    productId,
  );
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
         owner_id, name, barcode, created_at_ms, updated_at_ms
       ) VALUES (?, ?, ?, ?, ?);`,
      ownerContext.value.id,
      normalizedName,
      normalizedBarcode,
      nowMs,
      nowMs,
    );

    const created = await db.getFirstAsync<ProductRow>(
      `SELECT id, owner_id, name, barcode, created_at_ms, updated_at_ms
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

export async function listProducts(): Promise<OwnerScopeResult<Product[]>> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  const db = getDb();

  try {
    const rows = await db.getAllAsync<ProductRow>(
      `SELECT id, owner_id, name, barcode, created_at_ms, updated_at_ms
       FROM ${PRODUCT_TABLE}
       WHERE owner_id = ?
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
