import { Product } from "@/types/ApiResponse";
import type { ProductPricingTier } from "./catalog";
import type { DeliveryZone } from "./delivery";
import type { MarketFormat } from "./market";

export interface CartApiResponse {
  success: boolean;
  message: string;
  data: CartResponse;
}

export interface CartPricingGroup {
  product_id: number;
  group_id: number;
  name: string;
  quantity: number;
  minimum_order_quantity: number;
  quantity_remaining: number;
  quantity_step_size: number;
  quantity_step_valid: boolean;
  applied_tier: ProductPricingTier | null;
}

export interface CartResponse {
  address_id?: number | string;
  billing_address_id?: number | null;
  third_party_delivery?: boolean;
  pricing_groups?: CartPricingGroup[];
  id: number;
  uuid: string;
  user_id: number;
  items_count: number;
  total_quantity: number;
  items: CartItem[];
  removed_items: {
    product_name: string;
    variant_name: string;
    store_name: string;
    quantity: number;
    reason: string;
  }[];
  removed_count: number;
  payment_summary: PaymentSummary;
  delivery_zone: DeliveryZone;
  created_at: string;
  updated_at: string;
}

export interface FailedCartItem {
  store_id: number;
  product_variant_id: number;
  quantity?: number;
  // The panel returns the full product resource here (CartService::syncCart).
  product: Product;
  product_name?: string;
  product_image?: string;
  variant_name?: string;
  store_name?: string;
  reason: string;
}

export interface CartSyncData {
  cart: CartResponse | null;
  synced_items: {
    store_id: number;
    product_variant_id: number;
    quantity: number;
    product: {
      id: number;
      store_id: number;
      sku: string;
      price: number;
      cost: string;
      stock: number | null;
    };
  }[];
  failed_items: FailedCartItem[];
}

export interface CartItemAddon {
  id?: number;
  addon_group_id: number;
  addon_item_id: number;
  price: number;
  /** Flat labels — the offline cart and the addon-picker payload carry these. */
  title?: string;
  addon_group_name?: string;
  /** Nested labels — the server cart/order payload carries these instead. */
  group?: { id: number; title: string } | null;
  item?: { id: number; title: string; price?: number } | null;
}

export interface CartItem {
  pricing_group_id?: number | null;
  unit_price?: number;
  quotation_unit_price?: number | null;
  id: number;
  cart_id: number;
  product_id: number;
  product_variant_id: number;
  store_id: number;
  quantity: number;
  save_for_later: boolean;
  product: {
    id: number;
    name: string | null;
    slug: string;
    image: string;
    minimum_order_quantity: number;
    quantity_step_size: number;
    total_allowed_quantity: number;
    is_attachment_required?: boolean;
    attachment_mode?: string;
    /** Distance-based quick ETA in minutes (may be null when no location). */
    estimated_delivery_time?: number | null;
  };
  variant: {
    id: number;
    title: string;
    slug: string;
    image: string;
    price: string | number;
    stock: number | null;
    sku: string;
    is_addons?: boolean;
    variant?: string[];
    /** Structured option map for variant products, e.g. { finish: "Walnut" }. */
    attributes?: Record<string, string> | null;
  };
  store: {
    id: number;
    name: string;
    slug: string;
    total_products: number;
    status: {
      is_open: boolean;
      status: string;
    };
  };
  /** Zone/country-based delivery window computed by the backend (CartService). */
  delivery_eta?: {
    min: number | null;
    max: number | null;
    unit: string;
  } | null;
  addons?: CartItemAddon[];
  /** Addon line total, in the active market's currency. */
  addons_total?: number;
  addons_total_base?: number;
  /** Payable line total: effective unit price × quantity + addons. */
  total?: number;
  total_item_price?: number;
  created_at: string;
  updated_at: string;
}

export interface SellerShippingItem {
  cart_item_id: number;
  product_name: string;
  is_fulfillable: boolean;
  unfulfillable_reason: string | null;
  unfulfillable_code?: string | null;
  shipping_rate: number | null;
  location_id: number | null;
  location_name: string | null;
  shipping_zone_id: number | null;
}

export interface SeaFreight {
  status: "quote_required" | "calculated" | "confirmed";
  estimated_amount?: number | null;
  containers?: { name: string; count: number }[];
  delivery_note?: string | null;
  additional_charges?: { title: string; amount: number }[];
}

export interface ShippingBreakdown {
  shipping_type?: "courier" | "air" | "sea";
  sea_freight?: SeaFreight;
  additional_charges?: { title: string; amount: number }[];
}

export interface SellerShippingCost extends ShippingBreakdown {
  store_id: number;
  store_name: string;
  shipping_cost: number | null;
  is_fulfillable: boolean;
  items: SellerShippingItem[];
  delivery_eta?: CartItem["delivery_eta"];
}

export interface PendingCharge {
  id: number;
  amount: number;
  reason: string;
  reason_note: string | null;
  seller_order_id: number | null;
}

export interface TaxBreakdownLine {
  tax_rate_id: number;
  title: string;
  rate: number;
  amount: number;
}

export interface PaymentSummary {
  checkout_display?: {
    show_savings: boolean;
    show_shipping_details: boolean;
  };
  pricing_available?: boolean;
  pricing_review_token?: string | null;
  item_issues?: CartItemIssue[];
  items_total: number;
  total_saving: number;
  cod_available: boolean;
  eligible_cod_fee?: number;
  platform_fee: number;
  cod_fee: number;
  additional_charges_total: number;
  delivery_charges: number;
  use_wallet: boolean;
  promo_code: string;
  promo_discount: number;
  promo_applied: PromoCode | [];
  promo_error: string | null;
  wallet_balance: number;
  wallet_amount_used: number;
  payable_amount: number;
  order_total: number;
  seller_shipping_costs: SellerShippingCost[];
  pending_charges: PendingCharge[];
  pending_charges_total: number;
  tax_breakdown: TaxBreakdownLine[];
  tax_total: number;
  minimum_cart_amount: number;
  currency_code: string;
  currency_symbol: string;
  format?: MarketFormat;
}

export interface CartItemIssue {
  cart_item_id: number;
  reason: string;
}

export interface PromoCode {
  id: number;
  code: string;
  description: string;
  start_date: string;
  end_date: string;
  discount_type: "flat" | "percent" | "free_shipping";
  discount_amount: string;
  promo_mode: "instant" | "cashback";
  usage_count: number;
  individual_use: number;
  max_total_usage: number;
  max_usage_per_user: number;
  min_order_total: string;
  max_discount_value: string;
  /** Market-converted, pre-formatted discount from the backend (e.g. "₹1,660.00" or "20.00%"). */
  formatted_discount?: string;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

// Delivery Zone
