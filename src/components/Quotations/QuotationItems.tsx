import { quoteMoney, type QuotationDetail } from "@/services/quotations";

export default function QuotationItems({ quote }: { quote: QuotationDetail }) {
  return (
    <ul className="divide-y divide-divider rounded-large border border-divider bg-content1">
      {quote.items.map((item, index) => (
        <li key={index} className="flex flex-wrap justify-between gap-2 p-4">
          <div>
            <div className="font-semibold">{item.title}</div>
            <div className="text-sm text-default-600">{item.variant_title}</div>
            {item.addons.map((addon) => (
              <div key={addon.addon_item_id} className="text-sm text-default-600">
                Add-on {addon.metadata?.item_title || `#${addon.addon_item_id}`} · {quoteMoney(addon.price, quote.currency_code)} each
              </div>
            ))}
          </div>
          <span className="text-sm tabular-nums">
            {item.quantity} × {quoteMoney(item.unit_price, quote.currency_code)}
          </span>
        </li>
      ))}
    </ul>
  );
}
