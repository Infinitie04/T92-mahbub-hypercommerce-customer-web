import ProductCard from "@/components/Cards/ProductCard";
import { Product } from "@/types/ApiResponse";
import { FC, useMemo } from "react";
import { Navigation } from "swiper/modules";
import { Swiper, SwiperSlide } from "swiper/react";

import ProductCardSkeleton from "@/components/Skeletons/ProductCardSkeleton";
import { useTranslation } from "react-i18next";
import { isRTL } from "@/helpers/functionalHelpers";

interface SimilarProductProps {
  initialSimilarProducts: Product[];
  isLoading: boolean;
  title?: string;
}

const SimilarProductsSection: FC<SimilarProductProps> = ({
  initialSimilarProducts = [],
  isLoading,
  title,
}) => {
  const { t, i18n } = useTranslation();
  const currentLang = i18n.resolvedLanguage || i18n.language;
  const rtl = isRTL(currentLang);
  // Memoize the product slides
  const slides = useMemo(() => {
    return initialSimilarProducts.map((product) => (
      <SwiperSlide key={product.id} className="!h-auto py-0.5">
        <ProductCard product={product} />
      </SwiperSlide>
    ));
  }, [initialSimilarProducts]);

  const skeletonSlides = useMemo(() => {
    return Array.from({ length: 7 }).map((_, index) => (
      <SwiperSlide key={index} className="!h-auto py-0.5">
        <ProductCardSkeleton />
      </SwiperSlide>
    ));
  }, []);

  if (!isLoading && initialSimilarProducts.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      <div className="flex justify-between w-full items-center mb-4">
        <h1 className="text-lg font-semibold">
          {title ?? t("similarProducts")}
        </h1>
      </div>
      <Swiper
        key={rtl ? "rtl-sp" : "ltr-sp"}
        dir={rtl ? "rtl" : "ltr"}
        slidesPerView={1}
        spaceBetween={16}
        breakpointsBase="container"
        breakpoints={{
          375: { slidesPerView: 2 },
          640: { slidesPerView: 3 },
          880: { slidesPerView: 4 },
          1120: { slidesPerView: 5 },
          1360: { slidesPerView: 6 },
        }}
        lazyPreloadPrevNext={0}
        modules={[Navigation]}
      >
        {isLoading ? skeletonSlides : slides}
      </Swiper>
    </div>
  );
};

export default SimilarProductsSection;
