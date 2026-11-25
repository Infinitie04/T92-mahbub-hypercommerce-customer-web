import ConfirmationModal from "@/components/Modals/ConfirmationModal";
import { Button, useDisclosure } from "@/components/ui";
import { confirmPartialQuotation, quotationError, type QuotationDetail } from "@/services/quotations";
import { CircleCheck } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuotationMoney } from "./quotationPresentation";
import styles from "./QuotationDetail.module.css";

export default function QuotationAgreedItems({ quote, onUpdated }: {
  quote: QuotationDetail;
  onUpdated: (updated?: QuotationDetail) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const money = useQuotationMoney(quote.currency_code);
  const decline = useDisclosure();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const items = quote.items.filter((item) => item.status === "agreed");
  const awaitingConfirmation = quote.status === "awaiting_customer_confirmation";

  async function decide(decision: "confirm" | "decline") {
    if (saving || !awaitingConfirmation) return;
    setSaving(true);
    setError("");

    try {
      await onUpdated(await confirmPartialQuotation(quote.id, decision));
    } catch (failure) {
      setError(quotationError(failure, t("quotation.error")));
      await onUpdated();
    } finally {
      setSaving(false);
    }
  }

  if (!items.length && !awaitingConfirmation) return null;

  return (
    <div className="mt-3 space-y-3 border-t border-divider pt-3">
      {items.length > 0 && (
        <div className="rounded-medium border border-divider bg-content2 px-3 py-2.5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CircleCheck size={16} className="shrink-0 text-success-700" aria-hidden="true" />
            {t("quotation.detail.agreedItems")}
          </h3>
          <ul className="mt-1 divide-y divide-divider">
            {items.map((item, index) => (
              <li key={item.id ?? index} className="py-2 text-sm last:pb-0">
                <p className="break-words font-medium">{item.title}</p>
                {item.variant_title !== item.title && <p className="break-words text-xs text-default-600">{item.variant_title}</p>}
                <p className="mt-0.5 text-default-700 tabular-nums">{item.quantity} × {money(item.unit_price)}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
      {awaitingConfirmation && (
        <div className="space-y-2">
          <p className="text-sm text-default-700">{t("quotation.negotiation.partialExplanation")}</p>
          <Button color="primary" className={styles.action} fullWidth isLoading={saving} onPress={() => void decide("confirm")}>
            {t("quotation.negotiation.continue")}
          </Button>
          <Button color="default" variant="light" size="sm" className={styles.action} fullWidth isDisabled={saving} onPress={decline.onOpen}>
            {t("quotation.negotiation.decline")}
          </Button>
          <ConfirmationModal isOpen={decline.isOpen} onClose={decline.onClose}
            onConfirm={() => decide("decline")}
            title={t("quotation.negotiation.decline")}
            alertDescription={t("quotation.cancelConfirm")}
            confirmText={t("quotation.negotiation.decline")} cancelText={t("quotation.keepQuotation")} />
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
    </div>
  );
}
