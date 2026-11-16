import { useSettings } from "@/contexts/SettingsContext";
import { formatCurrency } from "@/helpers/currency";
import type { Quotation } from "@/services/quotations";

export const quotationStatusColors = {
  pending: "warning",
  accepted: "success",
  rejected: "danger",
  ready_to_pay: "primary",
  ordered: "success",
  cancelled: "default",
} as const satisfies Record<Quotation["status"], string>;

export function useQuotationMoney(currency?: string) {
  const settings = useSettings();

  return (amount: number | string | null | undefined) => {
    if (currency && currency === settings.currency) return settings.formatPrice(amount);
    const symbol = settings.systemSettings?.currency === currency
      ? settings.systemSettings?.currencySymbol
      : currency && `${currency} `;
    return formatCurrency(amount, symbol);
  };
}
