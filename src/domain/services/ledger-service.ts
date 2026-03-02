import { bootstrapDatabase, getDb } from "@/db/db";
import { PAYMENT_TABLE, PURCHASE_TABLE, SHOPPER_TABLE } from "@/db/schema";
import {
  type OwnerScopeResult,
  invalidInputError,
  OWNER_SCOPE_MISMATCH_MESSAGE,
  OWNER_SCOPE_NOT_FOUND_MESSAGE,
  OWNER_SCOPE_UNAVAILABLE_MESSAGE,
  getSafeErrorReason,
  requireActiveOwnerContext,
} from "@/domain/services/owner-scope";

type ShopperOwnerRow = {
  owner_id: number;
};

type PurchaseRow = {
  id: number;
  owner_id: number;
  shopper_id: number;
  total_cents: number;
  created_at_ms: number;
};

type PaymentRow = {
  id: number;
  owner_id: number;
  shopper_id: number;
  amount_cents: number;
  created_at_ms: number;
};

type LedgerHistoryRow = {
  kind: "purchase" | "payment";
  id: number;
  shopper_id: number;
  amount_cents: number;
  created_at_ms: number;
};

export type Purchase = {
  id: number;
  ownerId: number;
  shopperId: number;
  totalCents: number;
  createdAtMs: number;
};

export type Payment = {
  id: number;
  ownerId: number;
  shopperId: number;
  amountCents: number;
  createdAtMs: number;
};

export type LedgerHistoryItem = {
  kind: "purchase" | "payment";
  id: number;
  shopperId: number;
  amountCents: number;
  createdAtMs: number;
};

export type RecordPurchaseInput = {
  shopperId: number;
  totalCents: number;
  nowMs?: number;
};

export type RecordPaymentInput = {
  shopperId: number;
  amountCents: number;
  nowMs?: number;
};

const LEDGER_PURCHASE_INVALID_MESSAGE =
  "Purchase total must be a positive integer amount.";
const LEDGER_PAYMENT_INVALID_MESSAGE =
  "Payment amount must be a positive integer amount.";

function mapPurchase(row: PurchaseRow): Purchase {
  return {
    id: row.id,
    ownerId: row.owner_id,
    shopperId: row.shopper_id,
    totalCents: row.total_cents,
    createdAtMs: row.created_at_ms,
  };
}

function mapPayment(row: PaymentRow): Payment {
  return {
    id: row.id,
    ownerId: row.owner_id,
    shopperId: row.shopper_id,
    amountCents: row.amount_cents,
    createdAtMs: row.created_at_ms,
  };
}

async function findShopperOwner(shopperId: number) {
  const db = getDb();
  return db.getFirstAsync<ShopperOwnerRow>(
    `SELECT owner_id FROM ${SHOPPER_TABLE} WHERE id = ? LIMIT 1;`,
    shopperId,
  );
}

function validatePositiveMoney(
  value: number,
  message: string,
): OwnerScopeResult<never> | null {
  if (!Number.isInteger(value) || value <= 0) {
    return invalidInputError(message);
  }

  return null;
}

export async function recordPurchase(
  input: RecordPurchaseInput,
): Promise<OwnerScopeResult<Purchase>> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  const db = getDb();
  const invalidAmount = validatePositiveMoney(
    input.totalCents,
    LEDGER_PURCHASE_INVALID_MESSAGE,
  );
  if (invalidAmount) {
    return invalidAmount;
  }

  const shopperOwner = await findShopperOwner(input.shopperId);
  if (!shopperOwner) {
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_NOT_FOUND",
        message: OWNER_SCOPE_NOT_FOUND_MESSAGE,
      },
    };
  }

  if (shopperOwner.owner_id !== ownerContext.value.id) {
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_MISMATCH",
        message: OWNER_SCOPE_MISMATCH_MESSAGE,
      },
    };
  }

  try {
    const nowMs = input.nowMs ?? Date.now();
    const insertResult = await db.runAsync(
      `INSERT INTO ${PURCHASE_TABLE} (
         owner_id, shopper_id, total_cents, created_at_ms
       ) VALUES (?, ?, ?, ?);`,
      ownerContext.value.id,
      input.shopperId,
      input.totalCents,
      nowMs,
    );

    const created = await db.getFirstAsync<PurchaseRow>(
      `SELECT id, owner_id, shopper_id, total_cents, created_at_ms
       FROM ${PURCHASE_TABLE}
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
    return { ok: true, value: mapPurchase(created) };
  } catch (error: unknown) {
    console.warn("[ledger-service] recordPurchase failed", {
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

export async function recordPayment(
  input: RecordPaymentInput,
): Promise<OwnerScopeResult<Payment>> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  const db = getDb();
  const invalidAmount = validatePositiveMoney(
    input.amountCents,
    LEDGER_PAYMENT_INVALID_MESSAGE,
  );
  if (invalidAmount) {
    return invalidAmount;
  }

  const shopperOwner = await findShopperOwner(input.shopperId);
  if (!shopperOwner) {
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_NOT_FOUND",
        message: OWNER_SCOPE_NOT_FOUND_MESSAGE,
      },
    };
  }

  if (shopperOwner.owner_id !== ownerContext.value.id) {
    return {
      ok: false,
      error: {
        code: "OWNER_SCOPE_MISMATCH",
        message: OWNER_SCOPE_MISMATCH_MESSAGE,
      },
    };
  }

  try {
    const nowMs = input.nowMs ?? Date.now();
    const insertResult = await db.runAsync(
      `INSERT INTO ${PAYMENT_TABLE} (
         owner_id, shopper_id, amount_cents, created_at_ms
       ) VALUES (?, ?, ?, ?);`,
      ownerContext.value.id,
      input.shopperId,
      input.amountCents,
      nowMs,
    );

    const created = await db.getFirstAsync<PaymentRow>(
      `SELECT id, owner_id, shopper_id, amount_cents, created_at_ms
       FROM ${PAYMENT_TABLE}
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
    return { ok: true, value: mapPayment(created) };
  } catch (error: unknown) {
    console.warn("[ledger-service] recordPayment failed", {
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

export async function listPurchases(): Promise<OwnerScopeResult<Purchase[]>> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  const db = getDb();

  try {
    const rows = await db.getAllAsync<PurchaseRow>(
      `SELECT id, owner_id, shopper_id, total_cents, created_at_ms
       FROM ${PURCHASE_TABLE}
       WHERE owner_id = ?
       ORDER BY created_at_ms DESC, id DESC;`,
      ownerContext.value.id,
    );
    return { ok: true, value: rows.map(mapPurchase) };
  } catch (error: unknown) {
    console.warn("[ledger-service] listPurchases failed", {
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

export async function listPayments(): Promise<OwnerScopeResult<Payment[]>> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  const db = getDb();

  try {
    const rows = await db.getAllAsync<PaymentRow>(
      `SELECT id, owner_id, shopper_id, amount_cents, created_at_ms
       FROM ${PAYMENT_TABLE}
       WHERE owner_id = ?
       ORDER BY created_at_ms DESC, id DESC;`,
      ownerContext.value.id,
    );
    return { ok: true, value: rows.map(mapPayment) };
  } catch (error: unknown) {
    console.warn("[ledger-service] listPayments failed", {
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

export async function listLedgerHistory(): Promise<
  OwnerScopeResult<LedgerHistoryItem[]>
> {
  const ownerContext = requireActiveOwnerContext();
  if (!ownerContext.ok) {
    return ownerContext;
  }

  await bootstrapDatabase();
  const db = getDb();

  try {
    const rows = await db.getAllAsync<LedgerHistoryRow>(
      `SELECT kind, id, shopper_id, amount_cents, created_at_ms
       FROM (
         SELECT 'purchase' AS kind, id, shopper_id, total_cents AS amount_cents, created_at_ms
         FROM ${PURCHASE_TABLE}
         WHERE owner_id = ?
         UNION ALL
         SELECT 'payment' AS kind, id, shopper_id, amount_cents, created_at_ms
         FROM ${PAYMENT_TABLE}
         WHERE owner_id = ?
       )
       ORDER BY created_at_ms DESC, id DESC;`,
      ownerContext.value.id,
      ownerContext.value.id,
    );

    return {
      ok: true,
      value: rows.map((row) => ({
        kind: row.kind,
        id: row.id,
        shopperId: row.shopper_id,
        amountCents: row.amount_cents,
        createdAtMs: row.created_at_ms,
      })),
    };
  } catch (error: unknown) {
    console.warn("[ledger-service] listLedgerHistory failed", {
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
