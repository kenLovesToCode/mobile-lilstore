export type LargeFixtureProduct = {
  id: number;
  ownerId: number;
  name: string;
  barcode: string;
  createdAtMs: number;
  updatedAtMs: number;
};

export type LargeFixtureStandardShoppingItem = {
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

export type LargeFixtureAssortedShoppingItem = {
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
};

export type LargeOwnerShoppingFixture = {
  products: LargeFixtureProduct[];
  shoppingItems: LargeFixtureStandardShoppingItem[];
  assortedItems: LargeFixtureAssortedShoppingItem[];
  highlightedProductId: number;
  highlightedShoppingItemId: number;
};

export function createLargeOwnerShoppingFixture(
  ownerId: number,
): LargeOwnerShoppingFixture {
  const products: LargeFixtureProduct[] = [];
  const shoppingItems: LargeFixtureStandardShoppingItem[] = [];

  for (let index = 1; index <= 240; index += 1) {
    const productId = index;
    const createdAtMs = 10_000 + index;
    const isHighlighted = index === 203;
    const name = isHighlighted
      ? "Dragon Fruit Reserve"
      : `Fixture Product ${String(index).padStart(3, "0")}`;
    const barcode = isHighlighted
      ? "DRAGON-203"
      : `FIX-${String(index).padStart(3, "0")}`;

    products.push({
      id: productId,
      ownerId,
      name,
      barcode,
      createdAtMs,
      updatedAtMs: createdAtMs,
    });

    if (index <= 210) {
      const itemId = 5_000 + index;
      shoppingItems.push({
        id: itemId,
        ownerId,
        productId,
        quantity: (index % 9) + 1,
        unitPriceCents: 100 + index,
        bundleQty: index % 5 === 0 ? 3 : null,
        bundlePriceCents: index % 5 === 0 ? 400 + index : null,
        createdAtMs: 20_000 + index,
        updatedAtMs: 20_000 + index,
      });
    }
  }

  const assortedItems: LargeFixtureAssortedShoppingItem[] = [
    {
      id: 9_001,
      ownerId,
      name: "Assorted Citrus Mix",
      quantity: 11,
      unitPriceCents: 455,
      bundleQty: null,
      bundlePriceCents: null,
      memberProductIds: [203, 204, 205],
      memberCount: 3,
      createdAtMs: 45_000,
      updatedAtMs: 45_000,
    },
    {
      id: 9_002,
      ownerId,
      name: "Assorted Snack Pack",
      quantity: 7,
      unitPriceCents: 390,
      bundleQty: 2,
      bundlePriceCents: 650,
      memberProductIds: [150, 151],
      memberCount: 2,
      createdAtMs: 44_900,
      updatedAtMs: 44_900,
    },
  ];

  return {
    products,
    shoppingItems,
    assortedItems,
    highlightedProductId: 203,
    highlightedShoppingItemId: 5_203,
  };
}
