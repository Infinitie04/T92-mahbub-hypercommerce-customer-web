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
    <div className="rd-fade flex w-full flex-col gap-6">
      <h1 className="text-xl font-bold text-foreground sm:text-2xl">{heading}</h1>
      <div className="flex w-full flex-col gap-4 md:flex-row md:items-start">
        <div className="w-full md:w-[60%] lg:w-[65%]">{details}</div>
        <div className="w-full md:w-[40%] md:max-w-md lg:w-[35%]">{summary}</div>
      </div>
    </div>
  );
}
