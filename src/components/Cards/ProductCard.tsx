import { FC, memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import WholesaleProductCard from "@/components/Cards/WholesaleProductCard";
import { toast } from "@/components/ui";
import { resolveProductCardStyle } from "@/config/productCard";
import { useSettings } from "@/contexts/SettingsContext";
import { useAdTracking } from "@/hooks/useAdTracking";
import { RootState } from "@/lib/redux/store";
import { toggleFavorite } from "@/routes/api";
import type { Product } from "@/types/catalog";

interface ProductCardProps {
  product: Product;
  cardStyle?: string | null;
  onWishlistRemove?: () => void;
  isWishlistRemoving?: boolean;
}

const ProductCard: FC<ProductCardProps> = ({
  product,
  cardStyle,
  onWishlistRemove,
  isWishlistRemoving = false,
}) => {
  const { formatPrice } = useSettings();
  const { t } = useTranslation();
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const { elementRef, handleAdClick } = useAdTracking(product);
  const [isFavorited, setIsFavorited] = useState(
    Array.isArray(product.favorite) && product.favorite.length > 0,
  );
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false);

  const variants = product.variants ?? [];
  const defaultVariant =
    variants.find((variant) => variant.is_default) ?? variants[0];

  if (!defaultVariant) return null;

  const resolvedStyle = resolveProductCardStyle(cardStyle);
  const productHref = `/products/${product.slug}`;
  const images = Array.from(
    new Set(
      [product.main_image, ...(product.additional_images ?? [])].filter(
        (image): image is string => Boolean(image),
      ),
    ),
  );
  const isWishlistMode = typeof onWishlistRemove === "function";

  const price = Number(defaultVariant.price) || 0;
  const startingTier = product.pricing_groups?.find(
    (group) => group.id === defaultVariant.pricing_group_id,
  )?.tiers[0];
  const rating = Number(product.ratings) || 0;
  const hasRating = rating > 0;
  const handleToggleFavorite = async () => {
    if (!isLoggedIn) {
      document.getElementById("login-btn")?.click();
      toast({ title: t("please_login"), color: "warning" });
      return;
    }

    setIsTogglingFavorite(true);
    try {
      const response = await toggleFavorite({
        product_id: product.id,
        product_variant_id: defaultVariant.id ?? null,
        store_id: defaultVariant.store_id,
      });

      if (response.success && response.data) {
        setIsFavorited(response.data.is_favorited);
        toast({
          title: response.message || t("pageTitle.wishlist"),
          color: "success",
        });
      } else {
        toast({
          title: response.message || t("something_went_wrong"),
          color: "danger",
        });
      }
    } catch {
      toast({ title: t("something_went_wrong"), color: "danger" });
    } finally {
      setIsTogglingFavorite(false);
    }
  };

  const variantGroupIds = new Set(variants.map((variant) => variant.pricing_group_id));
  const groups = (product.pricing_groups ?? []).filter(
    (group) => variantGroupIds.has(group.id) && group.tiers.length > 0,
  );
  const unitPrice = product.formatted_price_range ||
    startingTier?.formatted ||
    (startingTier ? formatPrice(startingTier.unit_price) : defaultVariant.formatted || formatPrice(price));

  return (
    <WholesaleProductCard
      product={product}
      productHref={productHref}
      images={images}
      rating={rating}
      hasRating={hasRating}
      isFavorited={isFavorited}
      isWishlistMode={isWishlistMode}
      isFavoriteLoading={isWishlistMode ? isWishlistRemoving : isTogglingFavorite}
      productRef={elementRef}
      onProductClick={handleAdClick}
      onToggleFavorite={onWishlistRemove ?? handleToggleFavorite}
      cardStyle={resolvedStyle}
      groupCount={groups.length}
      minimum={groups[0]?.minimum_order_quantity || product.minimum_order_quantity || 1}
      unitPrice={t("wholesale.pricePerPiece", "{{price}}/pc", { price: unitPrice })}
    />
  );
};

export default memo(ProductCard);
