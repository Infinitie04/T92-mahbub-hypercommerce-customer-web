export function parseQuotationId(value: string | string[] | undefined) {
  return typeof value === "string" && /^[1-9][0-9]*$/.test(value) ? value : null;
}

export function quotationCheckoutHref(id: number | string) {
  return `/cart/checkout/?quotation=${encodeURIComponent(id)}`;
}

export function quotationPaymentHref(slug: string, id: number | string) {
  return `/payment/${encodeURIComponent(slug)}/?quotation=${encodeURIComponent(id)}`;
}
