import MyBreadcrumbs from "@/components/custom/MyBreadcrumbs";
import { getSettings } from "@/routes/api";
import { GetServerSideProps } from "next";
import { isSSR } from "@/helpers/getters";
import { getMarketFromContext } from "@/helpers/functionalHelpers";
import { NextPageWithLayout } from "@/types";
import dynamic from "next/dynamic";
import { updateCartData } from "@/helpers/updators";
import { parseQuotationId } from "@/helpers/quotationCheckout";
import { withAuth } from "@/guards/withAuth";
import { serverSideAuthGuard } from "@/guards/authGuard";
import { loadTranslations } from "../../../../i18n";
import PageHead from "@/SEO/PageHead";
import { ErrorState } from "@/components/ui";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useEffect } from "react";

const CheckoutPageView = dynamic(() => import("@/views/CheckoutPageView"), {
  ssr: false,
});
const QuotationCheckout = dynamic(() => import("@/views/CheckoutPageView/QuotationCheckout"), {
  ssr: false,
});

interface CheckoutPageProps {
  error?: string;
}

const CheckoutPage: NextPageWithLayout<CheckoutPageProps> = () => {
  const { t } = useTranslation();
  const router = useRouter();
  const quotationParam = router.query.quotation;
  const quotationId = parseQuotationId(quotationParam);
  const isCartCheckout = router.isReady && quotationParam === undefined;
  const title = t("pageTitle.checkout", { defaultValue: "Checkout" });

  useEffect(() => {
    if (isCartCheckout) updateCartData(false, false, 0, false);
  }, [isCartCheckout]);

  const breadcrumbs = quotationId
    ? [
        { href: "/my-account/quotations", label: t("quotation.history") },
        { href: `/my-account/quotations/${quotationId}`, label: t("quotation.number", { id: quotationId }) },
        { label: title },
      ]
    : [
        { href: "/cart", label: "Shopping Cart" },
        { href: "/cart/checkout", label: title },
      ];

  return (
    <>
      <PageHead pageTitle={title} />

      <div className="mx-auto min-h-screen w-full max-w-site px-4 sm:px-6">
        {router.isReady && (
          <>
            <MyBreadcrumbs breadcrumbs={breadcrumbs} />
            {isCartCheckout ? (
              <>
                <button id="refetch-cart-page" onClick={() => updateCartData(true, false)} className="hidden" />
                <CheckoutPageView />
              </>
            ) : quotationId ? (
              <QuotationCheckout key={quotationId} id={quotationId} />
            ) : (
              <ErrorState title={t("quotation.notFound")} />
            )}
          </>
        )}
      </div>
    </>
  );
};

export const getServerSideProps: GetServerSideProps | undefined = isSSR()
  ? async (context) => {
      try {
        const guard = await serverSideAuthGuard(context);
        if (guard) return guard;

        const market = getMarketFromContext(context);
        const settingsRes = await getSettings({ market });
        await loadTranslations(context);

        return {
          props: {
            initialSettings: settingsRes.data ?? null,
          },
        };
      } catch (err) {
        console.error("Error in getServerSideProps:", err);
        return {
          props: {
            initialSettings: null,
            error:
              err instanceof Error
                ? err.message
                : "An error occurred during SSR",
          },
        };
      }
    }
  : undefined;

export default withAuth(CheckoutPage);
