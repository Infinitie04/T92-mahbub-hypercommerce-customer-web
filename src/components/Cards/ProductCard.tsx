import dynamic from "next/dynamic";
import { FC, memo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

import ProductCardMinimal from "@/components/Cards/ProductCardMinimal";
import WholesaleProductCard from "@/components/Cards/WholesaleProductCard";
import type { ProductCardLayoutProps } from "@/components/Cards/productCardTypes";
import { toast } from "@/components/ui";
import { resolveProductCardStyle } from "@/config/productCard";
import { useSettings } from "@/contexts/SettingsContext";
import { handleOfflineAddToCart } from "@/helpers/functionalHelpers";
import { isVariantInStock } from "@/helpers/stock";
import { updateCartData } from "@/helpers/updators";
import { useAdTracking } from "@/hooks/useAdTracking";
import { RootState } from "@/lib/redux/store";
import { addToCart, toggleFavorite } from "@/routes/api";
import type { Product } from "@/types/catalog";

const ProductModal = dynamic(() => import("@/components/Modals/ProductModal"), {
  ssr: false,
});

interface ProductCardProps {
  product: Product;
  cardStyle?: string | null;
  legacy?: boolean;
  showAddToCart?: boolean;
  onWishlistRemove?: () => void;
  isWishlistRemoving?: boolean;
}

const ProductCard: FC<ProductCardProps> = ({
  product,
  cardStyle,
  legacy = false,
  showAddToCart = true,
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
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [isProductModalOpen, setProductModalOpen] = useState(false);

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
  const hasMultipleVariants = variants.length > 1;
  const hasAddons = (defaultVariant.addon_groups?.length ?? 0) > 0;
  const isOutOfStock = !isVariantInStock(defaultVariant);

  const price = Number(defaultVariant.price) || 0;
  const startingTier = product.pricing_groups?.find(
    (group) => group.id === defaultVariant.pricing_group_id,
  )?.tiers[0];
  const rating = Number(product.ratings) || 0;
  const hasRating = rating > 0 && (!legacy || product.rating_count > 0);
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

  const handleAddToCart = async () => {
    if (!defaultVariant.id || isOutOfStock) return;

    if (hasMultipleVariants || hasAddons) {
      setProductModalOpen(true);
      return;
    }

    const quantity = Math.max(
      product.minimum_order_quantity || 1,
      product.quantity_step_size || 1,
    );

    if (!isLoggedIn) {
      handleOfflineAddToCart({
        product,
        variant: defaultVariant,
        quantity,
        renderToast: true,
      });
      return;
    }

    setIsAddingToCart(true);
    try {
      const response = await addToCart({
        product_variant_id: defaultVariant.id,
        store_id: defaultVariant.store_id,
        quantity,
      });

      if (response.success) {
        toast({
          title: t("cart_updated_title"),
          description: t("cart_updated_description"),
          color: "success",
        });
        await updateCartData(true, true, 0, true, false);
      } else {
        toast({
          title: response.message || t("something_went_wrong"),
          color: "danger",
        });
      }
    } catch {
      toast({ title: t("something_went_wrong"), color: "danger" });
    } finally {
      setIsAddingToCart(false);
    }
  };

  const layoutProps: ProductCardLayoutProps = {
    product,
    productHref,
    images,
    pricing: {
      current:
        product.formatted_price_range ??
        (startingTier
          ? t("wholesale.cardTier", {
              price: startingTier.formatted || formatPrice(startingTier.unit_price),
              quantity: startingTier.min_quantity,
              defaultValue: "{{price}} · {{quantity}}+ units",
            })
          : defaultVariant.formatted ?? formatPrice(price)),
      original: null,
      discountPercentage: 0,
    },
    rating,
    hasRating,
    isFavorited,
    isWishlistMode,
    isFavoriteLoading: isWishlistMode ? isWishlistRemoving : isTogglingFavorite,
    isAddingToCart,
    isOutOfStock,
    showAddToCart,
    productRef: elementRef,
    onProductClick: handleAdClick,
    onToggleFavorite: isWishlistMode
      ? () => onWishlistRemove?.()
      : handleToggleFavorite,
    onAddToCart: handleAddToCart,
  };

  if (!legacy) {
    const variantGroupIds = new Set(variants.map((variant) => variant.pricing_group_id));
    const groups = (product.pricing_groups ?? []).filter(
      (group) => variantGroupIds.has(group.id) && group.tiers.length > 0,
    );
    const unitPrice = product.formatted_price_range ||
      startingTier?.formatted ||
      (startingTier ? formatPrice(startingTier.unit_price) : defaultVariant.formatted || formatPrice(price));

    return (
      <WholesaleProductCard
        {...layoutProps}
        cardStyle={resolvedStyle}
        groupCount={groups.length}
        minimum={groups[0]?.minimum_order_quantity || product.minimum_order_quantity || 1}
        unitPrice={t("wholesale.pricePerPiece", "{{price}}/pc", { price: unitPrice })}
      />
    );
  }

  return (
    <>
      <ProductCardMinimal {...layoutProps} />
      {isProductModalOpen ? (
        <ProductModal
          initialStep={hasMultipleVariants ? "variant" : "addons"}
          isOpen={isProductModalOpen}
          product={product}
          selectedVariant={defaultVariant}
          onClose={() => setProductModalOpen(false)}
        />
      ) : null}
    </>
  );
};

export default memo(ProductCard);
