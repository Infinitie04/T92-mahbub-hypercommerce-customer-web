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
  const activity = quote ? [
    { label: t("quotation.submitted"), time: quote.created_at },
    ...(quote.reviewed_at ? [{
      label: t(quote.status === "rejected" ? "quotation.status.rejected" : "quotation.status.accepted"),
      time: quote.reviewed_at,
    }] : []),
    ...(quote.payment_requested_at ? [{ label: t("quotation.status.ready_to_pay"), time: quote.payment_requested_at }] : []),
    ...(quote.status === "ordered" ? [{ label: t("quotation.status.ordered"), time: null }] : []),
  ] : [];
  const title = t("quotation.number", { id });

  return (
    <section className="space-y-4">
      <PageHead pageTitle={id ? title : t("quotation.history")} />
      <MyBreadcrumbs breadcrumbs={[{ href: "/my-account/quotations", label: t("quotation.history") }, { href: "#", label: title }]} />
      {isAxiosError(error) && error.response?.status === 404 ? (
        <EmptyState title={t("quotation.notFound")} actionLabel={t("quotation.history")} onAction={() => void router.push("/my-account/quotations")} />
      ) : error ? (
        <ErrorState title={t("quotation.loadError")} description={quotationError(error, t("quotation.error"))} onRetry={() => void mutate()} />
      ) : !quote ? (
        <Skeleton className="h-48 rounded-large" />
      ) : (
        <>
          <PageHeader title={t("quotation.details")} subtitle={`${title} · ${getFormattedDate(quote.created_at, i18n.resolvedLanguage)}`} />
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-large border border-divider bg-content1 p-4">
            <div className="space-y-1">
              <p className="text-sm text-default-600">{t("quotation.subtotal")}</p>
              <p className="text-lg font-bold">{money(quote.subtotal)}</p>
            </div>
            <Chip size="md" variant="flat" color={quotationStatusColors[quote.status]} className="font-semibold">
              {t(`quotation.status.${quote.status}`)}
            </Chip>
          </div>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <QuotationItems quote={quote} />
            <section className="space-y-3 rounded-large border border-divider bg-content1 p-4">
              <h2 className="font-semibold">{t("quotation.activity")}</h2>
              <ol className="space-y-3 border-s border-divider ps-3">
                {activity.map(({ label, time }) => (
                  <li key={label}>
                    <p className="text-sm font-medium">{label}</p>
                    {time && <time dateTime={time} className="text-xs text-default-600">{getFormattedDate(time, i18n.resolvedLanguage)}</time>}
                  </li>
                ))}
              </ol>
              {quote.remark && (
                <div className="border-t border-divider pt-3">
                  <h3 className="mb-1 text-sm font-semibold">{t("quotation.remark")}</h3>
                  <p className="whitespace-pre-wrap break-words text-sm text-default-600">{quote.remark}</p>
                </div>
              )}
              {quote.order_slug ? (
                <Button as={Link} color="primary" fullWidth href={`/my-account/orders/${quote.order_slug}`}>{t("quotation.viewOrder")}</Button>
              ) : quote.status === "ready_to_pay" && (
                <Button as={Link} color="primary" fullWidth
                  href={quote.payment_order_slug ? `/payment/${quote.payment_order_slug}` : `/my-account/quotations/${quote.id}/checkout`}>
                  {t(quote.payment_order_slug ? "quotation.resumePayment" : "quotation.checkout")}
                </Button>
              )}
            </section>
          </div>
        </>
      )}
    </section>
  );
}

export const getServerSideProps = quotationPageProps;

export default withAuth(QuotationDetailPage);
