import type { ReactNode } from "react";

export default function CheckoutLayout({
  heading,
  details,
  summary,
}: {
  heading: ReactNode;
  details: ReactNode;
  summary: ReactNode;
}) {
  return (
    <div className="rd-fade flex w-full flex-col gap-3 pb-4">
      <h1 className="text-xl font-bold text-foreground sm:text-2xl">{heading}</h1>
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.62fr)_minmax(0,1fr)]">
        <div className="min-w-0">{details}</div>
        <div className="min-w-0">{summary}</div>
      </div>
    </div>
  );
}
