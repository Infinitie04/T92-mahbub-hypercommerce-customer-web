import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Chip, Input } from "@/components/ui";
import ConfirmationModal from "@/components/Modals/ConfirmationModal";
import { getFormattedDate } from "@/helpers/getters";
import {
  confirmPartialQuotation, quotationError, respondToQuotationItems,
  type QuotationDetail, type QuotationResponse,
} from "@/services/quotations";
import QuotationItems from "./QuotationItems";
import { useQuotationMoney } from "./quotationPresentation";

const actions = ["accept", "counter", "reject"] as const;
const statusColors = { awaiting_admin: "default", awaiting_customer: "warning", agreed: "success", rejected: "danger" } as const;

export default function QuotationNegotiation({ quote, onUpdated }: {
  quote: QuotationDetail;
  onUpdated: (quote?: QuotationDetail) => Promise<unknown>;
}) {
  const { t, i18n } = useTranslation();
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
        <QuotationItems quote={quote} renderActions={(item) => {
          const itemId = item.id;
          const offerId = item.current_offer_id;
          const response = itemId === undefined ? undefined : selected[itemId];
          const draft = response?.offer_id === offerId ? response : undefined;
          const history = item.history ?? [];

          return (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                {item.status && <Chip size="sm" variant="flat" color={statusColors[item.status]}>
                  {t(`quotation.negotiation.itemStatus.${item.status}`)}
                </Chip>}
                {!!history.length && (
                  <details className="text-sm">
                    <summary className="cursor-pointer text-primary">{t("quotation.negotiation.history")}</summary>
                    <ul className="mt-2 space-y-2">
                      {[...history].reverse().map((event) => {
                        const price = event.unit_price ?? history.find((offer) => offer.id === event.responds_to_offer_id)?.unit_price;
                        return (
                          <li key={event.id}>
                            {t(`quotation.negotiation.event.${event.actor_role}.${event.action}`)}
                            {price != null && ` · ${money(price)}`}
                            <time className="block text-xs text-default-500" dateTime={event.created_at}>
                              {getFormattedDate(event.created_at, i18n.resolvedLanguage)}
                            </time>
                            {event.reason && <p className="break-words">{event.reason}</p>}
                          </li>
                        );
                      })}
                    </ul>
                  </details>
                )}
              </div>
              {item.can_respond && itemId !== undefined && offerId !== undefined && (
                <fieldset className="space-y-2" disabled={saving}>
                  <legend className="sr-only">{t("quotation.negotiation.responseFor", { item: item.title })}</legend>
                  <div className="flex flex-wrap gap-2">
                    {actions.map((action) => (
                      <Button key={action} size="sm" variant={draft?.action === action ? "solid" : "bordered"}
                        color={action === "reject" ? "danger" : "primary"} aria-pressed={draft?.action === action}
                        onPress={() => setSelected((previous) => {
                          const next = { ...previous };
                          if (draft?.action === action) delete next[itemId];
                          else next[itemId] = { item_id: itemId, offer_id: offerId, action };
                          return next;
                        })}>
                        {t(`quotation.negotiation.${action}`)}
                      </Button>
                    ))}
                  </div>
                  {draft?.action === "counter" && (
                    <Input type="number" min="0.01" max="99999999.99" step="0.01" isRequired
                      label={t("quotation.unitPriceCurrency", { currency: quote.currency_code })}
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
        {responses.length > 0 && <Button type="submit" color="primary" isLoading={saving}>
          {t("quotation.negotiation.send")}
        </Button>}
      </form>
      {quote.status === "awaiting_customer_confirmation" && (
        <div className="space-y-3 rounded-large border border-divider bg-content1 p-4">
          <p>{t("quotation.negotiation.partialExplanation")}</p>
          <div className="flex flex-wrap gap-2">
            <Button color="primary" isLoading={saving} onPress={() => void save(() => confirmPartialQuotation(quote.id, "confirm"))}>
              {t("quotation.negotiation.continue")}
            </Button>
            <Button color="danger" variant="bordered" isDisabled={saving} onPress={() => setShowDecline(true)}>
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
