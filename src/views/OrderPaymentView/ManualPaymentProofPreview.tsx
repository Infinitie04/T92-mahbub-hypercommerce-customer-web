import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

import { Image } from "@/components/ui";
import { getManualPaymentProof } from "@/services/orders";

export default function ManualPaymentProofPreview({
  slug,
  proofId,
  filename,
}: {
  slug: string;
  proofId: number;
  filename: string;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<{ url: string; isPdf: boolean }>();
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (!expanded) return;

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
      .catch(() => {
        if (!request.signal.aborted) setUnavailable(true);
      });

    return () => {
      request.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [expanded, proofId, slug]);

  const title = t("manualPayment.previewTitle", "Payment receipt preview for {{filename}}", { filename });

  return (
    <details
      onToggle={(event) => {
        setExpanded(event.currentTarget.open);
        if (!event.currentTarget.open) {
          setPreview(undefined);
          setUnavailable(false);
        }
      }}
    >
      <summary className="cursor-pointer text-sm font-medium text-primary">
        {t("manualPayment.preview", "Preview receipt")}
      </summary>
      {expanded && (
        <div className="mt-2">
          {unavailable ? (
            <p role="status" className="text-sm text-default-600">
              {t("manualPayment.previewUnavailable", "Preview unavailable. Download the receipt to open it.")}
            </p>
          ) : preview?.isPdf ? (
            <iframe src={preview.url} title={title} className="h-[30rem] w-full rounded-medium border border-divider" />
          ) : preview ? (
            <Image
              src={preview.url}
              alt={title}
              className="max-h-[32rem] w-auto max-w-full object-contain"
              onError={() => setUnavailable(true)}
            />
          ) : (
            <p role="status" className="text-sm text-default-600">
              {t("manualPayment.previewLoading", "Loading receipt preview…")}
            </p>
          )}
        </div>
      )}
    </details>
  );
}
