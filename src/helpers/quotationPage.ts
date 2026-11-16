import { serverSideAuthGuard } from "@/guards/authGuard";
import { getMarketFromContext } from "@/helpers/functionalHelpers";
import { isSSR } from "@/helpers/getters";
import { getSettings } from "@/services/settings";
import type { GetServerSideProps } from "next";
import { loadTranslations } from "../../i18n";

export const quotationPageProps: GetServerSideProps | undefined = isSSR()
  ? async (context) => {
      const guard = await serverSideAuthGuard(context);
      if (guard) return guard;

      const [settings] = await Promise.all([
        getSettings({ market: getMarketFromContext(context) }),
        loadTranslations(context),
      ]);

      return { props: { initialSettings: settings.data ?? null } };
    }
  : undefined;
