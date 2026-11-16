import { isSSR } from "@/helpers/getters";
import { parseQuotationId, quotationCheckoutHref } from "@/helpers/quotationCheckout";
import type { GetServerSideProps } from "next";
import { useRouter } from "next/router";
import { useEffect } from "react";

export const getServerSideProps: GetServerSideProps | undefined = isSSR()
  ? async ({ params }) => {
      const id = parseQuotationId(params?.id);
      if (!id) return { notFound: true };

      return {
        redirect: { destination: quotationCheckoutHref(id), permanent: false },
      };
    }
  : undefined;

export default function LegacyQuotationCheckout() {
  const router = useRouter();
  const id = parseQuotationId(router.query.id);

  useEffect(() => {
    if (id) void router.replace(quotationCheckoutHref(id));
  }, [id, router]);

  return null;
}
