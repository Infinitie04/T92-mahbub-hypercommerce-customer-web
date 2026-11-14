import type { ProductPricingGroup } from "./catalog";

export interface Wishlist {
  id: number;
  title: string;
  slug: string;
  items_count: number;
  items: WishlistItem[];
  created_at: string;
  updated_at: string;
}

export interface WishlistItem {
  id: number;
  wishlist_id: number;
  product: {
    id: number;
    title: string;
    slug: string;
    image: string;
    short_description: string;
    pricing_groups?: ProductPricingGroup[];
    minimum_order_quantity: number;
    quantity_step_size: number;
    total_allowed_quantity: number;
  };
  variant: {
    id: number;
    sku: string | null;
    image: string;
    price: number | null;
    pricing_group_id?: number | null;
    formatted?: string | null;
    stock: number | null;
    is_in_stock: boolean;
  };
  store: {
    id: number;
    name: string;
    slug: string;
  };
  created_at: string;
  updated_at: string;
}

export interface WishTitle {
  id: number;
  title: string;
  slug: string;
  items_count: number;
  created_at: string;
}

// FAQs
