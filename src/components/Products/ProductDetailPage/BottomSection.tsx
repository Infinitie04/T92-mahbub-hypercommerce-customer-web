import { Product, ProductReviews } from "@/types/ApiResponse";
import { Tab, Tabs } from "@/components/ui";
import { Icon } from "@iconify/react";
import { FC } from "react";
import ProductReviewsSection from "./ProductReviewsSection";
import AdditionalDetailSection from "./AdditionalDetailSection";
import { useTranslation } from "react-i18next";
import ReviewCard from "@/components/Cards/ReviewCard";

interface BottomSectionProps {
  initialProduct: Product;
  initialReviews?: ProductReviews | null;
}

const tabTitle = (icon: string, label: string) => (
  <div className="flex items-center gap-2">
    <Icon icon={icon} className="text-lg" />
    <span>{label}</span>
  </div>
);

const BottomSection: FC<BottomSectionProps> = ({ initialProduct, initialReviews }) => {
  const { t } = useTranslation();
  return (
    <div className="flex w-full flex-col gap-8">
      {initialReviews && initialReviews.reviews.length > 0 && (
        <section aria-labelledby="customer-reviews-heading" className="space-y-4">
          <div>
            <h2 id="customer-reviews-heading" className="text-xl font-bold">
              {t("productReviews.title", { count: initialReviews.total_reviews })}
            </h2>
            <p className="text-sm text-foreground/60">
              {initialReviews.average_rating} / 5 · {initialReviews.total_reviews} {t("reviews")}
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {initialReviews.reviews.slice(0, 3).map((review) => (
              <ReviewCard key={review.id} review={review} />
            ))}
          </div>
        </section>
      )}
      {/* Underline tabs (new design): a left-aligned row of text tabs on a
          hairline baseline; the active tab carries the amber underline and a
          bold foreground label. Scrolls horizontally on small screens. */}
      <Tabs
        aria-label={t("details")}
        variant="underlined"
        classNames={{
          base: "w-full",
          tabList:
            "w-full gap-6 rounded-none border-b border-divider p-0 overflow-x-auto no-scrollbar",
          cursor: "w-full bg-primary",
          tab: "max-w-fit h-11 px-0",
          tabContent:
            "text-sm font-medium text-foreground/50 group-data-[selected=true]:font-semibold group-data-[selected=true]:text-foreground",
          panel: "pt-6",
        }}
      >
        <Tab key="details" title={tabTitle("solar:document-text-linear", t("details"))}>
          <AdditionalDetailSection initialProduct={initialProduct} />
        </Tab>
        <Tab key="reviews" title={tabTitle("solar:star-linear", t("reviews"))}>
          <ProductReviewsSection
            productSlug={initialProduct?.slug}
            initialReviews={initialReviews}
          />
        </Tab>
      </Tabs>
    </div>
  );
};

export default BottomSection;
