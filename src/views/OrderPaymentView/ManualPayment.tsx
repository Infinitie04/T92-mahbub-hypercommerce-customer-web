import { useState } from "react";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import HTMLRenderer from "@/components/Functional/HTMLRenderer";
import { Button, Image } from "@/components/ui";
import { useCurrency } from "@/components/Functional/Price";
import { downloadManualPaymentProof, uploadManualPaymentProof } from "@/services/orders";
import type { ManualPaymentState, Order } from "@/types/order";
import ManualPaymentProofPreview from "./ManualPaymentProofPreview";

export function manualPaymentStatusLabel(status: ManualPaymentState["status"], t: TFunction) {
  return {
    awaiting_proof: t("manualPayment.awaitingProof", "Awaiting proof"),
    pending_verification: t("manualPayment.pendingVerification", "Pending verification"),
    proof_rejected: t("manualPayment.rejected", "Proof rejected"),
    verified: t("manualPayment.verified", "Verified"),
  }[status];
}

export default function ManualPayment({ order }: { order: Order }) {
  const { t, i18n } = useTranslation();
  const { formatWith } = useCurrency();
  const [payment, setPayment] = useState(order.manual_payment);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");

  if (!payment) return null;

  const { instructions, proof } = payment;
  const closed = order.status === "cancelled" || order.payment_status === "failed";
  const status = manualPaymentStatusLabel(payment.status, t);

  const upload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;
    const form = event.currentTarget;
    setBusy(true);
    setError("");
    try {
      setPayment(await uploadManualPaymentProof(order.slug, file));
      form.reset();
      setFile(null);
    } catch (failure) {
      setError(isAxiosError(failure) && failure.response?.data?.message
        ? failure.response.data.message
        : t("manualPayment.uploadError", "The receipt could not be uploaded. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!proof) return;
    setError("");
    setDownloading(true);
    try {
      await downloadManualPaymentProof(order.slug, proof.id, proof.filename);
    } catch {
      setError(t("manualPayment.downloadError", "The receipt could not be downloaded. Try again."));
    } finally {
      setDownloading(false);
    }
  };

  return (
    <main className="mx-auto my-8 w-full max-w-xl px-4">
      <section className="space-y-5 rounded-large border border-divider bg-content1 p-6">
        <div className="flex items-center gap-3">
          {instructions?.image && <Image src={instructions.image} alt="" width={44} height={44} />}
          <div>
            <h1 className="text-lg font-bold">{instructions?.title || t("manualPayment.title", "Manual Payment")}</h1>
            <p role="status" className="text-sm text-default-600">
              {closed ? t("manualPayment.closed", "This order is closed for payment") : status}
            </p>
          </div>
        </div>
        <div>
          <p className="text-sm text-default-600">{t("manualPayment.amount", "Amount to transfer")}</p>
          <p className="font-semibold">
            {formatWith(order.total_payable ?? order.final_total, order.currency_symbol, order.format)} {order.currency_code}
          </p>
        </div>
        {!closed && instructions && (
          <>
            {instructions.fields.length > 0 && (
              <dl className="space-y-2">
                {instructions.fields.map(({ title, value }, index) => (
                  <div key={index} className="grid grid-cols-2 gap-3 border-b border-divider pb-2 text-sm">
                    <dt className="text-default-600">{title}</dt>
                    <dd className="break-words font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {instructions.notes && <HTMLRenderer html={instructions.notes} className="text-sm" />}
          </>
        )}
        {payment.due_at && !closed && (
          <p className="text-sm text-default-600">
            {t("manualPayment.deadline", "Upload proof by {{deadline}}", {
              deadline: new Date(payment.due_at).toLocaleString(i18n.resolvedLanguage, {
                dateStyle: "medium",
                timeStyle: "short",
              }),
            })}
          </p>
        )}
        {proof && (
          <div className="space-y-2">
            <Button type="button" size="sm" variant="bordered" onPress={download} isLoading={downloading}>
              {t("manualPayment.download", "Download receipt")}
            </Button>
            <p className="break-words text-sm text-default-600">{proof.filename}</p>
            <ManualPaymentProofPreview key={proof.id} slug={order.slug} proofId={proof.id} filename={proof.filename} />
            {proof.rejection_reason && <p className="text-sm text-danger">{proof.rejection_reason}</p>}
          </div>
        )}
        {payment.can_upload && !closed && (
          <form onSubmit={upload} className="space-y-3">
            <label className="block text-sm font-medium" htmlFor="manual-payment-receipt">
              {t("manualPayment.receipt", "Payment receipt")}
            </label>
            <input
              id="manual-payment-receipt"
              className="block w-full text-sm"
              type="file"
              accept="image/jpeg,image/png,application/pdf"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              disabled={busy}
              required
              aria-describedby="manual-payment-file-types"
            />
            <p id="manual-payment-file-types" className="text-xs text-default-600">
              {t("manualPayment.fileTypes", "JPEG, PNG, or PDF, up to 10 MB")}
            </p>
            <Button color="primary" type="submit" isDisabled={!file} isLoading={busy}>
              {payment.status === "pending_verification"
                ? t("manualPayment.replace", "Replace receipt")
                : t("manualPayment.upload", "Upload receipt")}
            </Button>
          </form>
        )}
        {error && <p role="alert" className="text-sm text-danger">{error}</p>}
        <Button as="a" href={`/my-account/orders/${order.slug}`} variant="light">
          {t("quotation.viewOrder", "View order")}
        </Button>
      </section>
    </main>
  );
}
