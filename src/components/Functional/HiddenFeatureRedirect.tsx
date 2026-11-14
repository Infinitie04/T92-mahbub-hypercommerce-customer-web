import { useEffect } from "react";
import { useRouter } from "next/router";
import type { GetServerSideProps } from "next";

import { isSSR } from "@/helpers/getters";

export function redirectHiddenFeature(destination: "/" | "/my-account/") {
  const getServerSideProps: GetServerSideProps | undefined = isSSR()
    ? async () => ({ redirect: { destination, permanent: false } })
    : undefined;

  function HiddenFeatureRedirect() {
    const router = useRouter();

    useEffect(() => {
      void router.replace(destination);
    }, [router]);

    return null;
  }

  return { Page: HiddenFeatureRedirect, getServerSideProps };
}
