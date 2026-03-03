import {
  type LedgerHistoryItem,
  type Payment,
  type Purchase,
  listLedgerHistory,
  listPayments,
  listPurchases,
  recordPayment,
  recordPurchase,
} from "@/domain/services/ledger-service";
import {
  archiveProduct,
  createProduct,
  deleteProduct,
  getProductById,
  listProducts,
  restoreProduct,
  updateProduct,
  type Product,
} from "@/domain/services/product-service";
import {
  createShopper,
  getShopperById,
  listShoppers,
  updateShopper,
  type Shopper,
} from "@/domain/services/shopper-service";
import {
  addShoppingListItem,
  listShoppingListItems,
  updateShoppingListItem,
  type ShoppingListItem,
} from "@/domain/services/shopping-list-service";

export type OwnerScopedSnapshot = {
  products: Product[];
  shoppers: Shopper[];
  shoppingList: ShoppingListItem[];
  purchases: Purchase[];
  payments: Payment[];
  history: LedgerHistoryItem[];
};

export async function getOwnerScopedSnapshot() {
  const [products, shoppers, shoppingList, purchases, payments, history] =
    await Promise.all([
      listProducts(),
      listShoppers(),
      listShoppingListItems(),
      listPurchases(),
      listPayments(),
      listLedgerHistory(),
    ]);

  if (!products.ok) {
    return products;
  }
  if (!shoppers.ok) {
    return shoppers;
  }
  if (!shoppingList.ok) {
    return shoppingList;
  }
  if (!purchases.ok) {
    return purchases;
  }
  if (!payments.ok) {
    return payments;
  }
  if (!history.ok) {
    return history;
  }

  return {
    ok: true as const,
    value: {
      products: products.value,
      shoppers: shoppers.value,
      shoppingList: shoppingList.value,
      purchases: purchases.value,
      payments: payments.value,
      history: history.value,
    },
  };
}

export {
  addShoppingListItem,
  archiveProduct,
  createProduct,
  createShopper,
  deleteProduct,
  getProductById,
  getShopperById,
  listProducts,
  recordPayment,
  recordPurchase,
  restoreProduct,
  updateProduct,
  updateShopper,
  updateShoppingListItem,
};
