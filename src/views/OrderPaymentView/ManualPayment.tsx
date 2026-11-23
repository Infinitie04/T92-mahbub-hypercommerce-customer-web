import { useState } from "react";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import AttachmentUploader, { type AttachmentFile } from "@/components/Cart/AttachmentUploader";
import HTMLRenderer from "@/components/Functional/HTMLRenderer";
import { Alert, Button, Chip, Image } from "@/components/ui";
import { useCurrency } from "@/components/Functional/Price";
import { uploadManualPaymentProof } from "@/services/orders";
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

export default function ManualPayment({ order, embedded = false }: { order: Order; embedded?: boolean }) {
  const { t, i18n } = useTranslation();
  const { formatWith } = useCurrency();
  const [submission, setSubmission] = useState<{ original: ManualPaymentState; payment: ManualPaymentState }>();
  const [attachments, setAttachments] = useState<AttachmentFile[]>([]);
  const [replacing, setReplacing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const original = order.manual_payment;
  const payment = submission && submission.original === original ? submission.payment : original;
  if (!payment || !original) return null;

  const { instructions, proof, status } = payment;
  const history = payment.proof_history ?? (proof ? [proof] : []);
  const closed = order.status === "cancelled" || order.payment_status === "failed";
  const pendingReview = status === "pending_verification";
  const canUpload = payment.can_upload && !closed;
  const showUpload = canUpload && (!pendingReview || replacing);
  const statusColor = status === "verified" ? "success" : status === "proof_rejected" ? "danger" : "warning";
  const formatDate = (value: string) =>
    new Date(value).toLocaleString(i18n.resolvedLanguage, { dateStyle: "medium", timeStyle: "short" });
  const transferDetails = instructions && (instructions.fields.length > 0 || instructions.notes) ? (
    <div className="mt-3 space-y-4">
      {instructions.fields.length > 0 && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 rounded-medium bg-default-100 p-4 sm:grid-cols-2">
          {instructions.fields.map(({ title, value }, index) => (
            <div key={index} className="min-w-0">
              <dt className="text-sm text-default-600">{title}</dt>
              <dd className="whitespace-pre-wrap break-words text-base font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {instructions.notes && (
        <div>
          <h3 className="mb-2 font-semibold">{t("manualPayment.instructions", "Payment instructions")}</h3>
          <HTMLRenderer html={instructions.notes} className="text-base leading-relaxed" />
        </div>
      )}
    </div>
  ) : null;

  const upload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!attachments[0] || busy) return;
    setBusy(true);
    setError("");
    try {
      setSubmission({ original, payment: await uploadManualPaymentProof(order.slug, attachments[0].file) });
      setAttachments([]);
      setReplacing(false);
    } catch (failure) {
      setError(isAxiosError(failure) && typeof failure.response?.data?.message === "string"
        ? failure.response.data.message
        : t("manualPayment.uploadError", "The receipt could not be uploaded. Try again."));
    } finally {
      setBusy(false);
    }
  };

  const viewOrder = !embedded && (
    <Button as="a" href={`/my-account/orders/${order.slug}`} size="md" variant="bordered">
      {t("quotation.viewOrder", "View order")}
    </Button>
  );

  return (
    <section id="manual-payment" aria-labelledby="manual-payment-title"
      className={`${embedded ? "mb-6" : "mx-auto my-8 max-w-2xl"} space-y-5 rounded-large border border-divider bg-content1 p-4 sm:p-6`}>
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          {instructions?.image && <Image src={instructions.image} alt="" width={44} height={44} />}
          <div>
            <h2 id="manual-payment-title" className="text-xl font-semibold">
              {instructions?.title || t("manualPayment.title", "Manual Payment")}
            </h2>
            <p className="text-sm text-default-600">
              {t("manualPayment.orderReference", "Order #{{id}}", { id: order.id })}
            </p>
          </div>
        </div>
        <Chip role="status" variant="flat" color={closed ? "default" : statusColor}>
          {closed ? t("manualPayment.closed", "Closed for payment") : manualPaymentStatusLabel(status, t)}
        </Chip>
      </header>

      <div>
        <p className="text-sm text-default-600">
          {closed || status !== "awaiting_proof"
            ? t("manualPayment.orderAmount", "Order payment amount")
            : t("manualPayment.amount", "Amount to transfer")}
        </p>
        <p className="text-xl font-semibold">
          {formatWith(order.total_payable ?? order.final_total, order.currency_symbol, order.format)} {order.currency_code}
        </p>
      </div>

      {pendingReview && !closed && <Alert color="warning" variant="faded"
        title={t("manualPayment.receiptReceived", "Receipt submitted")}
        description={t("manualPayment.reviewHelp", "We’ll verify your transfer. You can replace the receipt while it’s under review.")} />}
      {status === "proof_rejected" && !closed && <Alert color="danger" variant="faded"
        title={t("manualPayment.rejected", "Proof rejected")}
        description={canUpload ? t("manualPayment.retryHelp", "Check the rejection reason in Receipt history and upload a new receipt.") : undefined} />}
      {status === "verified" && <Alert color="success" variant="faded"
        title={t("manualPayment.paymentVerified", "Payment verified")} />}

      {transferDetails && ((pendingReview || status === "verified" || closed) ? (
        <details>
          <summary className="cursor-pointer font-medium text-primary">{t("manualPayment.transferDetails", "Transfer details")}</summary>
          {transferDetails}
        </details>
      ) : transferDetails)}

      {payment.due_at && !closed && (
        <Alert color="warning" variant="faded" description={t("manualPayment.deadline", "Upload proof by {{deadline}}", {
          deadline: formatDate(payment.due_at),
        })} />
      )}

      {history.length > 0 && (
        <section className="space-y-3" aria-label={t("manualPayment.history", "Receipt history")}>
          <h3 className="text-lg font-semibold">{t("manualPayment.history", "Receipt history")}</h3>
          {history.map((receipt) => (
            <div key={receipt.id} className="space-y-2 rounded-medium border border-divider p-4">
              <div className="flex flex-wrap items-center gap-2">
                <p className="min-w-0 break-all font-medium">{receipt.filename}</p>
                {receipt.status && (
                  <Chip variant="flat" color={receipt.status === "verified" ? "success" : receipt.status === "rejected" ? "danger" : receipt.status === "pending" ? "warning" : "default"}>
                    {receipt.status === "superseded" ? t("manualPayment.superseded", "Replaced")
                      : manualPaymentStatusLabel(receipt.status === "pending" ? "pending_verification"
                        : receipt.status === "rejected" ? "proof_rejected" : "verified", t)}
                  </Chip>
                )}
              </div>
              {receipt.created_at && <p className="text-sm text-default-600">{formatDate(receipt.created_at)}</p>}
              {receipt.rejection_reason && <p className="break-words text-sm text-danger">
                <strong>{t("manualPayment.reason", "Reason")}</strong>{" · "}{receipt.rejection_reason}
              </p>}
              <ManualPaymentProofPreview slug={order.slug} proofId={receipt.id} filename={receipt.filename} />
            </div>
          ))}
        </section>
      )}

      {showUpload ? (
        <form onSubmit={upload} className="space-y-4">
          <fieldset className="min-w-0 space-y-2">
            <legend className="mb-2 font-semibold">
              {t("manualPayment.receipt", "Payment receipt")} <span className="text-danger" aria-hidden="true">*</span>
            </legend>
            <AttachmentUploader attachment={attachments} onAttachmentChange={setAttachments} paymentReceipt disabled={busy} />
          </fieldset>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}
          <div className="flex flex-col-reverse gap-2 border-t border-divider pt-4 sm:flex-row sm:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row">
              {viewOrder}
              {pendingReview && <Button type="button" size="md" variant="light" isDisabled={busy} onPress={() => {
                setAttachments([]);
                setError("");
                setReplacing(false);
              }}>{t("cancel", "Cancel")}</Button>}
            </div>
            <Button color="primary" size="md" type="submit" isDisabled={attachments.length === 0} isLoading={busy}>
              {pendingReview ? t("manualPayment.replace", "Replace receipt") : t("manualPayment.upload", "Upload receipt")}
            </Button>
          </div>
        </form>
      ) : (viewOrder || (pendingReview && canUpload)) && (
        <div className="flex flex-col-reverse gap-2 border-t border-divider pt-4 sm:flex-row sm:justify-between">
          {viewOrder || <span />}
          {pendingReview && canUpload && <Button size="md" variant="bordered" onPress={() => setReplacing(true)}>
            {t("manualPayment.replace", "Replace receipt")}
          </Button>}
        </div>
      )}
    </section>
  );
}
