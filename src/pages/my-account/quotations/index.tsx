import { withAuth } from "@/guards/withAuth";
import { Button, Spinner } from "@/components/ui";
import type { RootState } from "@/lib/redux/store";
import { useSelector } from "react-redux";
import PageHead from "@/SEO/PageHead";
import { getQuotations, quotationError, quotationLabels, quoteMoney } from "@/services/quotations";
import Link from "next/link";
import { useState } from "react";
import useSWR from "swr";

function QuotationsPage() {
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const [page, setPage] = useState(1);
  const { data, error, mutate } = useSWR(userId ? ["quotations", userId, page] : null, () => getQuotations(page));

  return (
    <section className="space-y-4">
      <PageHead pageTitle="Quotations" />
      <h1 className="text-xl font-bold">Quotations</h1>
      {error ? (
        <div role="alert">
          <p>{quotationError(error)}</p>
          <Button variant="light" onPress={() => void mutate()}>Try again</Button>
        </div>
      ) : !data ? <Spinner label="Loading quotations" /> : !data.data.length ? (
        <p className="text-default-600">No quotations yet.</p>
      ) : (
        <>
          <ul className="divide-y divide-divider rounded-large border border-divider bg-content1">
            {data.data.map((quote) => (
              <li key={quote.id}>
                <Link href={`/my-account/quotations/${quote.id}`} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-content2">
                  <span>
                    <span className="block font-semibold">Quotation #{quote.id}</span>
                    <span className="text-sm text-default-600">{new Date(quote.created_at).toLocaleDateString()}</span>
                  </span>
                  <span className="text-end text-sm">
                    <span className="block font-medium">{quotationLabels[quote.status]}</span>
                    <span className="text-default-600">{quoteMoney(quote.subtotal, quote.currency_code)}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {data.last_page > 1 && (
            <nav aria-label="Quotation pages" className="flex items-center gap-3">
              <Button size="sm" variant="bordered" isDisabled={page <= 1} onPress={() => setPage(page - 1)}>Previous</Button>
              <span className="text-sm">{page} / {data.last_page}</span>
              <Button size="sm" variant="bordered" isDisabled={page >= data.last_page} onPress={() => setPage(page + 1)}>Next</Button>
            </nav>
          )}
        </>
      )}
    </section>
  );
}

export default withAuth(QuotationsPage);
