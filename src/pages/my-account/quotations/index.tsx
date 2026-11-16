import QuotationThumbnail from "@/components/Quotations/QuotationThumbnail";
import { quotationPageProps } from "@/helpers/quotationPage";
import { Chip, EmptyState, ErrorState, Skeleton } from "@/components/ui";
import { Pagination } from "@heroui/react";
import MyBreadcrumbs from "@/components/custom/MyBreadcrumbs";
import PageHeader from "@/components/custom/PageHeader";
import { quotationStatusColors, useQuotationMoney } from "@/components/Quotations/quotationPresentation";
import { withAuth } from "@/guards/withAuth";
import { getFormattedDate } from "@/helpers/getters";
import type { RootState } from "@/lib/redux/store";
import PageHead from "@/SEO/PageHead";
import { getQuotations, quotationError, type Quotation } from "@/services/quotations";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import useSWR from "swr";

function QuotationRow({ quote }: { quote: Quotation }) {
  const { t, i18n } = useTranslation();
  const money = useQuotationMoney(quote.currency_code);
  return (
    <li className="overflow-hidden rounded-large border border-divider bg-content1">
      <Link href={`/my-account/quotations/${quote.id}`} className="flex flex-wrap items-center justify-between gap-3 p-4 hover:bg-content2">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <QuotationThumbnail src={quote.image} />
          <div className="min-w-0">
            <span className="block font-semibold">{t("quotation.number", { id: quote.id })}</span>
            {quote.item_title && <span className="block truncate text-sm">{quote.item_title}</span>}
            <span className="text-xs text-default-600">{getFormattedDate(quote.created_at, i18n.resolvedLanguage)}</span>
            {!!quote.item_count && <span className="block text-xs text-default-600">{t("quotation.items", { count: quote.item_count })}</span>}
          </div>
        </div>
        <div className="space-y-2 text-end text-sm">
          <Chip size="md" variant="flat" color={quotationStatusColors[quote.status]} className="font-semibold">
            {t(`quotation.status.${quote.status}`)}
          </Chip>
          <span className="block font-semibold">{money(quote.subtotal)}</span>
        </div>
      </Link>
    </li>
  );
}

function QuotationsPage() {
  const router = useRouter();
  const { t } = useTranslation();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const page = Math.max(1, Number.parseInt(String(router.query.page), 10) || 1);
  const { data, error, mutate } = useSWR(userId && router.isReady ? ["quotations", userId, page] : null, () => getQuotations(page));

  return (
    <section className="space-y-4">
      <PageHead pageTitle={t("quotation.history")} />
      <MyBreadcrumbs breadcrumbs={[{ href: "/my-account/quotations", label: t("quotation.history") }]} />
      <PageHeader title={t("quotation.history")} />
      {error ? (
        <ErrorState title={t("quotation.loadError")} description={quotationError(error, t("quotation.error"))} onRetry={() => void mutate()} />
      ) : !data ? (
        <div className="space-y-3" aria-busy="true">
          {[1, 2, 3].map((key) => <Skeleton key={key} className="h-16 rounded-large" />)}
        </div>
      ) : !data.data.length ? (
        <EmptyState title={t("quotation.empty")} />
      ) : (
        <>
          <ul className="space-y-3">
            {data.data.map((quote) => <QuotationRow key={quote.id} quote={quote} />)}
          </ul>
          {data.last_page > 1 && (
            <Pagination showControls page={page} total={data.last_page}
              onChange={(nextPage) => void router.push({ pathname: router.pathname, query: { page: nextPage } }, undefined, { shallow: true })} />
          )}
        </>
      )}
    </section>
  );
}

export const getServerSideProps = quotationPageProps;

export default withAuth(QuotationsPage);
