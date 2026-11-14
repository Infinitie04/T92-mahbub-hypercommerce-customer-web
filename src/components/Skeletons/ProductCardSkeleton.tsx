import clsx from "clsx";
import { FC } from "react";

import { Card, Skeleton } from "@/components/ui";
import { resolveProductCardStyle } from "@/config/productCard";

interface ProductCardSkeletonProps {
  cardStyle?: string | null;
  legacy?: boolean;
}

const ProductCardSkeleton: FC<ProductCardSkeletonProps> = ({
  cardStyle,
  legacy,
}) => {
  const pricingFirst =
    !legacy && resolveProductCardStyle(cardStyle) === "pricing_first";

  return (
    <Card
      as="div"
      className={clsx(
        "h-full w-full overflow-hidden rounded-large",
        pricingFirst && "gap-2 p-3",
        legacy && "shadow-sm",
      )}
    >
      {pricingFirst && <Skeleton className="h-4 w-2/3 rounded-medium" />}
      <Skeleton
        className={clsx(
          "w-full",
          pricingFirst
            ? "aspect-[16/10] rounded-medium"
            : "aspect-square rounded-none",
        )}
      />
      <div className={clsx("flex grow flex-col gap-2", !pricingFirst && "p-3")}>
        {legacy && (
          <div className="flex items-center justify-between gap-3">
            <Skeleton className="h-3 w-16 rounded-medium" />
            <Skeleton className="h-3 w-10 rounded-medium" />
          </div>
        )}
        {!pricingFirst && <Skeleton className="h-4 w-full rounded-medium" />}
        <Skeleton
          className={clsx(
            "rounded-medium",
            pricingFirst ? "h-24 w-full" : "h-4 w-2/3",
          )}
        />
        {!pricingFirst && (
          <div className="mt-auto pt-1">
            <Skeleton className="h-5 w-24 rounded-medium" />
          </div>
        )}
        <Skeleton
          className={clsx("h-9 w-full rounded-small", !legacy && "mt-auto")}
        />
      </div>
    </Card>
  );
};

export default ProductCardSkeleton;
