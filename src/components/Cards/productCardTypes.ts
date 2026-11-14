import type { RefObject } from "react";

import type { Product } from "@/types/catalog";

export interface ProductCardPricing {
  current: string;
  original: string | null;
  discountPercentage: number;
}

export interface ProductCardLayoutProps {
  product: Product;
  productHref: string;
  images: string[];
  pricing: ProductCardPricing;
  rating: number;
  hasRating: boolean;
  isFavorited: boolean;
  isWishlistMode: boolean;
  isFavoriteLoading: boolean;
  isAddingToCart: boolean;
  isOutOfStock: boolean;
  showAddToCart: boolean;
  productRef: RefObject<HTMLDivElement | null>;
  onProductClick: () => void;
  onToggleFavorite: () => void;
  onAddToCart: () => void;
}
