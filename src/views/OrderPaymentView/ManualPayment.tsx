import { useState } from "react";
import { isAxiosError } from "axios";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import AttachmentUploader, { type AttachmentFile } from "@/components/Cart/AttachmentUploader";
import HTMLRenderer from "@/components/Functional/HTMLRenderer";
import { Alert, Button, Chip, Image } from "@/components/ui";
import { useCurrency } from "@/components/Functional/Price";
import { getFormattedDate } from "@/helpers/getters";
import { uploadManualPaymentProof } from "@/services/orders";
import type { ManualPaymentProof, ManualPaymentState, Order } from "@/types/order";
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
  const { t } = useTranslation();
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
  const [latestReceipt, ...previousReceipts] = payment.proof_history ?? (proof ? [proof] : []);
  const closed = order.status === "cancelled" || order.payment_status === "failed";
  const pendingReview = status === "pending_verification";
  const canUpload = payment.can_upload && !closed;
  const showUpload = canUpload && (!pendingReview || replacing);
  const statusColor = status === "verified" ? "success" : status === "proof_rejected" ? "danger" : "warning";
  const transferFields = instructions?.fields ?? [];
  const activePayment = !closed && status !== "verified";

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

  const renderReceipt = (receipt: ManualPaymentProof) => (
    <div key={receipt.id} className="space-y-1 border-b border-divider py-2 last:border-b-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <p className="min-w-0 break-all text-sm font-medium">{receipt.filename}</p>
        {receipt.status && (
          <Chip size="sm" variant="flat" color={receipt.status === "verified" ? "success" : receipt.status === "rejected" ? "danger" : receipt.status === "pending" ? "warning" : "default"}>
            {receipt.status === "superseded" ? t("manualPayment.superseded", "Replaced")
              : manualPaymentStatusLabel(receipt.status === "pending" ? "pending_verification"
                : receipt.status === "rejected" ? "proof_rejected" : "verified", t)}
          </Chip>
        )}
      </div>
      {receipt.created_at && <p className="text-sm text-default-600">
        {getFormattedDate(receipt.created_at)}
      </p>}
      {receipt.reviewed_at && <p className="text-sm text-default-600">
        {t("manualPayment.reviewedOn", "Reviewed {{date}}", {
          date: getFormattedDate(receipt.reviewed_at),
        })}
      </p>}
      {receipt.rejection_reason && <p className="break-words text-sm text-danger">
        <strong>{t("manualPayment.reason", "Reason")}</strong>{" · "}{receipt.rejection_reason}
      </p>}
      <ManualPaymentProofPreview compact={embedded || receipt.status === "rejected"} slug={order.slug} proofId={receipt.id} filename={receipt.filename} />
    </div>
  );

  return (
    <section id="manual-payment" aria-labelledby="manual-payment-title"
      className={`rounded-large border border-divider bg-content1 ${embedded ? "space-y-3 p-4" : "mx-auto my-8 max-w-2xl space-y-5 p-4 sm:p-6"}`}>
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          {instructions?.image && <Image src={instructions.image} alt="" width={embedded ? 32 : 44} height={embedded ? 32 : 44} />}
          <div>
            <h2 id="manual-payment-title" className={embedded ? "text-base font-semibold" : "text-xl font-semibold"}>
              {instructions?.title || t("manualPayment.title", "Manual Payment")}
            </h2>
            {!embedded && <p className="text-sm text-default-600">
              {t("manualPayment.orderReference", "Order #{{id}}", { id: order.id })}
            </p>}
          </div>
        </div>
        <Chip
          role="status"
          size="lg"
          variant="flat"
          color={closed ? "default" : statusColor}
          classNames={{ base: "h-auto max-w-full px-2 py-1.5", content: "whitespace-normal text-base font-semibold leading-snug" }}
        >
          {closed ? t("manualPayment.closed", "Closed for payment") : manualPaymentStatusLabel(status, t)}
        </Chip>
      </header>

      <div>
        <p className="text-sm text-default-600">
          {closed || status !== "awaiting_proof"
            ? t("manualPayment.orderAmount", "Order payment amount")
            : t("manualPayment.amount", "Amount to transfer")}
        </p>
        <p className={embedded ? "text-lg font-semibold" : "text-xl font-semibold"}>
          {formatWith(order.total_payable ?? order.final_total, order.currency_symbol, order.format)} {order.currency_code}
        </p>
      </div>

      {!embedded && pendingReview && !closed && <Alert color="warning" variant="faded"
        title={t("manualPayment.receiptReceived", "Receipt submitted")}
        description={t("manualPayment.reviewHelp", "We’ll verify your transfer. You can replace the receipt while it’s under review.")} />}
      {!embedded && status === "proof_rejected" && !closed && <Alert color="danger" variant="faded"
        title={t("manualPayment.rejected", "Proof rejected")}
        description={canUpload ? t("manualPayment.retryHelp", "Check the rejection reason in Receipt history and upload a new receipt.") : undefined} />}
      {!embedded && status === "verified" && <Alert color="success" variant="faded"
        title={t("manualPayment.paymentVerified", "Payment verified")} />}

      {activePayment && (
        <section aria-labelledby="manual-payment-instructions" className="space-y-2 border-t border-divider pt-3">
          {transferFields.length > 0 && (
            <div className="space-y-1.5 rounded-medium bg-default-100 px-3 py-2">
              <h3 className="text-sm font-semibold">
                {t("manualPayment.transferDetails", "Transfer details")}
              </h3>
              <dl className={`grid gap-x-4 gap-y-1.5 ${embedded ? "" : "sm:grid-cols-2"}`}>
                {transferFields.map(({ title, value }, index) => (
                  <div key={index} className="min-w-0">
                    <dt className="break-words text-xs text-default-600">{title}</dt>
                    <dd className="whitespace-pre-wrap break-words text-sm font-medium">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
          <div className="space-y-1 text-xs leading-normal text-default-700">
            <h3 id="manual-payment-instructions" className="font-semibold">
              {t("manualPayment.instructions", "Payment instructions")}
            </h3>
            {instructions?.notes ? (
              <HTMLRenderer html={instructions.notes} className="break-words [&_h4]:my-1! [&_h4]:text-xs! [&_li]:mb-0! [&_p]:mb-1! [&_p:last-child]:mb-0!" />
            ) : (
              <p>
                {pendingReview
                  ? t("manualPayment.reviewInstructions", "Your receipt is under review. You can replace it if needed.")
                  : transferFields.length > 0
                    ? t("manualPayment.transferInstructions", "Transfer the order amount, then upload your receipt.")
                    : t("manualPayment.missingBankDetails", "Contact support for bank details before sending a transfer.")}
              </p>
            )}
          </div>
        </section>
      )}

      {payment.due_at && !closed && (
        <Alert color="warning" variant="faded" description={t("manualPayment.deadline", "Upload proof by {{deadline}}", {
          deadline: getFormattedDate(payment.due_at),
        })} />
      )}

      {latestReceipt && (
        <section aria-label={t("manualPayment.history", "Receipt history")} className="border-t border-divider pt-2">
          <h3 className="text-sm font-semibold">{t("manualPayment.latestReceipt", "Latest receipt")}</h3>
          {renderReceipt(latestReceipt)}
          {previousReceipts.length > 0 && (
            <details className="mt-2 border-t border-divider pt-2">
              <summary className="cursor-pointer text-sm font-medium text-primary">
                {t("manualPayment.previousReceipts", "Previous receipts ({{count}})", { count: previousReceipts.length })}
              </summary>
              {previousReceipts.map(renderReceipt)}
            </details>
          )}
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
          {viewOrder}
          {pendingReview && canUpload && <Button className={embedded ? "w-full" : undefined} size="md" variant="bordered" onPress={() => setReplacing(true)}>
            {t("manualPayment.replace", "Replace receipt")}
          </Button>}
        </div>
      )}
    </section>
  );
}
