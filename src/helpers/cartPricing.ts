import type { CartItem } from "@/types/cart";

export function cartLineTotal(item: CartItem) {
  return item.total ?? Number(item.total_item_price ?? item.unit_price ?? item.variant.price) * item.quantity;
}
