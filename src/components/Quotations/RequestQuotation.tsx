import { Button } from "@/components/ui";
import { Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { useRouter } from "next/router";
import { FormEvent, useState } from "react";
import { useSelector } from "react-redux";
import useSWR from "swr";
import type { RootState } from "@/lib/redux/store";
import {
  getQuotationCurrency,
  quotationError,
  submitQuotation,
  type Quotation,
  type QuotationSourceLine,
} from "@/services/quotations";

export default function RequestQuotation({
  source,
  lines,
  compact = false,
}: {
  source: Quotation["source"];
  lines: QuotationSourceLine[];
  compact?: boolean;
}) {
  const router = useRouter();
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const [draft, setDraft] = useState<QuotationSourceLine[] | null>(null);
  const [prices, setPrices] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const { data: currency, error: currencyError, mutate } = useSWR(
    draft ? "/user/quotations/currency" : null,
    getQuotationCurrency,
  );

  const open = () => {
    if (!isLoggedIn) {
      void router.push(`/?auth=required&next=${encodeURIComponent(router.asPath)}`);
      return;
    }
    setPrices(lines.map(() => ""));
    setError("");
    setDraft(lines);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!draft || !currency || submitting) return;
    setSubmitting(true);
    setError("");
    try {
      const quote = await submitQuotation(source, currency, draft, prices);
      setDraft(null);
      void router.push(`/my-account/quotations/${quote.id}`);
    } catch (requestError) {
      setError(quotationError(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Button type="button" variant={compact ? "light" : "bordered"} size={compact ? "sm" : "md"} onPress={open} isDisabled={!lines.length}>
        Request quotation
      </Button>
      <Modal isOpen={draft !== null} onOpenChange={(isOpen) => !isOpen && !submitting && setDraft(null)} scrollBehavior="inside">
        <ModalContent>
          <form onSubmit={submit} className="flex min-h-0 flex-col">
            <ModalHeader>Request quotation</ModalHeader>
            <ModalBody>
              {currencyError ? (
                <Button type="button" variant="light" onPress={() => void mutate()}>Retry loading currency</Button>
              ) : !currency ? <p>Loading currency…</p> : (
                draft?.map((line, index) => (
                  <label key={index} className="flex flex-col gap-1 rounded-medium border border-divider p-3">
                    <span className="font-medium">{line.label} × {line.quantity}</span>
                    <span className="text-sm text-default-600">Proposed unit price ({currency})</span>
                    <input
                      className="rounded-small border border-divider bg-content1 px-3 py-2"
                      type="number"
                      inputMode="decimal"
                      min="0.01"
                      max="99999999.99"
                      step="0.01"
                      required
                      value={prices[index] ?? ""}
                      onChange={(event) => {
                        const value = event.currentTarget.value;
                        setPrices((current) => current.map((price, i) => i === index ? value : price));
                      }}
                    />
                  </label>
                ))
              )}
              {error && <p role="alert" className="text-sm text-danger">{error}</p>}
            </ModalBody>
            <ModalFooter>
              <Button type="button" variant="light" isDisabled={submitting} onPress={() => setDraft(null)}>Cancel</Button>
              <Button type="submit" color="primary" isLoading={submitting} isDisabled={!currency}>Submit quotation</Button>
            </ModalFooter>
          </form>
        </ModalContent>
      </Modal>
    </>
  );
}
