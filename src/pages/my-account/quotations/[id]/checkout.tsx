import { withAuth } from "@/guards/withAuth";
import AddressSection from "@/components/Cart/AddressSection";
import AddressModal from "@/components/Modals/AddressModal";
import QuotationItems from "@/components/Quotations/QuotationItems";
import { Button, Spinner } from "@/components/ui";
import type { RootState } from "@/lib/redux/store";
import PageHead from "@/SEO/PageHead";
import { getQuotation, payQuotation, previewQuotation, quotationError, quoteMoney } from "@/services/quotations";
import type { Address } from "@/types/ApiResponse";
import CheckoutLayout from "@/views/CheckoutPageView/CheckoutLayout";
import { isAxiosError } from "axios";
import Link from "next/link";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import useSWR from "swr";

function QuotationCheckoutPage() {
  const router = useRouter();
  const id = typeof router.query.id === "string" ? router.query.id : "";
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { data: quote, error: quoteError } = useSWR(id && userId ? ["quotation", userId, id] : null, () => getQuotation(id));
  const selectedAddress = useSelector((state: RootState) => state.checkout.selectedAddress);
  const [addressId, setAddressId] = useState<number>();
  const [addressModal, setAddressModal] = useState(false);
  const [files, setFiles] = useState<Record<number, File[]>>({});
  const [submitting, setSubmitting] = useState(false);
  const [paymentError, setPaymentError] = useState("");
  const onAddressSelected = useCallback((address: Address) => {
    setAddressId(Number(address.id));
    setPaymentError("");
  }, []);
  const canPreview = quote?.status === "ready_to_pay" && addressId && addressId === Number(selectedAddress?.id);
  const { data: preview, error: previewError, isValidating, mutate } = useSWR(
    canPreview ? ["quotation-preview", userId, id, addressId] : null,
    () => previewQuotation(id, addressId!),
    { shouldRetryOnError: false, revalidateOnFocus: false },
  );
  const pendingSlug = quote?.payment_order_slug || (preview && "order_slug" in preview ? preview.order_slug : null);
  const reviewed = preview && "totals" in preview ? preview : null;

  useEffect(() => {
    if (pendingSlug) void router.replace(`/payment/${pendingSlug}`);
  }, [pendingSlug, router]);

  const pay = async () => {
    if (!reviewed || !canPreview || submitting) return;
    const body = new FormData();
    body.set("address_id", String(addressId));
    body.set("pricing_review_token", reviewed.pricing_review_token);
    for (const [product, uploads] of Object.entries(files)) {
      for (const file of uploads) body.append(`attachments[${product}][]`, file);
    }
    setPaymentError("");
    setSubmitting(true);
    try {
      const result = await payQuotation(id, body);
      await router.push(`/payment/${result.order_slug}`);
    } catch (error) {
      setPaymentError(quotationError(error));
      if (isAxiosError(error) && error.response?.status === 409) void mutate();
    } finally {
      setSubmitting(false);
    }
  };

  if (quoteError) return <p role="alert" className="text-danger">{quotationError(quoteError)}</p>;
  if (!quote || pendingSlug) return <Spinner label="Loading quotation checkout" />;
  if (quote.status !== "ready_to_pay") {
    return <Link className="text-primary" href={`/my-account/quotations/${id}`}>Return to quotation #{id}</Link>;
  }

  return (
    <>
      <PageHead pageTitle={`Checkout quotation #${id}`} />
      <Link className="mb-3 inline-block text-sm text-primary hover:underline" href={`/my-account/quotations/${id}`}>Quotation #{id}</Link>
      <CheckoutLayout
        heading="Quotation checkout"
        details={
          <div className="space-y-4">
            <AddressSection onAddAddressModalOpen={() => setAddressModal(true)} onAddressSelected={onAddressSelected} />
            <QuotationItems quote={quote} />
            {reviewed?.attachments.map((item) => (
              <label key={item.product_id} className="block rounded-large border border-divider bg-content1 p-4">
                <span className="mb-2 block text-sm font-medium">Attachment for {item.title}{item.required ? " (required)" : ""}</span>
                <input
                  type="file"
                  multiple
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx"
                  onChange={(event) => {
                    const uploads = Array.from(event.currentTarget.files ?? []);
                    setFiles((existing) => ({ ...existing, [item.product_id]: uploads }));
                  }}
                  className="max-w-full text-sm"
                />
              </label>
            ))}
          </div>
        }
        summary={
          <div className="space-y-3 rounded-large border border-divider bg-content1 p-4 md:sticky md:top-24">
            <h2 className="font-bold">Order summary</h2>
            {!canPreview ? <p className="text-sm text-default-600">Select a delivery address to calculate your total.</p> :
              previewError ? <p role="alert" className="text-sm text-danger">{quotationError(previewError)}</p> :
              !reviewed ? <Spinner size="sm" label="Calculating total" /> : (
                <>
                  <dl className="space-y-2 text-sm">
                    {[
                      ["Merchandise (incl. tax)", reviewed.totals.items_total],
                      ["Tax included in merchandise", reviewed.totals.tax_total],
                      ["Shipping", reviewed.totals.total_delivery_charges],
                      ["Platform fee", reviewed.totals.platform_fee],
                      ["Pending charges", reviewed.totals.pending_charges_total],
                    ].map(([label, amount]) => (
                      <div key={label} className="flex justify-between gap-3">
                        <dt>{label}</dt><dd>{quoteMoney(amount, reviewed.currency_code)}</dd>
                      </div>
                    ))}
                    <div className="flex justify-between gap-3 border-t border-divider pt-2 font-bold">
                      <dt>Total</dt><dd>{quoteMoney(reviewed.totals.payable_amount, reviewed.currency_code)}</dd>
                    </div>
                  </dl>
                  {paymentError && <p role="alert" className="text-sm text-danger">{paymentError}</p>}
                  <Button
                    color="primary"
                    className="w-full"
                    isLoading={submitting}
                    isDisabled={isValidating || reviewed.attachments.some((item) => item.required && !files[item.product_id]?.length)}
                    onPress={() => void pay()}
                  >
                    Pay with Razorpay
                  </Button>
                </>
              )}
          </div>
        }
      />
      <AddressModal
        isOpen={addressModal}
        onOpenChange={setAddressModal}
        onSave={() => document.getElementById("reset-cart-addresses")?.click()}
      />
    </>
  );
}

export default withAuth(QuotationCheckoutPage);
