import { withAuth } from "@/guards/withAuth";
import QuotationItems from "@/components/Quotations/QuotationItems";
import { Spinner } from "@/components/ui";
import type { RootState } from "@/lib/redux/store";
import { useSelector } from "react-redux";
import PageHead from "@/SEO/PageHead";
import { getQuotation, quotationError, quotationLabels, quoteMoney } from "@/services/quotations";
import Link from "next/link";
import { useRouter } from "next/router";
import useSWR from "swr";

function QuotationDetailPage() {
  const { query } = useRouter();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const id = typeof query.id === "string" ? query.id : "";
  const { data: quote, error } = useSWR(id && userId ? ["quotation", userId, id] : null, () => getQuotation(id));

  return (
    <section className="space-y-4">
      <PageHead pageTitle={id ? `Quotation #${id}` : "Quotation"} />
      <Link href="/my-account/quotations" className="text-sm text-primary hover:underline">Quotations</Link>
      {error ? <p role="alert" className="text-danger">{quotationError(error)}</p> : !quote ? (
        <Spinner label="Loading quotation" />
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-xl font-bold">Quotation #{quote.id}</h1>
            <span className="rounded-full bg-content2 px-3 py-1 text-sm font-medium">{quotationLabels[quote.status]}</span>
          </div>
          <QuotationItems quote={quote} />
          <p>Proposed merchandise subtotal <strong>{quoteMoney(quote.subtotal, quote.currency_code)}</strong></p>
          {quote.remark && (
            <div className="rounded-large border border-divider bg-content1 p-4">
              <h2 className="mb-1 font-semibold">Admin remark</h2>
              <p className="whitespace-pre-wrap break-words text-default-600">{quote.remark}</p>
            </div>
          )}
          {quote.order_slug ? (
            <Link className="inline-block rounded-medium bg-primary px-4 py-2 text-primary-foreground" href={`/my-account/orders/${quote.order_slug}`}>View order</Link>
          ) : quote.status === "ready_to_pay" && (
            <Link
              className="inline-block rounded-medium bg-primary px-4 py-2 text-primary-foreground"
              href={quote.payment_order_slug ? `/payment/${quote.payment_order_slug}` : `/my-account/quotations/${quote.id}/checkout`}
            >
              {quote.payment_order_slug ? "Resume payment" : "Checkout"}
            </Link>
          )}
        </>
      )}
    </section>
  );
}

export default withAuth(QuotationDetailPage);
