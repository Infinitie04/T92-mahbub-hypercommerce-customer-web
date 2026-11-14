import { Icon } from "@iconify/react";
import clsx from "clsx";
import Link from "next/link";
import { useTranslation } from "react-i18next";

import ProductCardMedia from "@/components/Cards/ProductCardMedia";
import type { ProductCardLayoutProps } from "@/components/Cards/productCardTypes";
import { Card } from "@/components/ui";
import type { ProductCardStyle } from "@/config/productCard";

interface WholesaleProductCardProps extends ProductCardLayoutProps {
  cardStyle: ProductCardStyle;
  unitPrice: string;
  groupCount: number;
  minimum: number;
}

export default function WholesaleProductCard(props: WholesaleProductCardProps) {
  const { t } = useTranslation();
  const {
    cardStyle,
    product,
    productHref,
    productRef,
    onProductClick,
    rating,
    hasRating,
    groupCount,
    minimum,
    unitPrice,
  } = props;
  const pricingFirst = cardStyle === "pricing_first";
  const attributes = product.attributes ?? [];
  const colors =
    attributes.find(({ swatche_type }) => swatche_type === "color")
      ?.swatch_values ?? [];
  const sizes = attributes.find(({ slug }) => slug === "size")?.values ?? [];
  const minimumLabel =
    groupCount > 1
      ? t("wholesale.cardGroupMinimum", "{{count}} pcs per group", {
          count: minimum,
        })
      : t("wholesale.cardMinimum", "{{count}} pcs", { count: minimum });
  const title = (
    <div className="flex flex-wrap items-start justify-between gap-x-2 gap-y-1">
      <Link
        href={productHref}
        title={product.title}
        onClick={onProductClick}
        className="line-clamp-2 min-w-0 flex-1 basis-24 break-words font-display text-sm font-bold leading-snug text-foreground hover:underline sm:text-base"
      >
        {product.title}
      </Link>
      {hasRating && (
        <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-foreground">
          <Icon
            aria-hidden="true"
            icon="solar:star-bold"
            className="text-rating-star"
          />
          <span className="sr-only">
            {t("rating", { ratings: rating.toFixed(1) })}
          </span>
          <span aria-hidden="true">{rating.toFixed(1)}</span>
          {product.rating_count > 0 && (
            <span className="font-normal text-default-500">
              ({product.rating_count})
            </span>
          )}
        </span>
      )}
    </div>
  );

  return (
    <Card
      as="div"
      ref={productRef}
      data-card-style={cardStyle}
      className={clsx(
        "h-full w-full min-w-0 overflow-hidden text-start",
        pricingFirst && "gap-2 p-3",
      )}
    >
      {pricingFirst && title}
      <ProductCardMedia {...props} cardStyle={cardStyle} />
      <div className={clsx("flex grow flex-col gap-2", !pricingFirst && "p-3")}>
        {!pricingFirst && title}
        {!pricingFirst && (colors.length > 0 || sizes.length > 0) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-default-600">
            {colors.slice(0, 4).map(({ swatch, value }) => (
              <span
                key={value}
                title={value}
                aria-label={value}
                role="img"
                className="size-3.5 rounded-full border border-default-300"
                style={{ backgroundColor: swatch || value }}
              />
            ))}
            {colors.length > 4 && <span>+{colors.length - 4}</span>}
            {sizes.length > 0 && <span>{sizes.join(" · ")}</span>}
          </div>
        )}
        {pricingFirst ? (
          <dl className="divide-y divide-divider rounded-medium bg-content2 px-2.5 text-xs">
            <div className="flex flex-wrap justify-between gap-x-2 py-2">
              <dt className="text-default-600">
                {t("wholesale.unitPrice", "Unit price")}
              </dt>
              <dd className="font-semibold">{unitPrice}</dd>
            </div>
            <div className="flex flex-wrap justify-between gap-x-2 py-2">
              <dt className="text-default-600">{t("minOrder")}</dt>
              <dd className="font-semibold">{minimumLabel}</dd>
            </div>
            {groupCount > 0 && (
              <div className="flex justify-between gap-2 py-2">
                <dt className="text-default-600">
                  {t("wholesale.pricingGroups", "Pricing groups")}
                </dt>
                <dd className="font-semibold">{groupCount}</dd>
              </div>
            )}
          </dl>
        ) : (
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <strong className="font-display text-sm sm:text-base">
              {unitPrice}
            </strong>
            <span className="text-xs text-default-600">
              {t("wholesale.cardMin", "Min. {{quantity}}", {
                quantity: minimumLabel,
              })}
            </span>
          </div>
        )}
        <Link
          href={productHref}
          onClick={onProductClick}
          className={clsx(
            "mt-auto flex min-h-9 items-center justify-center rounded-small border border-primary px-2 py-1.5 text-center text-xs font-bold text-primary-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary",
            pricingFirst
              ? "hover:bg-primary/10"
              : "bg-primary hover:bg-primary-600",
          )}
        >
          {pricingFirst
            ? t("wholesale.viewPricingVariants", "View pricing & variants")
            : t("wholesale.viewProduct", "View product")}
        </Link>
      </div>
    </Card>
  );
}
