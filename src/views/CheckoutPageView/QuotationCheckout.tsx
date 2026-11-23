import PaymentMethods from "@/components/PaymentMethods";
import { useSettings } from "@/contexts/SettingsContext";
import AddressSection from "@/components/Cart/AddressSection";
import QuotationItems from "@/components/Quotations/QuotationItems";
import { Button, ErrorState, Skeleton, Spinner } from "@/components/ui";
import AttachmentUploader, { type AttachmentFile } from "@/components/Cart/AttachmentUploader";
import { useQuotationMoney } from "@/components/Quotations/quotationPresentation";
import { quotationPaymentHref } from "@/helpers/quotationCheckout";
import { CheckoutShipping, CheckoutTax } from "./CheckoutBreakdown";
import { useTranslation } from "react-i18next";
import type { RootState } from "@/lib/redux/store";
import { downloadExportProforma, getQuotation, payQuotation, previewQuotation, quotationCheckoutFeedback, quotationError, type QuotationItemIssue } from "@/services/quotations";
import type { Address } from "@/types/ApiResponse";
import CheckoutLayout from "./CheckoutLayout";
import { isAxiosError } from "axios";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useState } from "react";
import { useSelector } from "react-redux";
import useSWR from "swr";

export default function QuotationCheckout({ id }: { id: string }) {
  const router = useRouter();
  const { t } = useTranslation();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { data: quote, error: quoteError, mutate: reloadQuote } = useSWR(id && userId ? ["quotation", userId, id] : null, () => getQuotation(id));
  const selectedAddress = useSelector((state: RootState) => state.checkout.selectedAddress);
  const [addressId, setAddressId] = useState<number>();
  const { paymentSettings } = useSettings();
  const [paymentChoice, setPaymentChoice] = useState("");
  const [downloading, setDownloading] = useState(false);
  const paymentType = paymentChoice || (
    paymentSettings?.razorpayPayment === false
      ? paymentSettings.manualPayment ? "manualPayment" : paymentSettings.cod ? "cod" : "razorpayPayment"
      : "razorpayPayment"
  );
  const directed = useSelector((state: RootState) => state.checkout.thirdPartyDelivery);
  const billing = useSelector((state: RootState) => state.checkout.billingAddress);
  const [files, setFiles] = useState<Record<number, AttachmentFile[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const [paymentIssues, setPaymentIssues] = useState<{ token: string; issues: QuotationItemIssue[] }>();
  const onAddressSelected = useCallback((address: Address) => {
    setAddressId(Number(address.id));
    setPaymentChoice("");
    setPaymentError("");
    setPaymentIssues(undefined);
  }, []);
  const previewAddressId = addressId === Number(selectedAddress?.id) ? addressId : undefined;
  const billingId = billing === "delivery" ? previewAddressId : billing ? Number(billing.id) : undefined;
  const canPreview = quote?.status === "ready_to_pay" && (quote.has_pending_order || previewAddressId !== undefined);
  const { data: preview, error: previewError, isValidating, mutate } = useSWR(
    canPreview ? ["quotation-preview", userId, id, previewAddressId, paymentType, billingId, directed] : null,
    () => previewQuotation(id, previewAddressId, paymentType, billingId, directed),
    { shouldRetryOnError: false, revalidateOnFocus: false },
  );
  const verifiedOrder = !previewError && preview && "order_slug" in preview ? preview : null;
  const reviewed = preview && "totals" in preview ? preview : null;

  const money = useQuotationMoney(reviewed?.currency_code);
  const previewFeedback = previewError ? quotationCheckoutFeedback(previewError, t("quotation.error")) : undefined;
  const itemIssues = previewFeedback?.issues ??
    (paymentIssues?.token === reviewed?.pricing_review_token ? paymentIssues?.issues : undefined);
  const title = t("quotation.number", { id });
  const previewLoadingLabel = t(quote?.has_pending_order ? "checkout.confirmingPayment" : "quotation.calculating");

  const pay = async () => {
    if (!reviewed || !canPreview || previewAddressId === undefined || submitting) return;
    const body = new FormData();
    if (directed) body.set("third_party_delivery", "1");
    body.set("payment_type", paymentType);
    body.set("address_id", String(previewAddressId));
    if (billing) body.set("billing_address_id", String(billing === "delivery" ? previewAddressId : billing.id));
    body.set("pricing_review_token", reviewed.pricing_review_token);
    for (const [product, uploads] of Object.entries(files)) {
      for (const file of uploads) body.append(`attachments[${product}][]`, file.file);
    }
    setPaymentError("");
    setPaymentIssues(undefined);
    setSubmitting(true);
    try {
      const result = await payQuotation(id, body);
      await router.push(result.payment_status === "completed" || result.payment_method === "cod"
        ? `/my-account/orders/${result.order_slug}`
        : quotationPaymentHref(result.order_slug, id));
    } catch (error) {
      const feedback = quotationCheckoutFeedback(error, t("quotation.error"));
      setPaymentError(feedback.summary);
      setPaymentIssues({ token: reviewed.pricing_review_token, issues: feedback.issues });
      if (isAxiosError(error) && [409, 503].includes(error.response?.status ?? 0)) {
        void reloadQuote();
        void mutate();
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (quoteError) return <ErrorState title={t("quotation.loadError")} description={quotationError(quoteError, t("quotation.error"))}
    retryLabel={t("retry")} onRetry={() => void reloadQuote()} />;
  if (!quote) return <Skeleton className="h-48 rounded-large" />;
  if (quote.order_slug) {
    return <Button as={Link} color="primary" href={`/my-account/orders/${quote.order_slug}`}>{t("quotation.viewOrder")}</Button>;
  }
  if (quote.status !== "ready_to_pay") {
    return <Link className="text-primary" href={`/my-account/quotations/${id}`}>{title}</Link>;
  }

  return (
    <>
      <CheckoutLayout
        heading={t("pageTitle.checkout", { defaultValue: "Checkout" })}
        details={
          <div className="flex min-w-0 flex-col gap-6">
            {!quote.has_pending_order && <AddressSection onAddressSelected={onAddressSelected} />}
            <QuotationItems quote={quote} issues={itemIssues} />
            {reviewed?.attachments.map((item) => (
              <section key={item.product_id} className="rounded-large border border-divider bg-content1 p-4">
                <h2 className="mb-2 text-sm font-medium">
                  {t("quotation.attachmentFor", { item: item.title })} · {t(item.required ? "cart.attachments.requiredLabel" : "cart.attachments.optionalLabel")}
                </h2>
                <AttachmentUploader
                  attachment={files[item.product_id] ?? []}
                  onAttachmentChange={(uploads) => setFiles((current) => ({ ...current, [item.product_id]: uploads }))}
                />
              </section>
            ))}
          </div>
        }
        summary={
          <div className="space-y-3 rounded-large border border-divider bg-content1 p-4 md:sticky md:top-24">
            <h2 className="font-bold">{t("cart.billDetails")}</h2>
            {!canPreview ? <p className="text-sm text-default-600">{t("quotation.selectDelivery")}</p> :
              previewError && isValidating ? <Spinner size="sm" label={previewLoadingLabel} /> :
              previewFeedback && !previewFeedback.summary ? (
                <Button variant="bordered" fullWidth onPress={() => void mutate()}>{t("retry")}</Button>
              ) :
              previewFeedback ? <ErrorState title={t(quote.has_pending_order ? "checkout.checkPaymentStatus" : "checkout.validation.title")}
                description={previewFeedback.summary}
                retryLabel={t(quote.has_pending_order ? "checkout.checkPaymentStatus" : "retry")} onRetry={() => {
                  setPaymentChoice("");
                  void reloadQuote();
                  void mutate();
                }} /> :
              verifiedOrder ? (
                <Button as={Link} color="primary" fullWidth isDisabled={isValidating}
                  href={verifiedOrder.payment_status === "completed" || verifiedOrder.payment_method === "cod"
                    ? `/my-account/orders/${verifiedOrder.order_slug}`
                    : quotationPaymentHref(verifiedOrder.order_slug, id)}>
                  {t(verifiedOrder.payment_status === "completed" || verifiedOrder.payment_method === "cod" ? "quotation.viewOrder" : "quotation.pay")}
                </Button>
              ) :
              !reviewed ? <Spinner size="sm" label={previewLoadingLabel} /> : (
                <>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3"><span>{t(reviewed.totals.tax_total > 0 ? "quotation.merchandise" : "quotation.goodsValue")}</span><span>{money(reviewed.totals.items_total)}</span></div>
                    <div className="flex justify-between gap-3"><span>{t("quotation.shipping")}</span><span>{money(reviewed.totals.total_delivery_charges)}</span></div>
                    <CheckoutShipping shipments={reviewed.seller_shipping_costs ?? []} formatPrice={money} />
                    <CheckoutTax total={reviewed.totals.tax_total} breakdown={reviewed.tax_breakdown} formatPrice={money} />
                    {reviewed.totals.cod_fee > 0 && (
                      <div className="flex justify-between gap-3"><span>{t("orderMoneySummary.codFee")}</span><span>{money(reviewed.totals.cod_fee)}</span></div>
                    )}
                    {reviewed.totals.platform_fee > 0 && (
                      <div className="flex justify-between gap-3"><span>{t("checkout.platformFee")}</span><span>{money(reviewed.totals.platform_fee)}</span></div>
                    )}
                    {reviewed.totals.pending_charges_total > 0 && (
                      <div className="flex justify-between gap-3"><span>{t("checkout.pendingChargesTotal")}</span><span>{money(reviewed.totals.pending_charges_total)}</span></div>
                    )}
                    <div className="flex justify-between gap-3 border-t border-divider pt-2 font-bold">
                      <span>{t("quotation.total")}</span><span>{money(reviewed.totals.payable_amount)}</span>
                    </div>
                  </div>
                  <PaymentMethods selectedPayment={paymentType} setSelectedPayment={setPaymentChoice} includeManualPayment
                    hideCOD={!reviewed.cod_available} codEligible={reviewed.cod_available} isLoading={submitting} />
                  {reviewed.export_proforma && previewAddressId && (
                    <Button variant="bordered" fullWidth isLoading={downloading} onPress={async () => {
                      setDownloading(true);
                      try {
                        await downloadExportProforma(id, previewAddressId, paymentType, billingId);
                      } catch {
                        setPaymentError(t("quotation.exportDownloadFailed"));
                      } finally {
                        setDownloading(false);
                      }
                    }}>{t("quotation.downloadExport")}</Button>
                  )}
                  {paymentError && <p role="alert" className="text-sm text-danger">{paymentError}</p>}
                  <Button
                    color="primary"
                    className="w-full font-semibold"
                    isLoading={submitting}
                    isDisabled={isValidating || reviewed.attachments.some((item) => item.required && !files[item.product_id]?.length)}
                    onPress={() => void pay()}
                  >
                    {paymentType === "cod" ? t("quotation.placeCod") : t("quotation.pay")}
                  </Button>
                </>
              )}
          </div>
        }
      />
    </>
  );
}
