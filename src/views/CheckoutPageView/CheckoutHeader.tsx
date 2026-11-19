import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, LockKeyhole } from "lucide-react";
import { useTranslation } from "react-i18next";
import { siteConfig } from "@/config/site";

export default function CheckoutHeader() {
  const { t } = useTranslation();
  return (
    <header className="w-full border-b border-divider bg-content1 text-foreground">
      <div className="mx-auto grid h-14 w-full max-w-site grid-cols-[1fr_auto_1fr] items-center gap-2 px-4 sm:px-6">
        <Link href="/" aria-label={siteConfig.name} className="w-fit"><Image src={siteConfig.logo} width={92} height={36} alt={siteConfig.name} className="h-9 w-auto object-contain" /></Link>
        <span className="inline-flex items-center gap-2 text-sm font-semibold"><LockKeyhole className="size-4 text-success" />{t("checkout.secureCheckout", "Secure Checkout")}</span>
        <Link href="/cart" aria-label={t("checkout.backToCart", "Back to Cart")} className="inline-flex items-center gap-1 justify-self-end text-sm"><ChevronLeft size={18} /><span className="hidden sm:inline">{t("checkout.backToCart", "Back to Cart")}</span></Link>
      </div>
    </header>
  );
}
