import { Button, EmptyState, ErrorState, Input, Select, SelectItem, Skeleton, Textarea } from "@/components/ui";
import { useSettings } from "@/contexts/SettingsContext";
import { getQuotationCurrency, quotationError, quotationValidation, requoteQuotation, submitQuotation, type QuotationDetail, type QuotationDraft } from "@/services/quotations";
import { X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { useQuotationMoney } from "./quotationPresentation";
import QuotationThumbnail from "./QuotationThumbnail";

function validPrice(price: string) {
  return /^\d{1,8}(?:\.\d{1,2})?$/.test(price) && Number(price) >= 0.01;
}

function validQuantity(quantity: string) {
  return /^\d+$/.test(quantity) && Number(quantity) >= 1 && Number(quantity) <= 1_000_000;
}

type QuotationRequestFormProps = {
  onSubmitted: (id: number) => void;
} & ({ draft: QuotationDraft; previousQuote?: never } | { draft?: never; previousQuote: QuotationDetail });

export default function QuotationRequestForm({ draft, previousQuote, onSubmitted }: QuotationRequestFormProps) {
  const { t } = useTranslation();
  const settings = useSettings();
  const { data: currency, error, mutate } = useSWR("quotation-currency", getQuotationCurrency);
  const money = useQuotationMoney(currency);
  const [variantIndex, setVariantIndex] = useState(0);
  const [rows, setRows] = useState(() => {
    const lines = previousQuote
      ? previousQuote.items.map((item) => ({
          label: item.title, variantLabel: item.variant_title, image: item.image, quantity: item.quantity,
        }))
      : draft.lines;
    return lines.map((line, id) => ({
      id, line, quantity: String(line.quantity), price: undefined as string | undefined,
    }));
  });
  const [errors, setErrors] = useState<Record<string, string[]>>({});
  const [message, setMessage] = useState("");
  const [customerNote, setCustomerNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inFlight = useRef(false);
  const selectVariant = draft?.source === "item";
  const activeRows = selectVariant ? rows.filter((row) => row.id === variantIndex) : rows;
  const currencySymbol = currency && (currency === settings.currency && settings.currencySymbol
    ? settings.currencySymbol
    : new Intl.NumberFormat("en", { style: "currency", currency, currencyDisplay: "narrowSymbol" })
      .formatToParts(0).find((part) => part.type === "currency")?.value || currency);

  function proposedPrice(row: (typeof rows)[number]) {
    if (row.price !== undefined) return row.price;
    if (previousQuote) return previousQuote.currency_code === currency ? previousQuote.items[row.id].unit_price : "";
    const currentPrice = draft.lines[row.id].quotationUnitPrice;
    return currentPrice != null && Number.isFinite(currentPrice) && currentPrice > 0 ? currentPrice.toFixed(2) : "";
  }

  function lineCents(row: (typeof rows)[number]) {
    const price = proposedPrice(row);
    return validPrice(price) && validQuantity(row.quantity)
      ? Math.round(Number(price) * 100) * Number(row.quantity)
      : 0;
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!currency || !activeRows.length || inFlight.current) return;
    const invalid: Record<string, string[]> = {};
    activeRows.forEach((row, index) => {
      if (!validPrice(proposedPrice(row))) invalid[`items.${index}.unit_price`] = [t("quotation.invalidPrice")];
      if (!validQuantity(row.quantity)) invalid[`items.${index}.quantity`] = [t("quotation.invalidQuantity")];
    });
    setMessage("");
    setErrors(invalid);
    if (Object.keys(invalid).length) return;

    inFlight.current = true;
    setSubmitting(true);
    try {
      const quote = previousQuote
        ? await requoteQuotation(previousQuote.id, currency, activeRows.map((row) => ({
            item_index: row.id,
            quantity: Number(row.quantity),
            unit_price: proposedPrice(row),
          })), customerNote)
        : await submitQuotation(draft.source, currency,
            activeRows.map((row) => ({ ...draft.lines[row.id], quantity: Number(row.quantity) })),
            activeRows.map(proposedPrice), customerNote);
      onSubmitted(quote.id);
    } catch (submitError) {
      const fields = quotationValidation(submitError)?.errors ?? {};
      setErrors(fields);
      if (!Object.keys(fields).length || Object.keys(fields).some((key) => key !== "customer_note" && !/^items\.\d+\.(unit_price|quantity)$/.test(key))) {
        setMessage(quotationError(submitError, t("quotation.error")));
      }
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }

  if (error) return <ErrorState title={t("quotation.error")} onRetry={() => void mutate()} />;
  if (!currency) return <Skeleton className="h-48 rounded-large" />;
  if (!activeRows.length) return <EmptyState title={t("quotation.noItems")} />;

  return (
    <form onSubmit={submit} noValidate className="grid items-start gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
      <div className="space-y-3">
        {selectVariant && rows.length > 1 && (
          <Select label={t("quotation.variant")} selectedKeys={[String(variantIndex)]} isDisabled={submitting}
            onChange={(event) => {
              if (event.target.value === "") return;
              setVariantIndex(Number(event.target.value));
              setErrors({});
              setMessage("");
            }}>
            {rows.map(({ id, line }) => <SelectItem key={id}>{line.variantLabel || line.label}</SelectItem>)}
          </Select>
        )}
        {activeRows.map((row, index) => {
          const quantityField = `items.${index}.quantity`;
          const priceField = `items.${index}.unit_price`;
          return (
            <section key={row.id} className="space-y-3 rounded-large border border-divider bg-content1 p-4">
              <div className="flex items-start gap-3">
                <QuotationThumbnail src={row.line.image} />
                <div className="min-w-0 flex-1">
                  <h2 className="break-words font-semibold">{row.line.label}</h2>
                  {row.line.variantLabel && row.line.variantLabel !== row.line.label && <p className="text-sm text-default-600">{row.line.variantLabel}</p>}
                </div>
                <Button type="button" isIconOnly variant="light" size="sm" isDisabled={submitting}
                  aria-label={t("quotation.removeItem", { item: row.line.label })}
                  onPress={() => {
                    setRows((current) => selectVariant ? [] : current.filter(({ id }) => id !== row.id));
                    setErrors({});
                    setMessage("");
                  }}>
                  <X size={18} aria-hidden="true" />
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <Input label={t("quotation.quantityLabel")} type="number" inputMode="numeric" min={1} max={1000000} step={1}
                  isRequired isDisabled={submitting} isInvalid={Boolean(errors[quantityField]?.length)} errorMessage={errors[quantityField]?.[0]}
                  value={row.quantity} onValueChange={(quantity) => {
                    setRows((current) => current.map((item) => item.id === row.id ? { ...item, quantity } : item));
                    setErrors((current) => ({ ...current, [quantityField]: [] }));
                  }} />
                <Input label={t("quotation.unitPriceCurrency", { currency })} inputMode="decimal"
                  startContent={<span className="text-sm text-default-600">{currencySymbol}</span>}
                  isRequired isDisabled={submitting} isInvalid={Boolean(errors[priceField]?.length)} errorMessage={errors[priceField]?.[0]}
                  value={proposedPrice(row)} onValueChange={(price) => {
                    setRows((current) => current.map((item) => item.id === row.id ? { ...item, price } : item));
                    setErrors((current) => ({ ...current, [priceField]: [] }));
                  }} />
              </div>
              <p className="text-sm">{t("quotation.lineTotal")} <strong>{lineCents(row) ? money(lineCents(row) / 100) : "—"}</strong></p>
            </section>
          );
        })}
        <section className="rounded-large border border-divider bg-content1 p-4">
          <Textarea
            name="customer_note"
            label={t("quotation.customerNoteOptional")}
            value={customerNote}
            onValueChange={(note) => {
              setCustomerNote(note);
              setErrors((current) => ({ ...current, customer_note: [] }));
            }}
            minRows={3}
            maxLength={1000}
            isDisabled={submitting}
            isInvalid={Boolean(errors.customer_note?.length)}
            errorMessage={errors.customer_note?.[0]}
          />
        </section>
      </div>
      <div className="space-y-4 rounded-large border border-divider bg-content1 p-4">
        <h2 className="font-bold">{t("quotation.summary")}</h2>
        <div className="flex justify-between gap-2 border-t border-divider pt-3">
          <span>{t("quotation.subtotal")}</span>
          <strong>{money(activeRows.reduce((sum, row) => sum + lineCents(row), 0) / 100)}</strong>
        </div>
        {message && <p role="alert" className="text-sm text-danger">{message}</p>}
        <Button type="submit" color="primary" fullWidth className="font-semibold" isLoading={submitting}>{t("quotation.submit")}</Button>
      </div>
    </form>
  );
}
