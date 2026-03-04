import {
  CREATE_SHOPPING_LIST_ASSORTED_ITEM_TABLE_SQL,
  CREATE_SHOPPING_LIST_ITEM_TABLE_SQL,
} from "@/db/schema";

function expectAuditColumnsBeforeBundlePairConstraint(sql: string) {
  const createdAtIndex = sql.indexOf("created_at_ms INTEGER NOT NULL");
  const updatedAtIndex = sql.indexOf("updated_at_ms INTEGER NOT NULL");
  const bundlePairConstraintIndex = sql.indexOf(
    "CHECK (\n    (bundle_qty IS NULL AND bundle_price_cents IS NULL) OR",
  );

  expect(createdAtIndex).toBeGreaterThan(-1);
  expect(updatedAtIndex).toBeGreaterThan(createdAtIndex);
  expect(bundlePairConstraintIndex).toBeGreaterThan(updatedAtIndex);
}

describe("shopping-list schema ordering", () => {
  it("keeps shopping_list_item audit columns before table-level bundle pair check", () => {
    expectAuditColumnsBeforeBundlePairConstraint(
      CREATE_SHOPPING_LIST_ITEM_TABLE_SQL,
    );
  });

  it("keeps shopping_list_assorted_item audit columns before table-level bundle pair check", () => {
    expectAuditColumnsBeforeBundlePairConstraint(
      CREATE_SHOPPING_LIST_ASSORTED_ITEM_TABLE_SQL,
    );
  });
});
