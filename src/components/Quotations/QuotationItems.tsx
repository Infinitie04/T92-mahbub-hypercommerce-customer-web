import QuotationThumbnail from "./QuotationThumbnail";
import { useQuotationMoney } from "./quotationPresentation";
import type { QuotationCheckoutErrors, QuotationDetail } from "@/services/quotations";
import { useTranslation } from "react-i18next";

export default function QuotationItems({ quote, issues }: {
  quote: QuotationDetail;
  issues?: QuotationCheckoutErrors["shipping_issues"];
}) {
  const { t } = useTranslation();
  const money = useQuotationMoney(quote.currency_code);

  return (
    <ul className="divide-y divide-divider rounded-large border border-divider bg-content1">
      {quote.items.map((item, index) => (
        <li key={index} className="space-y-2 p-4">
          <div className="flex flex-wrap justify-between gap-2">
            <div className="flex min-w-0 items-center gap-3">
              <QuotationThumbnail src={item.image} />
              <div className="min-w-0">
              <div className="font-semibold">{item.title}</div>
              {item.variant_title !== item.title && <div className="text-sm text-default-600">{item.variant_title}</div>}
              {item.addons.map((addon) => (
                <div key={addon.addon_item_id} className="text-sm text-default-600">
                  {t("quotation.addOn", { name: addon.metadata?.item_title || `#${addon.addon_item_id}`, amount: money(addon.price) })}
                </div>
              ))}
              </div>
            </div>
            <span className="text-sm tabular-nums">{item.quantity} × {money(item.unit_price)}</span>
          </div>
          {issues?.filter((issue) => issue.cart_item_id === index + 1).map((issue) => (
            <p key={issue.reason} role="alert" className="rounded-small bg-danger-50 p-2 text-sm text-danger">{issue.reason}</p>
          ))}
        </li>
      ))}
    </ul>
  );
}
