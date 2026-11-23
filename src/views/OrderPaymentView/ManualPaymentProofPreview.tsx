import { useEffect, useState } from "react";
import { Download, Eye } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button, Image, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner, toastError, useDisclosure } from "@/components/ui";
import { downloadManualPaymentProof, getManualPaymentProof } from "@/services/orders";

export default function ManualPaymentProofPreview({
  slug,
  proofId,
  filename,
  compact = false,
}: {
  slug: string;
  proofId: number;
  filename: string;
  compact?: boolean;
}) {
  const { t } = useTranslation();
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [preview, setPreview] = useState<{ url: string; isPdf: boolean }>();
  const [unavailable, setUnavailable] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const request = new AbortController();
    let url: string | undefined;
    getManualPaymentProof(slug, proofId, { preview: true, signal: request.signal })
      .then((file) => {
        if (request.signal.aborted) return;
        const isPdf = file.type === "application/pdf";
        if (isPdf ? navigator.pdfViewerEnabled === false : !["image/png", "image/jpeg"].includes(file.type)) {
          setUnavailable(true);
          return;
        }
        url = URL.createObjectURL(file);
        setPreview({ url, isPdf });
      })
      .catch(() => { if (!request.signal.aborted) setUnavailable(true); });

    return () => {
      request.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [isOpen, proofId, slug]);

  const download = async () => {
    setDownloading(true);
    try {
      await downloadManualPaymentProof(slug, proofId, filename);
    } catch {
      toastError(t("manualPayment.downloadError", "The receipt could not be downloaded. Try again."));
    } finally {
      setDownloading(false);
    }
  };

  const downloadButton = (
    <Button size="md" variant="bordered" startContent={<Download size={17} />} isLoading={downloading} onPress={download}>
      {t("manualPayment.download", "Download receipt")}
    </Button>
  );

  return (
    <>
      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="md" variant="bordered" isIconOnly={compact} title={t("manualPayment.preview", "Preview receipt")}
          aria-label={t("manualPayment.preview", "Preview receipt")} startContent={<Eye size={17} />} onPress={() => {
          setPreview(undefined);
          setUnavailable(false);
          onOpen();
        }}>
          {!compact && t("manualPayment.preview", "Preview receipt")}
        </Button>
        {compact ? (
          <Button size="md" variant="bordered" isIconOnly title={t("manualPayment.download", "Download receipt")}
            aria-label={t("manualPayment.download", "Download receipt")} startContent={<Download size={17} />}
            isLoading={downloading} onPress={download} />
        ) : downloadButton}
      </div>
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl" scrollBehavior="inside">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader className="break-all pe-12">{filename}</ModalHeader>
              <ModalBody>
                {unavailable ? (
                  <p role="status" className="py-8 text-center text-default-600">
                    {t("manualPayment.previewUnavailable", "Preview unavailable. Download the receipt to open it.")}
                  </p>
                ) : preview?.isPdf ? (
                  <iframe src={preview.url} title={filename} className="h-[min(65vh,35rem)] w-full rounded-medium border border-divider" />
                ) : preview ? (
                  <div className="flex justify-center rounded-medium bg-default-100 p-3">
                    <Image src={preview.url} alt={filename} className="max-h-[65vh] w-auto max-w-full object-contain"
                      onError={() => setUnavailable(true)} />
                  </div>
                ) : <Spinner label={t("manualPayment.previewLoading", "Loading receipt preview…")} className="py-10" />}
              </ModalBody>
              <ModalFooter className="flex-wrap">
                <Button size="md" variant="light" onPress={onClose}>{t("close", "Close")}</Button>
                {downloadButton}
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </>
  );
}
