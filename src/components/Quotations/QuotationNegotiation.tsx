import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Input } from "@/components/ui";
import { CircleCheck, CircleX, Clock } from "lucide-react";
import {
  quotationError, respondToQuotationItems,
  type QuotationDetail, type QuotationResponse,
} from "@/services/quotations";
import QuotationItems from "./QuotationItems";
import { useQuotationMoney } from "./quotationPresentation";
import styles from "./QuotationDetail.module.css";

const actions = ["accept", "counter", "reject"] as const;
const actionColors = { accept: "success", counter: "warning", reject: "danger" } as const;
const activeActionStyles = { accept: styles.success, counter: styles.warning, reject: styles.danger };
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
                  {StatusIcon && <StatusIcon size={14} aria-hidden="true" />}
                  {item.status === "awaiting_customer"
                    ? t("quotation.detail.responseNeeded")
                    : t(`quotation.negotiation.itemStatus.${item.status}`)}
                </span>
              )}
              {item.can_respond && itemId !== undefined && offerId !== undefined && (
                <fieldset className="space-y-2" disabled={saving}>
                  <legend className="sr-only">{t("quotation.negotiation.responseFor", { item: item.title })}</legend>
                  <div className="grid gap-1.5">
                    {actions.map((action) => {
                      const isSelected = draft?.action === action;

                      return <div key={action} className="grid gap-1.5">
                        <Button type="button" size="sm" fullWidth color={isSelected ? actionColors[action] : "default"}
                          variant={isSelected ? "flat" : "bordered"}
                          className={`${styles.action} ${isSelected ? activeActionStyles[action] : ""}`}
                          aria-pressed={isSelected} isDisabled={saving}
                          onPress={() => setSelected((previous) => {
                            const next = { ...previous };
                            if (isSelected) delete next[itemId];
                            else next[itemId] = { item_id: itemId, offer_id: offerId, action };
                            return next;
                          })}>
                          {t(`quotation.detail.action.${action}`)}
                        </Button>
                        {action === "counter" && draft?.action === "counter" && (
                          <div className="space-y-2 rounded-medium border border-divider bg-content2 p-2.5">
                            <Input type="number" size="sm" min="0.01" max="99999999.99" step="0.01" isRequired
                              isDisabled={saving} label={t("quotation.detail.counterPrice", { currency: quote.currency_code })}
                              labelPlacement="outside-top" classNames={{ label: "pb-1 text-sm font-medium" }}
                              value={draft.unit_price ?? ""}
                              onValueChange={(price) => setSelected((previous) => ({ ...previous, [itemId]: { ...draft, unit_price: price } }))} />
                            {draft.unit_price && (
                              <p className="break-words text-base font-semibold text-foreground tabular-nums">
                                {t("quotation.detail.offerTotal", { total: money(Number(draft.unit_price) * item.quantity) })}
                              </p>
                            )}
                          </div>
                        )}
                      </div>;
                    })}
                  </div>
                </fieldset>
              )}
            </>
          );
        }} />
        {responses.length > 0 && (
          <div className="flex justify-end">
            <Button type="submit" color="primary" className={styles.action} isLoading={saving}>
              {t("quotation.detail.submitDecisions")}
            </Button>
          </div>
        )}
      </form>
      {error && <p role="alert" className="text-sm text-danger-700">{error}</p>}
    </section>
  );
}
