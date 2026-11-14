import { useSettings } from "@/contexts/SettingsContext";
import type { ProductPricingGroup } from "@/types/catalog";
import { useTranslation } from "react-i18next";

export default function WholesaleTiers({ group }: { group?: ProductPricingGroup }) {
  const { formatPrice } = useSettings();
  const { t } = useTranslation();

  if (!group) return null;

  return (
    <div className="space-y-2 rounded-medium border border-divider p-3">
      <h3 className="text-sm font-semibold">{group.name}</h3>
      <p className="text-sm text-foreground/70">
        {t("wholesale.groupMinimum", {
          count: group.minimum_order_quantity,
          defaultValue: "Mix variants in this group. Minimum {{count}} units.",
        })}
      </p>
      <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-1 text-sm">
        {group.tiers.map((tier) => (
          <div key={tier.min_quantity} className="contents">
            <dt>{t("wholesale.tierQuantity", { quantity: tier.min_quantity, defaultValue: "{{quantity}}+ units" })}</dt>
            <dd className="text-end font-semibold">
              {t("wholesale.unitPrice", {
                price: tier.formatted || formatPrice(tier.unit_price),
                defaultValue: "{{price}} per unit",
              })}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
