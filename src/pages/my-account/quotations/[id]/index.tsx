import { quotationCheckoutHref } from "@/helpers/quotationCheckout";
import { quotationPageProps } from "@/helpers/quotationPage";
import { Button, EmptyState, ErrorState, Modal, ModalBody, ModalContent, ModalHeader, Skeleton, toastError, useDisclosure } from "@/components/ui";
import ConfirmationModal from "@/components/Modals/ConfirmationModal";
import MyBreadcrumbs from "@/components/custom/MyBreadcrumbs";
import QuotationItems from "@/components/Quotations/QuotationItems";
import QuotationNegotiation from "@/components/Quotations/QuotationNegotiation";
import QuotationRequestForm from "@/components/Quotations/QuotationRequestForm";
import QuotationAddressField from "@/components/Quotations/QuotationAddressField";
import QuotationAgreedItems from "@/components/Quotations/QuotationAgreedItems";
import { CheckoutShipping } from "@/views/CheckoutPageView/CheckoutBreakdown";
import { useQuotationMoney } from "@/components/Quotations/quotationPresentation";
import { withAuth } from "@/guards/withAuth";
import { getFormattedDate } from "@/helpers/getters";
import type { RootState } from "@/lib/redux/store";
import PageHead from "@/SEO/PageHead";
import { cancelQuotation, getQuotation, quotationError, updateQuotationAddress, type QuotationDetail } from "@/services/quotations";
import { isAxiosError } from "axios";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import useSWR from "swr";
import { Handshake } from "lucide-react";
import styles from "@/components/Quotations/QuotationDetail.module.css";

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
  const shipping = quote?.accepted_shipping;
  const extraCharges = shipping?.seller_shipping_costs.reduce(
    (total, shipment) => total + (shipment.additional_charges ?? []).reduce((sum, charge) => sum + charge.amount, 0),
    0,
  ) ?? 0;
  const activity = quote ? [
    { label: t("quotation.submitted"), time: quote.created_at },
    ...(quote.partial_confirmed_at ? [{ label: t("quotation.negotiation.partialConfirmed"), time: quote.partial_confirmed_at }] : []),
    ...(quote.reviewed_at ? [{
      label: t(quote.status === "rejected" ? "quotation.status.rejected" : "quotation.status.accepted"),
      time: quote.reviewed_at,
    }] : []),
    ...(quote.payment_requested_at ? [{ label: t("quotation.status.ready_to_pay"), time: quote.payment_requested_at }] : []),
    ...(quote.status === "ordered" ? [{ label: t("quotation.status.ordered"), time: null }] : []),
    ...(quote.status === "cancelled" ? [{ label: t("quotation.status.cancelled"), time: quote.cancelled_at }] : []),
  ] : [];
  const title = t("quotation.number", { id });

  function refreshQuote(updated?: QuotationDetail) {
    return updated ? mutate(updated, { revalidate: false }) : mutate();
  }

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
    <section className="mx-auto w-full max-w-site px-4 pb-6 text-foreground sm:px-6">
      <PageHead pageTitle={id ? title : t("quotation.history")} />
      <MyBreadcrumbs separator="/" maxItems={5} breadcrumbs={[
        { href: "/my-account", label: t("userLayout.myAccount") },
        { href: "/my-account/quotations", label: t("quotation.title") },
        { label: title },
      ]} />
      {isAxiosError(error) && error.response?.status === 404 ? (
        <EmptyState title={t("quotation.notFound")} actionLabel={t("quotation.history")} onAction={() => void router.push("/my-account/quotations")} />
      ) : error ? (
        <ErrorState title={t("quotation.loadError")} description={quotationError(error, t("quotation.error"))} onRetry={() => void mutate()} />
      ) : !quote ? (
        <Skeleton className="h-48 rounded-large" />
      ) : (
        <>
          <div className={styles.layout}>
            <div className={styles.main}>
              <header className={styles.heading}>
                <h1>{t("quotation.detail.title")}</h1>
                <div className={styles.metadata}>
                  <span>{t("quotation.detail.identifier", { id: quote.id })}</span>
                  <span className={styles.created}>
                    {t("quotation.detail.created", {
                      date: getFormattedDate(quote.created_at, i18n.resolvedLanguage, {
                        day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
                      }),
                    })}
                  </span>
                  <span className={`${styles.badge} ${quote.status === "negotiating" || quote.status === "rejected"
                    ? styles.danger : quote.status === "pending" || quote.status === "awaiting_customer_confirmation"
                      ? styles.warning : quote.status === "cancelled" ? styles.neutral : styles.success}`}>
                    {quote.status === "negotiating" && <Handshake size={15} aria-hidden="true" />}
                    {t(`quotation.status.${quote.status}`)}
                  </span>
                </div>
              </header>

              <section className={styles.itemsPanel}>
                <header>
                  <h2>{t("quotation.detail.itemsTitle")}</h2>
                  {quote.items.some((item) => item.can_respond) && (
                    <p>{t("quotation.detail.itemsDescription")}</p>
                  )}
                </header>
                {quote.items.length === 0 ? <p className="px-3 pb-2">{t("quotation.noItems")}</p> : quote.item_negotiation
                  ? <QuotationNegotiation key={quote.id} quote={quote} onUpdated={refreshQuote} />
                  : <QuotationItems quote={quote} detail />}
              </section>

              {quote.customer_note && (
                <section className={styles.panel}>
                  <h2 className={styles.panelTitle}>{t("quotation.customerNote")}</h2>
                  <p className="whitespace-pre-wrap break-words text-sm text-default-700">{quote.customer_note}</p>
                </section>
              )}

              <section className={styles.panel}>
                <h2 className={styles.panelTitle}>{t("quotation.activity")}</h2>
                <ol className="space-y-3 border-s border-divider ps-3">
                  {activity.map(({ label, time }) => (
                    <li key={label}>
                      <p className="text-sm font-medium">{label}</p>
                      {time && <time dateTime={time} className="text-xs text-default-600">{getFormattedDate(time, i18n.resolvedLanguage)}</time>}
                    </li>
                  ))}
                </ol>
                {quote.remark && (
                  <div className="mt-3 border-t border-divider pt-3">
                    <h3 className="mb-1 text-sm font-semibold">{t("quotation.remark")}</h3>
                    <p className="whitespace-pre-wrap break-words text-sm text-default-700">{quote.remark}</p>
                  </div>
                )}
              </section>
            </div>

            <aside className={styles.sidebar}>
              <QuotationAddressField detail address={quote.delivery_address} disabled={savingAddress} errorMessage={addressError}
                onChange={(quote.can_update_address ?? quote.status === "pending") ? (address) => void saveAddress(address.id) : undefined} />

              <section className={styles.panel}>
                <h2 className={styles.panelTitle}>{t("quotation.detail.priceSummary")}</h2>
                <dl className={styles.summary}>
                  <div>
                    <dt>{t(quote.item_negotiation ? "quotation.negotiation.agreedSubtotal" : "quotation.subtotal")}</dt>
                    <dd>{money(quote.subtotal)}</dd>
                  </div>
                  {shipping && (
                    <>
                      <div>
                        <dt>{t("quotation.shipping")}</dt>
                        <dd>{shippingMoney(shipping.total_delivery_charges - extraCharges)}</dd>
                      </div>
                      {extraCharges !== 0 && (
                        <div>
                          <dt>{t("quotation.detail.extraCharges")}</dt>
                          <dd>{shippingMoney(extraCharges)}</dd>
                        </div>
                      )}
                      {shipping.currency_code === quote.currency_code && (
                        <div className={styles.total}>
                          <dt>{t("quotation.detail.merchandiseAndShipping")}</dt>
                          <dd>{money(quote.subtotal + shipping.total_delivery_charges)}</dd>
                        </div>
                      )}
                    </>
                  )}
                </dl>
                {shipping && (
                  <div className="mt-3 text-sm">
                    <CheckoutShipping shipments={shipping.seller_shipping_costs} formatPrice={shippingMoney} />
                  </div>
                )}
                {!shipping && quote.sea_freight && (
                  <div className="mt-3 space-y-1 border-t border-divider pt-3 text-sm">
                    <h3 className="font-semibold">{t("checkout.shippingType.sea", "Sea freight")}</h3>
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
                  </div>
                )}
                {quote.item_negotiation && <QuotationAgreedItems key={quote.id} quote={quote} onUpdated={refreshQuote} />}
              </section>

              <section className={styles.panel}>
                <h2 className={styles.panelTitle}>{t("quotation.detail.customerActions")}</h2>
                <div className={styles.sidebarActions}>
                  {quote.order_slug ? (
                    <Button as={Link} color="primary" className={styles.action} fullWidth href={`/my-account/orders/${quote.order_slug}`}>
                      {t("quotation.viewOrder")}
                    </Button>
                  ) : quote.status === "ready_to_pay" && (
                    <Button as={Link} color="primary" className={styles.action} fullWidth href={quotationCheckoutHref(quote.id)}>
                      {t("quotation.checkout")}
                    </Button>
                  )}
                  {quote.proforma_url && (
                    <Button as="a" color="default" className={styles.action} variant="bordered" fullWidth href={quote.proforma_url}>{t("quotation.downloadExport")}</Button>
                  )}
                  <Button color="default" className={styles.action} variant="bordered" fullWidth onPress={requote.onOpen}>
                    {t("quotation.detail.requestNew")}
                  </Button>
                  {quote.can_cancel && (
                    <Button color="default" size="sm" className={`${styles.action} text-default-600`} variant="light" fullWidth onPress={cancellation.onOpen}>
                      {t("quotation.cancelQuotation")}
                    </Button>
                  )}
                </div>
              </section>
            </aside>
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
