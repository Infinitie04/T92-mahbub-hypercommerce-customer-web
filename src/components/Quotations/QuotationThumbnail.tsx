import { Image } from "@/components/ui";
import { Package } from "lucide-react";

export default function QuotationThumbnail({ src }: { src?: string | null }) {
  return (
    <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-medium bg-content2">
      {src ? <Image src={src} alt="" className="size-16 object-cover" /> : <Package size={22} className="text-default-500" aria-hidden="true" />}
    </div>
  );
}
