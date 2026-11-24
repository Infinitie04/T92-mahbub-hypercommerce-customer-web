import { quotationCheckoutHref } from "@/helpers/quotationCheckout";
import { quotationPageProps } from "@/helpers/quotationPage";
import { Button, Chip, EmptyState, ErrorState, Modal, ModalBody, ModalContent, ModalHeader, Skeleton, toastError, useDisclosure } from "@/components/ui";
import ConfirmationModal from "@/components/Modals/ConfirmationModal";
import MyBreadcrumbs from "@/components/custom/MyBreadcrumbs";
import PageHeader from "@/components/custom/PageHeader";
import QuotationItems from "@/components/Quotations/QuotationItems";
import QuotationRequestForm from "@/components/Quotations/QuotationRequestForm";
import QuotationAddressField from "@/components/Quotations/QuotationAddressField";
import { CheckoutShipping } from "@/views/CheckoutPageView/CheckoutBreakdown";
import { quotationStatusColors, useQuotationMoney } from "@/components/Quotations/quotationPresentation";
import { withAuth } from "@/guards/withAuth";
import { getFormattedDate } from "@/helpers/getters";
import type { RootState } from "@/lib/redux/store";
import PageHead from "@/SEO/PageHead";
import { cancelQuotation, getQuotation, quotationError, updateQuotationAddress } from "@/services/quotations";
import { isAxiosError } from "axios";
import { useState } from "react";
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
  const cancellation = useDisclosure();
  const requote = useDisclosure();
  const money = useQuotationMoney(quote?.currency_code);
  const shippingMoney = useQuotationMoney(quote?.accepted_shipping?.currency_code);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressError, setAddressError] = useState("");
  const activity = quote ? [
    { label: t("quotation.submitted"), time: quote.created_at },
    ...(quote.reviewed_at ? [{
      label: t(quote.status === "rejected" ? "quotation.status.rejected" : "quotation.status.accepted"),
      time: quote.reviewed_at,
    }] : []),
    ...(quote.payment_requested_at ? [{ label: t("quotation.status.ready_to_pay"), time: quote.payment_requested_at }] : []),
    ...(quote.status === "ordered" ? [{ label: t("quotation.status.ordered"), time: null }] : []),
    ...(quote.status === "cancelled" ? [{ label: t("quotation.status.cancelled"), time: quote.cancelled_at }] : []),
  ] : [];
  const title = t("quotation.number", { id });

  async function handleCancel() {
    if (!quote?.can_cancel) return;

    try {
      const cancelled = await cancelQuotation(quote.id);
      await mutate(cancelled, { revalidate: false });
    } catch (cancelError) {
      toastError(quotationError(cancelError, t("quotation.cancelError")));
      void mutate();
    }
  }

  async function saveAddress(addressId: number) {
    if (!quote || savingAddress) return;
    setSavingAddress(true);
    setAddressError("");
    try {
      await mutate(await updateQuotationAddress(quote.id, addressId), { revalidate: false });
    } catch (failure) {
      setAddressError(quotationError(failure, t("quotation.error")));
      void mutate();
    } finally {
      setSavingAddress(false);
    }
  }

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
            <div className="min-w-0 space-y-4">
              <QuotationItems quote={quote} />
              <QuotationAddressField address={quote.delivery_address} disabled={savingAddress} errorMessage={addressError}
                onChange={quote.status === "pending" ? (address) => void saveAddress(address.id) : undefined} />
              {quote.accepted_shipping && (
                <section className="space-y-2 rounded-large border border-divider bg-content1 p-4">
                  <div className="flex justify-between gap-2">
                    <h2 className="font-semibold">{t("quotation.acceptedShipping", "Accepted shipping")}</h2>
                    <strong>{shippingMoney(quote.accepted_shipping.total_delivery_charges)}</strong>
                  </div>
                  <CheckoutShipping shipments={quote.accepted_shipping.seller_shipping_costs} formatPrice={shippingMoney} />
                </section>
              )}
              {!quote.accepted_shipping && quote.sea_freight && (
                <section className="space-y-1 rounded-large border border-divider bg-content1 p-4">
                  <h2 className="font-semibold">{t("checkout.shippingType.sea", "Sea freight")}</h2>
                  {quote.sea_freight.status === "quote_required" ? (
                    <p>{t("checkout.shippingQuoteRequired", "Shipping quote required")}</p>
                  ) : (
                    <>
                      {quote.sea_freight.containers?.map(({ name, count }, index) => <p key={`${name}-${index}`}>{count} × {name}</p>)}
                      <p>{quote.sea_freight.currency} {quote.sea_freight.rate?.toLocaleString(i18n.resolvedLanguage, {
                        minimumFractionDigits: 2, maximumFractionDigits: 2,
                      })}</p>
                      {quote.sea_freight.delivery_note && <p className="whitespace-pre-wrap">{quote.sea_freight.delivery_note}</p>}
                    </>
                  )}
                </section>
              )}
              {quote.customer_note && (
                <section className="space-y-1 rounded-large border border-divider bg-content1 p-4">
                  <h2 className="font-semibold">{t("quotation.customerNote")}</h2>
                  <p className="whitespace-pre-wrap break-words text-sm text-default-600">{quote.customer_note}</p>
                </section>
              )}
            </div>
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
              {quote.proforma_url && (
                <Button as="a" variant="bordered" fullWidth href={quote.proforma_url}>{t("quotation.downloadExport")}</Button>
              )}
              {quote.order_slug ? (
                <Button as={Link} color="primary" fullWidth href={`/my-account/orders/${quote.order_slug}`}>{t("quotation.viewOrder")}</Button>
              ) : quote.status === "ready_to_pay" && (
                <Button as={Link} color="primary" fullWidth href={quotationCheckoutHref(quote.id)}>
                  {t("quotation.checkout")}
                </Button>
              )}
              <Button variant="bordered" fullWidth onPress={requote.onOpen}>
                {t("quotation.requestAgain")}
              </Button>
              {quote.can_cancel && (
                <Button color="danger" variant="light" fullWidth onPress={cancellation.onOpen}>
                  {t("quotation.cancelQuotation")}
                </Button>
              )}
            </section>
          </div>
          <Modal isOpen={requote.isOpen} onOpenChange={requote.onOpenChange}
            placement="center" size="5xl" scrollBehavior="inside">
            <ModalContent>
              <ModalHeader>{t("quotation.requestAgain")}</ModalHeader>
              <ModalBody className="pb-5">
                {requote.isOpen && <QuotationRequestForm key={quote.id} previousQuote={quote} onSubmitted={(newId) => {
                  requote.onClose();
                  void router.push(`/my-account/quotations/${newId}`);
                }} />}
              </ModalBody>
            </ModalContent>
          </Modal>
          <ConfirmationModal
            isOpen={cancellation.isOpen}
            onClose={cancellation.onClose}
            onConfirm={handleCancel}
            title={t("quotation.cancelQuotation")}
            alertDescription={t("quotation.cancelConfirm")}
            confirmText={t("quotation.cancelQuotation")}
            cancelText={t("quotation.keepQuotation")}
          />
        </>
      )}
    </section>
  );
}

export const getServerSideProps = quotationPageProps;

export default withAuth(QuotationDetailPage);
