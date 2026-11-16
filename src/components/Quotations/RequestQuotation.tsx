import { Button, Modal, ModalBody, ModalContent, ModalHeader, toast } from "@/components/ui";
import type { RootState } from "@/lib/redux/store";
import { QUOTATION_DRAFT_KEY, type QuotationDraft } from "@/services/quotations";
import { useState } from "react";
import QuotationRequestForm from "./QuotationRequestForm";
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

  const [modalDraft, setModalDraft] = useState<QuotationDraft | null>(null);

  function open() {
    if (!userId) {
      void router.push(`/?auth=required&next=${encodeURIComponent(router.asPath)}`);
      return;
    }

    try {
      const draft: QuotationDraft = { userId: String(userId), source, lines, returnPath: router.asPath };
      if (window.matchMedia("(min-width: 768px)").matches) {
        setModalDraft(draft);
        return;
      }
      sessionStorage.setItem(QUOTATION_DRAFT_KEY, JSON.stringify(draft));
      void router.push("/quotation/request");
    } catch {
      toast({ title: t("quotation.error"), color: "danger" });
    }
  }

  return (
    <>
      <Button type="button" color="primary" fullWidth className="font-semibold" onPress={open} isDisabled={isDisabled || !lines.length}>
        {t("quotation.request")}
      </Button>
      <Modal isOpen={modalDraft !== null} onOpenChange={(open) => { if (!open) setModalDraft(null); }}
        size="5xl" placement="center" scrollBehavior="inside">
        <ModalContent>
          <ModalHeader>{t("quotation.request")}</ModalHeader>
          <ModalBody className="pb-5">
            {modalDraft && <QuotationRequestForm draft={modalDraft} onSubmitted={(id) => {
              setModalDraft(null);
              void router.push(`/my-account/quotations/${id}`);
            }} />}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
