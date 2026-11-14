export const PRODUCT_CARD_STYLES = ["photo_first", "pricing_first"] as const;

export type ProductCardStyle = (typeof PRODUCT_CARD_STYLES)[number];

export const DEFAULT_PRODUCT_CARD_STYLE: ProductCardStyle = "photo_first";

export const PRODUCT_CARD_GRID_CLASSES: Record<ProductCardStyle, string> = {
  photo_first:
    "grid-cols-1 xs:grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(200px,1fr))]",
  pricing_first:
    "grid-cols-1 xs:grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(230px,1fr))]",
};

export const resolveProductCardStyle = (
  value?: string | null,
): ProductCardStyle =>
  value === "pricing_first" || value === "compact" || value === "showcase"
    ? "pricing_first"
    : DEFAULT_PRODUCT_CARD_STYLE;
