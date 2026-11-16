import { isAxiosError } from "axios";
import { api } from "./client";

export type Quotation = {
  id: number;
  source: "item" | "cart";
  status: "pending" | "accepted" | "rejected" | "ready_to_pay" | "ordered";
  currency_code: string;
  subtotal: number;
  remark: string | null;
  created_at: string;
  order_slug: string | null;
  payment_order_slug?: string | null;
};

export type QuotationDetail = Quotation & {
  items: {
    product_id: number;
    title: string;
    variant_title: string;
    quantity: number;
    unit_price: string;
    addons: { addon_item_id: number; price: string; metadata?: { item_title?: string } }[];
  }[];
};

export type QuotationSourceLine = { quantity: number; label: string } & (
  | { cart_item_id: number }
  | {
      product_variant_id: number;
      store_id: number;
      addons?: { addon_group_id: number; addon_item_id: number }[];
    }
);

type QuotationPreview = {
  totals: Record<
    "items_total" | "tax_total" | "total_delivery_charges" | "platform_fee" | "pending_charges_total" | "payable_amount",
    number
  >;
  currency_code: string;
  pricing_review_token: string;
  attachments: { product_id: number; title: string; required: boolean }[];
};

export const quotationLabels: Record<Quotation["status"], string> = {
  pending: "Pending review",
  accepted: "Accepted",
  rejected: "Rejected",
  ready_to_pay: "Ready to pay",
  ordered: "Ordered",
};

export const quoteMoney = (amount: number | string, currency: string) =>
  new Intl.NumberFormat(undefined, { style: "currency", currency }).format(Number(amount));

export function quotationError(error: unknown) {
  if (isAxiosError<{ message?: string; errors?: Record<string, string[]> }>(error)) {
    const data = error.response?.data;
    return Object.values(data?.errors ?? {})[0]?.[0] ?? data?.message ?? "Quotation request failed. Try again.";
  }
  return "Quotation request failed. Try again.";
}

export async function getQuotationCurrency() {
  const { data } = await api.get<{ currency_code: string }>("/user/quotations/currency");
  return data.currency_code;
}

export async function submitQuotation(
  source: Quotation["source"],
  currency: string,
  lines: QuotationSourceLine[],
  prices: string[],
) {
  const items = lines.map((line, index) => ({
    ...("cart_item_id" in line
      ? { cart_item_id: line.cart_item_id }
      : { product_variant_id: line.product_variant_id, store_id: line.store_id, addons: line.addons }),
    quantity: line.quantity,
    unit_price: prices[index],
  }));
  const { data } = await api.post<Quotation>("/user/quotations", { source, currency_code: currency, items });
  return data;
}

export async function getQuotations(page: number) {
  const { data } = await api.get<{ data: Quotation[]; current_page: number; last_page: number }>("/user/quotations", { params: { page } });
  return data;
}

export async function getQuotation(id: string) {
  const { data } = await api.get<QuotationDetail>(`/user/quotations/${id}`);
  return data;
}

export async function previewQuotation(id: string, addressId: number) {
  const { data } = await api.post<QuotationPreview | { order_slug: string }>(
    `/user/quotations/${id}/preview`,
    { address_id: addressId },
  );
  return data;
}

export async function payQuotation(id: string, body: FormData) {
  const { data } = await api.post<{ order_slug: string }>(`/user/quotations/${id}/pay`, body);
  return data;
}
