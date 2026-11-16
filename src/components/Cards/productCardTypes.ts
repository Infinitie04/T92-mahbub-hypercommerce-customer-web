import type { RefObject } from "react";

import type { Product } from "@/types/catalog";

export interface ProductCardPricing {
  current: string;
  original: string | null;
  discountPercentage: number;
}

export interface ProductCardBaseProps {
  product: Product;
  productHref: string;
  images: string[];
  rating: number;
  hasRating: boolean;
  isFavorited: boolean;
  isWishlistMode: boolean;
  isFavoriteLoading: boolean;
  productRef: RefObject<HTMLDivElement | null>;
  onProductClick: () => void;
  onToggleFavorite: () => void;
}

export interface ProductCardLayoutProps extends ProductCardBaseProps {
  pricing: ProductCardPricing;
  isAddingToCart: boolean;
  isOutOfStock: boolean;
  showAddToCart: boolean;
  onAddToCart: () => void;
}
