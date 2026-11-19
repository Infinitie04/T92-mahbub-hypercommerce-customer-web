import type { PaymentSummary, SellerShippingCost } from "@/types/cart";
import { isAxiosError } from "axios";
import { api } from "./client";
import { unwrapApiData, type ApiDataResponse } from "./responseData";

export type Quotation = {
  id: number;
  source: "item" | "cart";
  status: "pending" | "accepted" | "rejected" | "ready_to_pay" | "ordered" | "cancelled";
  currency_code: string;
  subtotal: number;
  item_count?: number;
  item_title?: string | null;
  image?: string | null;
  remark: string | null;
  customer_note?: string | null;
  created_at: string;
  order_slug: string | null;
  has_pending_order?: boolean;
};

export type QuotationDetail = Quotation & {
  can_cancel?: boolean;
  cancelled_at?: string | null;
  reviewed_at?: string | null;
  payment_requested_at?: string | null;
  items: {
    product_id: number;
    product_slug?: string | null;
    title: string;
    variant_title: string;
    image?: string | null;
    quantity: number;
    unit_price: string;
    addons: { addon_item_id: number; price: string; metadata?: { item_title?: string } }[];
  }[];
};

export type QuotationSourceLine = { quantity: number; label: string; variantLabel?: string; image?: string | null } & (
  | { cart_item_id: number }
  | {
      product_variant_id: number;
      store_id: number;
      addons?: { addon_group_id: number; addon_item_id: number }[];
    }
);

type QuotationPreview = {
  cod_available: boolean;
  export_proforma: { number: string } | null;
  totals: Record<
    "items_total" | "tax_total" | "total_delivery_charges" | "cod_fee" | "platform_fee" | "pending_charges_total" | "payable_amount",
    number
  >;
  currency_code: string;
  pricing_review_token: string;
  tax_breakdown: PaymentSummary["tax_breakdown"];
  seller_shipping_costs: SellerShippingCost[];
  attachments: { product_id: number; title: string; required: boolean }[];
};

export const QUOTATION_DRAFT_KEY = "t92-quotation-draft";

export type QuotationDraft = {
  source: Quotation["source"];
  userId: string;
  lines: QuotationSourceLine[];
  returnPath: string;
};

export function quotationValidation(error: unknown) {
  type FieldErrors = Record<string, string[]>;
  if (!isAxiosError<{
    message?: string;
    data?: QuotationCheckoutErrors & { errors?: FieldErrors };
    errors?: FieldErrors;
    details?: QuotationCheckoutErrors;
  }>(error)) return;

  const response = error.response?.data;
  if (response) return {
    message: response.message,
    errors: response.data?.errors ?? response.errors,
    details: response.data ?? response.details,
  };
}

export function quotationError(error: unknown, fallback: string) {
  const data = quotationValidation(error);
  return Object.values(data?.errors ?? {})[0]?.[0] ?? data?.message ?? fallback;
}

export type QuotationCheckoutErrors = {
  shipping_issues?: { cart_item_id: number; reason: string }[];
};

export async function getQuotationCurrency() {
  const { data } = await api.get<ApiDataResponse<{ currency_code: string }>>("/user/quotations/currency");
  return unwrapApiData(data).currency_code;
}

export async function submitQuotation(
  source: Quotation["source"],
  currency: string,
  lines: QuotationSourceLine[],
  prices: string[],
  customerNote?: string,
) {
  const items = lines.map((line, index) => ({
    ...("cart_item_id" in line
      ? { cart_item_id: line.cart_item_id }
      : { product_variant_id: line.product_variant_id, store_id: line.store_id, addons: line.addons }),
    quantity: line.quantity,
    unit_price: prices[index],
  }));
  const { data } = await api.post<ApiDataResponse<Quotation>>("/user/quotations", {
    source,
    currency_code: currency,
    items,
    customer_note: customerNote?.trim() || undefined,
  });
  return unwrapApiData(data);
}

export async function getQuotations(page: number) {
  const { data } = await api.get<ApiDataResponse<{ data: Quotation[]; current_page: number; last_page: number }>>(
    "/user/quotations",
    { params: { page } },
  );
  return unwrapApiData(data);
}

export async function requoteQuotation(
  id: number,
  currency: string,
  items: { item_index: number; quantity: number; unit_price: string }[],
  customerNote: string,
) {
  const { data } = await api.post<ApiDataResponse<Quotation>>(`/user/quotations/${id}/requote`, {
    currency_code: currency,
    items,
    customer_note: customerNote.trim() || undefined,
  });
  return unwrapApiData(data);
}

export async function getQuotation(id: string) {
  const { data } = await api.get<ApiDataResponse<QuotationDetail>>(`/user/quotations/${id}`);
  return unwrapApiData(data);
}

export async function cancelQuotation(id: number) {
  const { data } = await api.post<ApiDataResponse<QuotationDetail>>(`/user/quotations/${id}/cancel`);
  return unwrapApiData(data);
}

type QuotationPaymentOrder = {
  payment_method?: string;
  order_slug: string;
  payment_status: "pending" | "completed";
};

export async function previewQuotation(id: string, addressId?: number, paymentType?: string, billingId?: number) {
  const { data } = await api.post<ApiDataResponse<QuotationPreview | QuotationPaymentOrder>>(
    `/user/quotations/${id}/preview`,
    { address_id: addressId, payment_type: paymentType, billing_address_id: billingId },
  );
  return unwrapApiData(data);
}

export async function downloadExportProforma(id: string, addressId: number, paymentType: string, billingId?: number) {
  const { data } = await api.post<Blob>(`/user/quotations/${id}/preview`, {
    address_id: addressId, billing_address_id: billingId, payment_type: paymentType, download: true,
  }, { responseType: "blob" });
  const url = URL.createObjectURL(data);
  const link = document.createElement("a");
  link.href = url;
  link.download = `PF-${id}.pdf`;
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function payQuotation(id: string, body: FormData) {
  const { data } = await api.post<ApiDataResponse<QuotationPaymentOrder>>(`/user/quotations/${id}/pay`, body);
  return unwrapApiData(data);
}
