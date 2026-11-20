import { formatDeliveryByDate } from "@/helpers/delivery";
import type { PaymentSummary, SellerShippingCost, ShippingBreakdown } from "@/types/cart";
import Link from "next/link";
import { useTranslation } from "react-i18next";

type FormatPrice = (amount: number | string | null | undefined) => string;

export function ShippingChargeDetails({ shipping, total, formatPrice }: {
  shipping: ShippingBreakdown;
  total: number;
  formatPrice: FormatPrice;
}) {
  const { t } = useTranslation();
  if (!shipping.shipping_type) return null;

  const charges = shipping.additional_charges ?? [];
  const base = Math.max(0, total - charges.reduce((sum, charge) => sum + charge.amount, 0));

  return (
    <div className="space-y-1 text-xs text-default-600">
      <p>{t(`checkout.shippingType.${shipping.shipping_type}`)}</p>
      {charges.length > 0 && (
        <ul className="space-y-1 ps-2">
          <li className="flex justify-between gap-2">
            <span>{t("checkout.baseFreight")}</span>
            <span>{formatPrice(base)}</span>
          </li>
          {charges.map(({ title, amount }) => (
            <li key={title} className="flex justify-between gap-2">
              <span className="break-words">{title}</span>
              <span className="shrink-0">{formatPrice(amount)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CheckoutShipping({ shipments, formatPrice, itemLink }: {
  shipments: SellerShippingCost[];
  formatPrice: FormatPrice;
  itemLink?: (id: number) => string;
}) {
  const { t } = useTranslation();
  if (!shipments.length) return null;

  return (
    <div className="space-y-1 rounded-lg bg-content2 p-2 text-xs">
      {shipments.map((store) => {
        const eta = store.is_fulfillable
          ? formatDeliveryByDate(store.delivery_eta)
          : null;

        return (
          <div key={store.store_id} className="space-y-1">
            <div className="flex justify-between gap-2">
              <span className="text-foreground/80">{store.store_name}</span>
              {store.is_fulfillable ? (
                <span>
                  {store.shipping_cost === 0
                    ? t("checkout.freeShipping")
                    : formatPrice(store.shipping_cost ?? 0)}
                </span>
              ) : (
                <span className="text-danger">
                  {t("checkout.notAvailable", { defaultValue: "Not available" })}
                </span>
              )}
            </div>
            {store.is_fulfillable && (
              <ShippingChargeDetails shipping={store} total={store.shipping_cost ?? 0} formatPrice={formatPrice} />
            )}
            {eta && (
              <p className="text-foreground/60">
                {t("cart.deliveryBy", { date: eta, defaultValue: `Delivery by ${eta}` })}
              </p>
            )}
            {store.items?.filter((item) => !item.is_fulfillable).map((item) => (
              <div key={item.cart_item_id} className="rounded border border-danger/20 p-2">
                <p className="font-medium">{item.product_name}</p>
                <p className="text-danger">
                  {item.unfulfillable_reason ||
                    t("checkout.notAvailable", { defaultValue: "Not available" })}
                </p>
                {itemLink && (
                  <Link className="text-primary underline" href={itemLink(item.cart_item_id)}>
                    {t("checkout.editCartItem", { defaultValue: "Edit item" })}
                  </Link>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export function CheckoutTax({ total, breakdown, formatPrice }: {
  total: number;
  breakdown: PaymentSummary["tax_breakdown"];
  formatPrice: FormatPrice;
}) {
  const { t } = useTranslation();
  if (total <= 0) return null;

  return (
    <>
      <div className="flex justify-between text-foreground/80">
        <span>
          {t("checkout.taxIncluded", {
            defaultValue: "Tax (included)",
          })}
        </span>
        <span>{formatPrice(total)}</span>
      </div>
      {breakdown?.map((tax) => (
        <div
          key={tax.tax_rate_id}
          className="flex justify-between ps-2 text-xs text-default-600"
        >
          <span>
            {tax.title} ({tax.rate}%)
          </span>
          <span>{formatPrice(tax.amount)}</span>
        </div>
      ))}
    </>
  );
}
