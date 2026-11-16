import { quotationPageProps } from "@/helpers/quotationPage";
import { EmptyState, Skeleton } from "@/components/ui";
import MyBreadcrumbs from "@/components/custom/MyBreadcrumbs";
import PageHeader from "@/components/custom/PageHeader";
import QuotationRequestForm from "@/components/Quotations/QuotationRequestForm";
import { withAuth } from "@/guards/withAuth";
import type { RootState } from "@/lib/redux/store";
import PageHead from "@/SEO/PageHead";
import { QUOTATION_DRAFT_KEY, type QuotationDraft } from "@/services/quotations";
import { useRouter } from "next/router";
import { useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

function subscribeDraft(onChange: () => void) {
  window.addEventListener("storage", onChange);
  return () => window.removeEventListener("storage", onChange);
}

function readDraft() {
  try {
    return sessionStorage.getItem(QUOTATION_DRAFT_KEY);
  } catch {
    return null;
  }
}

function RequestQuotationPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const stored = useSyncExternalStore(subscribeDraft, readDraft, () => undefined);
  const draft = useMemo(() => {
    if (stored === undefined) return undefined;
    try {
      const value: QuotationDraft | null = stored ? JSON.parse(stored) : null;
      return value?.userId === String(userId) && value.lines.length ? value : null;
    } catch {
      return null;
    }
  }, [stored, userId]);

  const title = t("quotation.request");
  if (draft === undefined) return <Skeleton className="h-48 rounded-large" />;
  if (!draft) return <EmptyState title={t("quotation.noDraft")} description={t("quotation.noDraftDescription")} />;

  return (
    <>
      <PageHead pageTitle={title} />
      <MyBreadcrumbs breadcrumbs={[{ href: draft.returnPath, label: t("quotation.back") }, { href: "#", label: title }]} />
      <PageHeader title={title} />
      <QuotationRequestForm draft={draft} onSubmitted={(id) => {
        sessionStorage.removeItem(QUOTATION_DRAFT_KEY);
        void router.replace(`/my-account/quotations/${id}`);
      }} />
    </>
  );
}

export const getServerSideProps = quotationPageProps;

export default withAuth(RequestQuotationPage);
