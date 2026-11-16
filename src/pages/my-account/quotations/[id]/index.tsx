import { quotationPageProps } from "@/helpers/quotationPage";
import { Button, Chip, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import MyBreadcrumbs from "@/components/custom/MyBreadcrumbs";
import PageHeader from "@/components/custom/PageHeader";
import QuotationItems from "@/components/Quotations/QuotationItems";
import { quotationStatusColors, useQuotationMoney } from "@/components/Quotations/quotationPresentation";
import { withAuth } from "@/guards/withAuth";
import { getFormattedDate } from "@/helpers/getters";
import type { RootState } from "@/lib/redux/store";
import PageHead from "@/SEO/PageHead";
import { getQuotation, quotationError } from "@/services/quotations";
import { isAxiosError } from "axios";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import useSWR from "swr";

function QuotationDetailPage() {
  const router = useRouter();
  const { t, i18n } = useTranslation();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const { data: quote, error, mutate } = useSWR(id && userId ? ["quotation", userId, id] : null, () => getQuotation(id));
  const money = useQuotationMoney(quote?.currency_code);
  const title = t("quotation.number", { id });

  return (
    <section className="space-y-4">
      <PageHead pageTitle={id ? title : t("quotation.title")} />
      <MyBreadcrumbs breadcrumbs={[{ href: "/my-account/quotations", label: t("quotation.title") }, { href: "#", label: title }]} />
      {isAxiosError(error) && error.response?.status === 404 ? (
        <EmptyState title={t("quotation.notFound")} actionLabel={t("quotation.title")} onAction={() => void router.push("/my-account/quotations")} />
      ) : error ? (
        <ErrorState title={t("quotation.loadError")} description={quotationError(error, t("quotation.error"))} onRetry={() => void mutate()} />
      ) : !quote ? (
        <Skeleton className="h-48 rounded-large" />
      ) : (
        <>
          <PageHeader title={title} subtitle={getFormattedDate(quote.created_at, i18n.resolvedLanguage)} rightContent={
            <Chip size="sm" variant="flat" color={quotationStatusColors[quote.status]}>{t(`quotation.status.${quote.status}`)}</Chip>
          } />
          <QuotationItems quote={quote} />
          <p>{t("quotation.subtotal")} <strong>{money(quote.subtotal)}</strong></p>
          {quote.remark && (
            <div className="rounded-large border border-divider bg-content1 p-4">
              <h2 className="mb-1 font-semibold">{t("quotation.remark")}</h2>
              <p className="whitespace-pre-wrap break-words text-default-600">{quote.remark}</p>
            </div>
          )}
          {quote.order_slug ? (
            <Button as={Link} color="primary" href={`/my-account/orders/${quote.order_slug}`}>{t("quotation.viewOrder")}</Button>
          ) : quote.status === "ready_to_pay" && (
            <Button as={Link} color="primary"
              href={quote.payment_order_slug ? `/payment/${quote.payment_order_slug}` : `/my-account/quotations/${quote.id}/checkout`}>
              {t(quote.payment_order_slug ? "quotation.resumePayment" : "quotation.checkout")}
            </Button>
          )}
        </>
      )}
    </section>
  );
}

export const getServerSideProps = quotationPageProps;

export default withAuth(QuotationDetailPage);
