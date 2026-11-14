import { useSettings } from "@/contexts/SettingsContext";
import type { ProductPricingGroup } from "@/types/catalog";
import { useTranslation } from "react-i18next";

export default function WholesaleTiers({
  group,
  quantity,
  showMinimum = true,
}: {
  group?: ProductPricingGroup;
  quantity?: number;
  showMinimum?: boolean;
}) {
  const { formatPrice } = useSettings();
  const { t } = useTranslation();

  if (!group?.tiers.length) return null;

  const tiers = [...group.tiers].sort((a, b) => a.min_quantity - b.min_quantity);

  return (
    <div className="space-y-2">
      {showMinimum && <p className="text-sm text-foreground/70">
        {t("wholesale.groupMinimum", {
          count: group.minimum_order_quantity,
          defaultValue: "Mix variants in this group. Minimum {{count}} units.",
        })}
      </p>}
      <ul className="grid grid-cols-[repeat(auto-fit,minmax(5.6rem,1fr))] gap-x-4 gap-y-3">
        {tiers.map((tier, index) => {
          const next = tiers[index + 1];
          const active = quantity !== undefined && quantity >= tier.min_quantity &&
            (!next || quantity < next.min_quantity);
          const range = next
            ? `${tier.min_quantity}–${next.min_quantity - 1}`
            : `≥${tier.min_quantity}`;

          return (
            <li key={tier.min_quantity} aria-current={active ? "true" : undefined} className="space-y-0.5">
              <p className={`break-words text-lg font-bold leading-tight tracking-tight tabular-nums sm:text-[1.35rem] ${active ? "text-red-600 dark:text-red-400" : "text-foreground"}`}>
                {tier.formatted || formatPrice(tier.unit_price)}
              </p>
              <p className="text-xs text-foreground/60">
                {t("wholesale.pieceRange", "{{range}} pieces", { range })}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
