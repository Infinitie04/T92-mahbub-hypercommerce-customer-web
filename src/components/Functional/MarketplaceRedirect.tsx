import { useEffect } from "react";
import { useRouter } from "next/router";
import { isSSR } from "@/helpers/getters";
import type { GetServerSideProps } from "next";

export default function MarketplaceRedirect() {
  const router = useRouter();

  useEffect(() => {
    void router.replace("/");
  }, [router]);

  return null;
}

export const redirectMarketplacePage: GetServerSideProps | undefined = isSSR()
  ? async () => ({ redirect: { destination: "/", permanent: false } })
  : undefined;
