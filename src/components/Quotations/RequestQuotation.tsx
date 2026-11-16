import { Button, toast } from "@/components/ui";
import type { RootState } from "@/lib/redux/store";
import { QUOTATION_DRAFT_KEY, type QuotationDraft } from "@/services/quotations";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

export default function RequestQuotation({
  source,
  lines,
  isDisabled,
}: Pick<QuotationDraft, "source" | "lines"> & { isDisabled?: boolean }) {
  const router = useRouter();
  const { t } = useTranslation();
  const userId = useSelector((state: RootState) => state.auth.user?.id);

  function open() {
    if (!userId) {
      void router.push(`/?auth=required&next=${encodeURIComponent(router.asPath)}`);
      return;
    }

    try {
      const draft: QuotationDraft = { userId: String(userId), source, lines, returnPath: router.asPath };
      sessionStorage.setItem(QUOTATION_DRAFT_KEY, JSON.stringify(draft));
      void router.push("/quotation/request");
    } catch {
      toast({ title: t("quotation.error"), color: "danger" });
    }
  }

  return (
    <Button type="button" color="primary" fullWidth className="font-semibold" onPress={open} isDisabled={isDisabled || !lines.length}>
      {t("quotation.request")}
    </Button>
  );
}
