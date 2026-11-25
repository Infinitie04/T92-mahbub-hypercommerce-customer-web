import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input } from "@/components/ui";
import ConfirmationModal from "@/components/Modals/ConfirmationModal";
import { CircleCheck, CircleX, Clock } from "lucide-react";
import {
  confirmPartialQuotation, quotationError, respondToQuotationItems,
  type QuotationDetail, type QuotationResponse,
} from "@/services/quotations";
import QuotationItems from "./QuotationItems";
import { useQuotationMoney } from "./quotationPresentation";
import styles from "./QuotationDetail.module.css";

const actions = ["accept", "counter", "reject"] as const;
const statusColors = { awaiting_admin: styles.neutral, awaiting_customer: styles.warning, agreed: styles.success, rejected: styles.danger };
const statusIcons = { awaiting_admin: Clock, awaiting_customer: Clock, agreed: CircleCheck, rejected: CircleX };

export default function QuotationNegotiation({ quote, onUpdated }: {
  quote: QuotationDetail;
  onUpdated: (quote?: QuotationDetail) => Promise<unknown>;
}) {
  const { t } = useTranslation();
  const money = useQuotationMoney(quote.currency_code);
  const [selected, setSelected] = useState<Record<number, QuotationResponse>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showDecline, setShowDecline] = useState(false);
  const responses = Object.values(selected).filter((response) =>
    quote.items.some((item) => item.can_respond && item.id === response.item_id && item.current_offer_id === response.offer_id),
  );

  async function save(update: () => Promise<QuotationDetail>) {
    setError("");
    setSaving(true);
    try {
      await onUpdated(await update());
      setSelected({});
    } catch (failure) {
      setError(quotationError(failure, t("quotation.error")));
      await onUpdated();
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="space-y-3" aria-label={t("quotation.negotiation.title")}>
      <form className="space-y-3" onSubmit={(event) => {
        event.preventDefault();
        if (!saving && responses.length) void save(() => respondToQuotationItems(quote.id, responses));
      }}>
        <QuotationItems quote={quote} detail renderActions={(item) => {
          const itemId = item.id;
          const offerId = item.current_offer_id;
          const response = itemId === undefined ? undefined : selected[itemId];
          const draft = response?.offer_id === offerId ? response : undefined;
          const StatusIcon = item.status ? statusIcons[item.status] : null;

          return (
            <>
              {item.status && (
                <span className={`${styles.badge} ${statusColors[item.status]}`}>
                  {StatusIcon && <StatusIcon size={18} aria-hidden="true" />}
                  {item.status === "awaiting_customer"
                    ? t("quotation.detail.responseNeeded")
                    : t(`quotation.negotiation.itemStatus.${item.status}`)}
                </span>
              )}
              {item.can_respond && itemId !== undefined && offerId !== undefined && (
                <fieldset className="space-y-2" disabled={saving}>
                  <legend className="sr-only">{t("quotation.negotiation.responseFor", { item: item.title })}</legend>
                  <div className="grid gap-1.5">
                    {actions.map((action) => (
                      <Button key={action} type="button" size="sm" variant={draft?.action === action || (!draft && action === "accept") ? "solid" : "bordered"}
                        className={`${styles.action} ${draft?.action === action || (!draft && action === "accept") ? styles.primaryAction : ""}`}
                        aria-pressed={draft?.action === action} isDisabled={saving}
                        onPress={() => setSelected((previous) => {
                          const next = { ...previous };
                          if (draft?.action === action) delete next[itemId];
                          else next[itemId] = { item_id: itemId, offer_id: offerId, action };
                          return next;
                        })}>
                        {t(`quotation.detail.action.${action}`)}
                      </Button>
                    ))}
                  </div>
                  {draft?.action === "counter" && (
                    <Input type="number" min="0.01" max="99999999.99" step="0.01" isRequired
                      label={t("quotation.detail.counterPrice", { currency: quote.currency_code })}
                      value={draft.unit_price ?? ""}
                      onValueChange={(price) => setSelected((previous) => ({ ...previous, [itemId]: { ...draft, unit_price: price } }))}
                      description={draft.unit_price ? t("quotation.negotiation.offerTotal", {
                        total: money(Number(draft.unit_price) * item.quantity),
                      }) : undefined}
                    />
                  )}
                </fieldset>
              )}
            </>
          );
        }} />
        {responses.length > 0 && <Button type="submit" className={`${styles.action} ${styles.primaryAction}`} isLoading={saving}>
          {t("quotation.negotiation.send")}
        </Button>}
      </form>
      {quote.status === "awaiting_customer_confirmation" && (
        <div className={`${styles.panel} space-y-3`}>
          <p>{t("quotation.negotiation.partialExplanation")}</p>
          <div className="flex flex-wrap gap-2">
            <Button className={`${styles.action} ${styles.primaryAction}`} isLoading={saving} onPress={() => void save(() => confirmPartialQuotation(quote.id, "confirm"))}>
              {t("quotation.negotiation.continue")}
            </Button>
            <Button className={`${styles.action} ${styles.destructiveAction}`} variant="bordered" isDisabled={saving} onPress={() => setShowDecline(true)}>
              {t("quotation.negotiation.decline")}
            </Button>
          </div>
          <ConfirmationModal isOpen={showDecline} onClose={() => setShowDecline(false)}
            onConfirm={() => save(() => confirmPartialQuotation(quote.id, "decline"))}
            title={t("quotation.negotiation.decline")}
            alertDescription={t("quotation.cancelConfirm")}
            confirmText={t("quotation.negotiation.decline")} cancelText={t("quotation.keepQuotation")} />
        </div>
      )}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
    </section>
  );
}
