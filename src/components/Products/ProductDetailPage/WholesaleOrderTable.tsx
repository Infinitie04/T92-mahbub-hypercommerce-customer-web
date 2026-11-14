import { Button, Image, toast } from "@/components/ui";
import { useSettings } from "@/contexts/SettingsContext";
import { handleOfflineAddToCart } from "@/helpers/functionalHelpers";
import { isVariantInStock, stockLimit } from "@/helpers/stock";
import { updateCartData } from "@/helpers/updators";
import type { RootState } from "@/lib/redux/store";
import { addToCart } from "@/services/cart";
import type { Product, ProductVariant } from "@/types/catalog";
import { Icon } from "@iconify/react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

const requestQuantityLimit = 999;

export default function WholesaleOrderTable({
  product,
  onCustomize,
}: {
  product: Product;
  onCustomize: (variant: ProductVariant) => void;
}) {
  const { t } = useTranslation();
  const { formatPrice } = useSettings();
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const cartItems = useSelector((state: RootState) => state.cart.cartData?.items);
  const offlineItems = useSelector((state: RootState) => state.offlineCart.items);
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [isAdding, setIsAdding] = useState(false);
  const submitting = useRef(false);
  const productMaximum = Number(product.total_allowed_quantity) || 0;
  const quantityStep = Math.max(1, Number(product.quantity_step_size) || 1);
  const groupsByVariant = new Map(
    product.variants.map((variant) => [variant.id, variant.pricing_group_id]),
  );
  const bucketItems = (isLoggedIn ? cartItems ?? [] : offlineItems).filter(
    (item) =>
      groupsByVariant.has(item.product_variant_id) &&
      !("save_for_later" in item && item.save_for_later),
  );
  const bucketQuantity = bucketItems.reduce((sum, item) => sum + Number(item.quantity), 0);

  const groups = (product.pricing_groups ?? []).flatMap((group) => {
    const variants = product.variants.filter((variant) => variant.pricing_group_id === group.id);
    if (!variants.length || !group.tiers.length) return [];

    const rows = variants.map((variant) => {
      const quantity = Number(quantities[variant.id] || 0);
      const available = Boolean(variant.store_id) && isVariantInStock(variant);
      const customizable = Boolean(variant.addon_groups?.length);
      const inBucket = bucketItems.reduce((sum, item) =>
        item.product_variant_id === variant.id && item.store_id === variant.store_id
          ? sum + Number(item.quantity)
          : sum, 0);
      const limit = Math.max(0, Math.min(requestQuantityLimit, stockLimit(variant.stock, Infinity) - inBucket));
      return { variant, quantity, available, customizable, limit };
    });
    const selected = rows.reduce((sum, row) => sum + row.quantity, 0);
    const inBucket = bucketItems.reduce((sum, item) =>
      groupsByVariant.get(item.product_variant_id) === group.id
        ? sum + Number(item.quantity)
        : sum, 0);
    const combined = selected + inBucket;
    const tiers = [...group.tiers].sort((a, b) => a.min_quantity - b.min_quantity);
    let activeTier: (typeof tiers)[number] | undefined;
    for (const tier of tiers) {
      if (tier.min_quantity > combined) break;
      activeTier = tier;
    }
    const subtotal = selected * Number((activeTier ?? tiers[0]).unit_price);
    const minimum = Math.max(1, Number(group.minimum_order_quantity) || 1);
    const remaining = Math.max(0, minimum - combined);
    const stepRemainder = Math.max(0, combined - minimum) % quantityStep;
    return { id: group.id, rows, selected, inBucket, subtotal, tiers, activeTier, minimum, remaining, stepRemainder };
  });

  const selectedRows = groups.flatMap((group) => group.rows).filter((row) => row.quantity > 0);
  const totalQuantity = groups.reduce((sum, group) => sum + group.selected, 0);
  const subtotal = groups.reduce((sum, group) => sum + group.subtotal, 0);
  const exceedsMaximum = productMaximum > 0 && bucketQuantity + totalQuantity > productMaximum;
  const invalidQuantity = selectedRows.some(({ available, customizable, quantity, limit }) =>
    !available || customizable || !Number.isSafeInteger(quantity) || quantity > limit,
  );
  const canAdd = totalQuantity > 0 && !exceedsMaximum && !invalidQuantity;

  async function addSelection() {
    if (!canAdd || submitting.current) return;
    submitting.current = true;
    setIsAdding(true);
    const added = new Set<number>();
    const failed: string[] = [];

    try {
      for (const { variant, quantity } of selectedRows) {
        const result = isLoggedIn
          ? await addToCart({ product_variant_id: variant.id, store_id: variant.store_id, quantity })
          : handleOfflineAddToCart({ product, variant, quantity, renderToast: false });

        if (result.success) {
          added.add(variant.id);
        } else {
          failed.push(`${variant.title}: ${result.message || t("cart.add_failed_description")}`);
        }
      }
    } finally {
      if (added.size) {
        setQuantities((previous) =>
          Object.fromEntries(Object.entries(previous).filter(([id]) => !added.has(Number(id)))),
        );
        if (isLoggedIn) {
          await updateCartData(false, true, 0, false);
          if (!failed.length) document.getElementById("specific-product-refetch")?.click();
        }
      }
      setIsAdding(false);
      submitting.current = false;
    }

    if (failed.length) {
      toast({
        title: added.size
          ? t("wholesale.partialAdd", "Some variants were added to your bucket")
          : t("cart.add_failed_title"),
        description: failed.join(" · "),
        color: "danger",
      });
    } else {
      toast({
        title: t("wholesale.addedToBucket", "{{count}} units added to your bucket", { count: totalQuantity }),
        description: isLoggedIn ? undefined : t("cart.login_required"),
        color: "success",
      });
    }
  }

  return (
    <section className="min-w-0 space-y-3">
      <div className="space-y-1">
        <h2 className="text-sm font-bold">{t("wholesale.orderQuantities", "Order quantities")}</h2>
        <p className="text-xs text-foreground/60">
          {t("wholesale.priceScope", "Prices are based on the quantity in each group.")}
        </p>
      </div>

      <div className="overflow-hidden rounded-medium border border-divider">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead>
            <tr className="text-xs font-semibold">
              <th scope="col" className="px-3 py-2 text-start">{t("wholesale.variant", "Variant")}</th>
              <th scope="col" className="w-28 px-3 py-2 text-end sm:w-36">{t("wholesale.quantity", "Quantity")}</th>
            </tr>
          </thead>
          {groups.map((group) => (
            <tbody key={group.id}>
              <tr className="border-t border-divider bg-content2">
                <th scope="rowgroup" colSpan={2} className="px-3 py-2 text-start text-xs font-semibold">
                  <div className="flex flex-wrap justify-between gap-x-3 gap-y-1">
                    <span>{t("wholesale.minimumUnits", "Min. {{count}} units", { count: group.minimum })}</span>
                    <span className="tabular-nums" aria-live="polite">
                      {t("wholesale.selectedUnits", "{{count}} selected", { count: group.selected })}
                      {group.selected > 0 && ` · ${formatPrice(group.subtotal)}`}
                    </span>
                  </div>
                </th>
              </tr>
              <tr>
                <td colSpan={2} className="px-2 pb-1 pt-2">
                  <ul className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,9rem),1fr))] gap-1">
                    {group.tiers.map((tier, index) => {
                      const nextTier = group.tiers[index + 1];
                      const isActive = group.activeTier === tier;
                      const range = nextTier
                        ? `${tier.min_quantity}–${nextTier.min_quantity - 1}`
                        : `${tier.min_quantity}+`;
                      const unitPrice = tier.formatted || formatPrice(tier.unit_price);
                      return (
                        <li
                          key={tier.min_quantity}
                          className={`rounded-small border px-2 py-1.5 text-center text-xs ${isActive
                            ? "border-blue-200 bg-blue-50 font-semibold text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200"
                            : "border-divider"}`}
                        >
                          {isActive && (
                            <>
                              <span className="sr-only">{t("wholesale.appliedTier", "Applied tier")}. </span>
                              <span aria-hidden="true" className="me-1">✓</span>
                            </>
                          )}
                          {t("wholesale.tierRangePrice", "{{range}} units · {{price}}/unit", { range, price: unitPrice })}
                        </li>
                      );
                    })}
                  </ul>
                </td>
              </tr>
              {group.rows.map(({ variant, available, customizable, limit, quantity }) => {
                const label = Object.values(variant.attributes ?? {}).filter(Boolean).join(" · ") || variant.title || product.title;
                const source = variant.image || product.main_image;
                const overLimit = quantity > limit;
                return (
                  <tr key={variant.id} className="border-t border-divider">
                    <th scope="row" className="px-3 py-1.5 text-start font-medium">
                      <div className="flex items-center gap-3">
                        {source && <Image src={source} alt="" className="size-9 shrink-0 rounded-small object-cover" />}
                        <span className="break-words">{label}</span>
                      </div>
                    </th>
                    <td className="px-3 py-1.5 text-end">
                      {!available ? (
                        <span className="text-xs text-foreground/60">{t("out_of_stock")}</span>
                      ) : customizable ? (
                        <Button size="xs" variant="bordered" isDisabled={isAdding} onPress={() => onCustomize(variant)}>
                          {t("wholesale.customize", "Customize")}
                        </Button>
                      ) : (
                        <>
                          <input
                            aria-label={t("wholesale.variantQuantity", "Quantity for {{variant}}", { variant: label })}
                            aria-invalid={overLimit}
                            aria-describedby={overLimit ? `wholesale-limit-${variant.id}` : undefined}
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            value={quantities[variant.id] ?? ""}
                            placeholder="0"
                            disabled={isAdding || (limit === 0 && quantity === 0)}
                            onChange={(event) => {
                              const value = event.currentTarget.value;
                              if (/^\d{0,9}$/.test(value)) {
                                setQuantities((previous) => ({ ...previous, [variant.id]: value }));
                              }
                            }}
                            className="h-8 w-full rounded-small border border-divider bg-content1 px-2 text-end text-sm tabular-nums focus:border-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-600 disabled:opacity-50 aria-invalid:border-danger"
                          />
                          {(overLimit || limit === 0) && (
                            <span id={`wholesale-limit-${variant.id}`} className="mt-1 block text-xs text-danger">
                              {t("wholesale.availableToAdd", "{{count}} available to add", { count: limit })}
                            </span>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                );
              })}
              {(group.inBucket > 0 || group.selected > 0 && (group.remaining > 0 || group.stepRemainder > 0)) && (
                <tr className="border-t border-divider text-xs text-foreground/65">
                  <td colSpan={2} className="space-y-1 px-3 py-2">
                    {group.inBucket > 0 && <p>{t("wholesale.alreadyInBucket", "{{count}} already in your bucket", { count: group.inBucket })}</p>}
                    {group.selected > 0 && (group.remaining > 0 ? (
                      <p>{t("wholesale.unitsToMinimum", "Add {{count}} more to this group to meet the checkout minimum.", { count: group.remaining })}</p>
                    ) : group.stepRemainder > 0 && (
                      <p>{t("wholesale.unitsToStep", "Add {{count}} more to this group to meet the checkout increment.", { count: quantityStep - group.stepRemainder })}</p>
                    ))}
                  </td>
                </tr>
              )}
            </tbody>
          ))}
        </table>
      </div>

      <div aria-live="polite" className="flex flex-wrap justify-between gap-2 rounded-small bg-content2 px-3 py-2 text-sm font-semibold tabular-nums">
        <span>{t("wholesale.units", "{{count}} units", { count: totalQuantity })}</span>
        <span>{t("subtotal")} {formatPrice(subtotal)}</span>
      </div>
      {exceedsMaximum && (
        <p role="alert" className="text-xs text-danger">
          {t("wholesale.productMaximum", "You can have up to {{count}} units of this product in your bucket.", { count: productMaximum })}
        </p>
      )}
      <Button
        variant="bordered"
        color="default"
        className="w-full border-divider bg-content1 font-semibold text-foreground shadow-none hover:bg-content2"
        startContent={!isAdding && <Icon icon="solar:bag-4-linear" className="text-lg" />}
        isLoading={isAdding}
        isDisabled={isAdding || !canAdd}
        onPress={() => void addSelection()}
      >
        {t("addToBucket")}
      </Button>
    </section>
  );
}
