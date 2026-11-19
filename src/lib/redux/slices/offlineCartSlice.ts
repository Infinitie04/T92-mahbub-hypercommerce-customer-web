import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { stockLimit } from "@/helpers/stock";
import type { ProductPricingGroup } from "@/types/catalog";

export type OfflineCartItem = {
  id: string;
  name: string;
  image?: string;
  slug?: string;
  price: number;
  pricingGroup?: ProductPricingGroup;
  quantity: number;
  storeName?: string;
  storeSlug?: string;
  minQuantity: number;
  maxQuantity: number;
  stepSize: number;
  stock: number | null;
  product_variant_id: number;
  store_id: number;
  addons?: {
    addon_group_id: number;
    addon_item_id: number;
    title: string;
    price: number;
  }[];
};

export type OfflineCartState = {
  items: OfflineCartItem[];
  subtotal: number;
  totalQuantity: number;
};

const initialState: OfflineCartState = {
  items: [],
  subtotal: 0,
  totalQuantity: 0,
};

export const offlineUnitPrice = (item: OfflineCartItem, items: OfflineCartItem[]): number => {
  if (!item.pricingGroup) return item.price;

  const quantity = items.reduce(
    (total, line) => line.pricingGroup?.id === item.pricingGroup?.id ? total + line.quantity : total,
    0,
  );
  const tier = item.pricingGroup.tiers.reduce<(typeof item.pricingGroup.tiers)[number] | undefined>(
    (best, candidate) => candidate.min_quantity <= quantity &&
      (!best || candidate.min_quantity > best.min_quantity) ? candidate : best,
    undefined,
  );
  return tier?.unit_price ?? item.pricingGroup.tiers[0]?.unit_price ?? item.price;
};

const recalculateSummary = (items: OfflineCartItem[]) => {
  const summary = items.reduce(
    (acc, item) => {
      const addonTotal = (item.addons || []).reduce(
        (sum, addon) => sum + (addon.price || 0),
        0
      );
      acc.subtotal += (offlineUnitPrice(item, items) + addonTotal) * item.quantity;
      acc.totalQuantity += item.quantity;
      return acc;
    },
    { subtotal: 0, totalQuantity: 0 }
  );

  return summary;
};

const clampQuantity = (item: OfflineCartItem, desiredQuantity: number, items: OfflineCartItem[]) => {
  const minQuantity = item.minQuantity || 1;
  const stepSize = item.stepSize || 1;
  const otherQuantity = items.reduce((sum, line) =>
    line.product_variant_id === item.product_variant_id && line.id !== item.id ? sum + line.quantity : sum, 0);
  const maxQuantity = (item.maxQuantity || Number.MAX_SAFE_INTEGER) - otherQuantity;

  const stock = stockLimit(item.stock, Number.MAX_SAFE_INTEGER);

  if (Math.min(stock, maxQuantity) < minQuantity) return 0;

  let qty = Math.max(
    minQuantity,
    Math.min(desiredQuantity, maxQuantity, stock)
  );

  // Steps run from the minimum, not from zero — a minimum that is not itself a
  // multiple of the step must never be rounded below itself.
  const remainder = (qty - minQuantity) % stepSize;
  if (remainder !== 0) {
    qty = qty - remainder;
    if (qty < minQuantity) {
      qty = minQuantity;
    }
  }

  return qty;
};

const normalizeItem = (item: OfflineCartItem, items: OfflineCartItem[]) => {
  const normalizedQuantity = clampQuantity(item, item.quantity, items);
  return {
    ...item,
    quantity: normalizedQuantity,
  };
};

const offlineCartSlice = createSlice({
  name: "offlineCart",
  initialState,
  reducers: {
    hydrateOfflineCart: (
      state,
      action: PayloadAction<OfflineCartItem[] | undefined>
    ) => {
      state.items = action.payload || [];
      const summary = recalculateSummary(state.items);
      state.subtotal = summary.subtotal;
      state.totalQuantity = summary.totalQuantity;
    },
    setOfflineCart: (state, action: PayloadAction<OfflineCartItem[]>) => {
      state.items = action.payload;
      const summary = recalculateSummary(state.items);
      state.subtotal = summary.subtotal;
      state.totalQuantity = summary.totalQuantity;
    },
    addOfflineCartItem: (state, action: PayloadAction<OfflineCartItem>) => {
      const normalizedPayload = normalizeItem(action.payload, state.items);
      if (!normalizedPayload.quantity) return;
      const existingIndex = state.items.findIndex(
        (item) => item.id === normalizedPayload.id
      );

      if (existingIndex >= 0) {
        const existingItem = state.items[existingIndex];
        const mergedItem = {
          ...existingItem,
          ...normalizedPayload,
        };
        mergedItem.quantity = clampQuantity(
          mergedItem,
          existingItem.quantity + normalizedPayload.quantity,
          state.items
        );
        state.items[existingIndex] = mergedItem;
      } else {
        state.items.push(normalizedPayload);
      }

      const summary = recalculateSummary(state.items);
      state.subtotal = summary.subtotal;
      state.totalQuantity = summary.totalQuantity;
    },
    updateOfflineCartItemQuantity: (
      state,
      action: PayloadAction<{
        id: string;
        quantity: number;
        stepSize?: number;
        minQuantity?: number;
        maxQuantity?: number;
        stock?: number | null;
      }>
    ) => {
      const targetItem = state.items.find(
        (item) => item.id === action.payload.id
      );

      if (targetItem) {
        if (action.payload.stepSize !== undefined)
          targetItem.stepSize = action.payload.stepSize;
        if (action.payload.minQuantity !== undefined)
          targetItem.minQuantity = action.payload.minQuantity;
        if (action.payload.maxQuantity !== undefined)
          targetItem.maxQuantity = action.payload.maxQuantity;
        if (action.payload.stock !== undefined)
          targetItem.stock = action.payload.stock;

        const quantity = clampQuantity(
          targetItem,
          action.payload.quantity,
          state.items
        );
        if (!quantity) return;
        targetItem.quantity = quantity;
        const summary = recalculateSummary(state.items);
        state.subtotal = summary.subtotal;
        state.totalQuantity = summary.totalQuantity;
      }
    },
    removeOfflineCartItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter((item) => item.id !== action.payload);
      const summary = recalculateSummary(state.items);
      state.subtotal = summary.subtotal;
      state.totalQuantity = summary.totalQuantity;
    },
    updateOfflineCartItem: (
      state,
      action: PayloadAction<{
        id: string; // old id
        newItem: OfflineCartItem;
      }>
    ) => {
      const existingIndex = state.items.findIndex(
        (item) => item.id === action.payload.id
      );

      if (existingIndex >= 0) {
        // If the ID changed (due to different addons), we need to check if we should merge or replace
        const otherItems = state.items.filter((item) => item.id !== action.payload.id);
        const nextItem = normalizeItem(action.payload.newItem, otherItems);
        if (!nextItem.quantity) return;
        const nextId = nextItem.id;
        if (nextId !== action.payload.id) {
          // Check if an item with nextId already exists
          const nextIndex = state.items.findIndex((item) => item.id === nextId);
          if (nextIndex >= 0 && nextIndex !== existingIndex) {
            // Merge into existing item
            const mergeTarget = state.items[nextIndex];
            mergeTarget.quantity = clampQuantity(
              mergeTarget,
              mergeTarget.quantity + nextItem.quantity,
              otherItems
            );
            state.items.splice(existingIndex, 1);
          } else {
            // Just update the item at existing index
            state.items[existingIndex] = nextItem;
          }
        } else {
          // IDs match, just update
          state.items[existingIndex] = nextItem;
        }

        const summary = recalculateSummary(state.items);
        state.subtotal = summary.subtotal;
        state.totalQuantity = summary.totalQuantity;
      }
    },
    clearOfflineCart: (state) => {
      state.items = [];
      state.subtotal = 0;
      state.totalQuantity = 0;
    },
  },
});

export const {
  hydrateOfflineCart,
  setOfflineCart,
  addOfflineCartItem,
  updateOfflineCartItemQuantity,
  removeOfflineCartItem,
  updateOfflineCartItem,
  clearOfflineCart,
} = offlineCartSlice.actions;

export default offlineCartSlice.reducer;
