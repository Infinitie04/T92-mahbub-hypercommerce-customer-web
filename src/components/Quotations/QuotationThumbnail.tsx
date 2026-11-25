import { Image } from "@/components/ui";
import { Package } from "lucide-react";
import styles from "./QuotationDetail.module.css";

export default function QuotationThumbnail({ src, detail }: { src?: string | null; detail?: boolean }) {
  return (
    <div className={`grid shrink-0 place-items-center overflow-hidden bg-content2 ${detail ? styles.thumbnail : "size-16 rounded-medium"}`}>
      {src ? <Image src={src} alt="" removeWrapper={detail} className={detail ? "h-full w-full object-cover" : "size-16 object-cover"} /> : <Package size={22} className="text-default-500" aria-hidden="true" />}
    </div>
  );
}
