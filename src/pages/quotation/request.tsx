import { quotationPageProps } from "@/helpers/quotationPage";
import { Button, EmptyState, ErrorState, Input, Select, SelectItem, Skeleton } from "@/components/ui";
import MyBreadcrumbs from "@/components/custom/MyBreadcrumbs";
import { withAuth } from "@/guards/withAuth";
import { useQuotationMoney } from "@/components/Quotations/quotationPresentation";
import type { RootState } from "@/lib/redux/store";
import PageHead from "@/SEO/PageHead";
import { getQuotationCurrency, QUOTATION_DRAFT_KEY, quotationError, quotationValidation, submitQuotation, type QuotationDraft } from "@/services/quotations";
import CheckoutLayout from "@/views/CheckoutPageView/CheckoutLayout";
import { useRouter } from "next/router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import useSWR from "swr";

function RequestQuotationPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const [draft, setDraft] = useState<QuotationDraft | null>();
  const [variantIndex, setVariantIndex] = useState(0);
  const [prices, setPrices] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const requestInFlight = useRef(false);
  const { data: currency, error, mutate } = useSWR(draft ? "quotation-currency" : null, getQuotationCurrency);
  const money = useQuotationMoney(currency);

  useEffect(() => {
    try {
      const value: QuotationDraft | null = JSON.parse(sessionStorage.getItem(QUOTATION_DRAFT_KEY) ?? "null");
      setDraft(value?.userId === String(userId) && value.lines.length ? value : null);
    } catch {
      setDraft(null);
    }
  }, [userId]);

  const lines = draft?.source === "item" ? [draft.lines[variantIndex]] : draft?.lines ?? [];
  const validPrice = (price?: string) => /^\d{1,8}(?:\.\d{1,2})?$/.test(price ?? "") && Number(price) >= 0.01;
  const lineCents = (index: number) => validPrice(prices[index]) ? Math.round(Number(prices[index]) * 100) * lines[index].quantity : 0;
  const total = lines.reduce((sum, _, index) => sum + lineCents(index), 0) / 100;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft || !currency || requestInFlight.current) return;
    const invalid = Object.fromEntries(lines.flatMap((_, index) =>
      validPrice(prices[index]) ? [] : [[`items.${index}.unit_price`, [t("quotation.invalidPrice")]]]));
    setMessage("");
    setErrors(invalid);
    if (Object.keys(invalid).length) return;

    requestInFlight.current = true;
    setSubmitting(true);
    try {
      const quote = await submitQuotation(draft.source, currency, lines, prices);
      sessionStorage.removeItem(QUOTATION_DRAFT_KEY);
      await router.replace(`/my-account/quotations/${quote.id}`);
    } catch (submitError) {
      const fields = quotationValidation(submitError)?.errors ?? {};
      setErrors(fields);
      if (!Object.keys(fields).length || Object.keys(fields).some((key) => !/^items\.\d+\.unit_price$/.test(key))) {
        setMessage(quotationError(submitError, t("quotation.error")));
      }
    } finally {
      requestInFlight.current = false;
      setSubmitting(false);
    }
  }

  if (draft === undefined || (draft && !currency && !error)) return <Skeleton className="h-48 rounded-large" />;
  if (!draft) return <EmptyState title={t("quotation.noDraft")} description={t("quotation.noDraftDescription")} />;
  if (error) return <ErrorState title={t("quotation.error")} onRetry={() => void mutate()} />;

  return (
    <>
      <PageHead pageTitle={t("quotation.request")} />
      <MyBreadcrumbs breadcrumbs={[{ href: draft.returnPath, label: t("quotation.back") }, { href: "#", label: t("quotation.request") }]} />
      <form onSubmit={submit} noValidate>
        <CheckoutLayout
          heading={t("quotation.request")}
          details={
            <div className="space-y-3">
              {draft.source === "item" && draft.lines.length > 1 && (
                <Select
                  label={t("quotation.variant")}
                  selectedKeys={[String(variantIndex)]}
                  isDisabled={submitting}
                  onChange={(event) => {
                    if (event.target.value === "") return;
                    setVariantIndex(Number(event.target.value));
                    setPrices([]);
                    setErrors({});
                    setMessage("");
                  }}
                >
                  {draft.lines.map((line, index) => <SelectItem key={index}>{line.variantLabel || line.label}</SelectItem>)}
                </Select>
              )}
              {lines.map((line, index) => {
                const field = `items.${index}.unit_price`;
                return (
                  <section key={index} className="grid gap-3 rounded-large border border-divider bg-content1 p-4 sm:grid-cols-2 sm:items-center">
                    <div>
                      <h2 className="font-semibold">{line.label}</h2>
                      {line.variantLabel && <p className="text-sm text-default-600">{line.variantLabel}</p>}
                      <p className="text-sm text-default-600">{t("quotation.quantity", { count: line.quantity })}</p>
                    </div>
                    <div>
                      <Input
                        label={t("quotation.unitPriceCurrency", { currency })}
                        inputMode="decimal"
                        isRequired
                        isDisabled={submitting}
                        isInvalid={Boolean(errors[field]?.length)}
                        errorMessage={errors[field]?.[0]}
                        value={prices[index] ?? ""}
                        onValueChange={(value) => {
                          setPrices((current) => Object.assign([...current], { [index]: value }));
                          setErrors((current) => ({ ...current, [field]: [] }));
                        }}
                      />
                      <p className="mt-2 text-sm">{t("quotation.lineTotal")} <strong>{validPrice(prices[index]) ? money(lineCents(index) / 100) : "—"}</strong></p>
                    </div>
                  </section>
                );
              })}
            </div>
          }
          summary={
            <div className="space-y-4 rounded-large border border-divider bg-content1 p-4 sm:p-5">
              <h2 className="font-bold">{t("quotation.summary")}</h2>
              <div className="flex justify-between gap-2 border-t border-divider pt-3">
                <span>{t("quotation.subtotal")}</span>
                <strong>{money(total)}</strong>
              </div>
              {message && <p role="alert" className="text-sm text-danger">{message}</p>}
              <Button type="submit" color="primary" fullWidth className="font-semibold" isLoading={submitting}>{t("quotation.submit")}</Button>
            </div>
          }
        />
      </form>
    </>
  );
}

export const getServerSideProps = quotationPageProps;

export default withAuth(RequestQuotationPage);
