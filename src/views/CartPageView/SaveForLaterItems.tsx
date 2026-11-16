import { useState } from "react";
import { toast, Button } from "@/components/ui";
import { Icon } from "@iconify/react";
import { ImageIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getSaveForLaterItems, removeItemFromCart } from "@/routes/api";
import ConfirmationModal from "@/components/Modals/ConfirmationModal";
import { updateCartData } from "@/helpers/updators";
import { useSelector } from "react-redux";
import { RootState } from "@/lib/redux/store";
import { useTranslation } from "react-i18next";
import useSWR from "swr";
import { useSettings } from "@/contexts/SettingsContext";
import { handleAddToCart } from "@/helpers/functionalHelpers";
import { cartLineTotal } from "@/helpers/cartPricing";
import type { CartItem } from "@/types/cart";
import Lightbox from "yet-another-react-lightbox";
import CartAddonList from "@/components/Cart/CartAddonList";

function SavedItemThumbnail({ item, onPreview }: {
  item: CartItem;
  onPreview: (src: string) => void;
}) {
  const { t } = useTranslation();
  const [failed, setFailed] = useState<string[]>([]);
  const src = [item.variant.image, item.product.image]
    .map((url) => url?.trim())
    .find((url) => url && !failed.includes(url));
  const frame = "grid size-16 place-items-center overflow-hidden rounded-medium bg-content2";

  if (!src) {
    return (
      <span className={frame} aria-hidden="true">
        <ImageIcon className="size-5 text-default-500" />
      </span>
    );
  }

  return (
    <button
      type="button"
      className={`${frame} focus-visible:outline-2 focus-visible:outline-primary`}
      aria-label={t("cart.previewVariant", "Preview {{variant}}", {
        variant: item.variant.title || item.product.name,
      })}
      onClick={() => onPreview(src)}
    >
      <Image
        key={src}
        src={src}
        alt=""
        width={64}
        height={64}
        unoptimized
        className="size-16 object-contain"
        onError={() => setFailed((previous) => [...previous, src])}
      />
    </button>
  );
}

export default function SaveForLaterItems() {
  const { t } = useTranslation();
  const { formatPrice, market } = useSettings();
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const isLoading = useSelector((state: RootState) => state?.cart?.isLoading);
  const [movingItemId, setMovingItemId] = useState<number | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ src: string }[]>([]);

  const isLoggedIn = useSelector((state: RootState) => state?.auth?.isLoggedIn);

  const swrKey = isLoggedIn ? ["/save-for-later", market?.code] : null;

  const {
    data: itemsData,
    isLoading: isLoadingItems,
    mutate,
  } = useSWR(swrKey, () => getSaveForLaterItems(), {
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
  });

  const items = itemsData?.data?.items || [];

  const handleRemoveItem = async () => {
    if (!selectedItemId) return;
    try {
      const response = await removeItemFromCart(selectedItemId);
      if (response.success) {
        mutate();
        toast({
          title: t("cartItems.itemRemoved.title"),
          description: t("cartItems.itemRemoved.description"),
          color: "success",
        });
      } else {
        toast({
          title: t("cartItems.removeFailed.title"),
          description:
            response.message || t("cartItems.removeFailed.description"),
          color: "danger",
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: t("cartItems.networkError.title"),
        description: t("cartItems.networkError.description"),
        color: "danger",
      });
    } finally {
      setSelectedItemId(null);
      updateCartData(true, false);
    }
  };

  const handleMoveToCart = async (item: CartItem) => {
    setMovingItemId(item.id);
    try {
      const res = await handleAddToCart({
        product_variant_id: item.product_variant_id,
        onClose: () => {},
        quantity: item.quantity,
        store_id: item.store_id,
        renderToast: false,
        replace_quantity: true,
        addons: item.addons?.map(({ addon_group_id, addon_item_id }) => ({
          addon_group_id,
          addon_item_id,
        })),
      });

      if (res?.success) {
        toast({
          title: t("saveForLater.moveSuccess.title"),
          description: t("saveForLater.moveSuccess.description"),
          color: "success",
        });

        mutate();
      } else {
        toast({
          title: t("saveForLater.moveFailed.title"),
          description: res?.message || t("saveForLater.moveFailed.description"),
          color: "danger",
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: t("saveForLater.moveFailed.title"),
        description: t("saveForLater.moveFailed.description"),
        color: "danger",
      });
    } finally {
      setMovingItemId(null);
    }
  };

  if (!isLoggedIn || isLoadingItems || items.length === 0) {
    return null;
  }

  return (
    <section className="w-full" aria-labelledby="saved-items-title">
      <h2 id="saved-items-title" className="mb-3 text-lg font-bold text-foreground">
        {t("saveForLater.title")}
      </h2>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const name = item.product.name || item.variant.title;
          const variant = item.variant.title !== name ? item.variant.title : null;

          return (
            <li key={item.id} className="flex h-full flex-col overflow-hidden rounded-large border border-divider bg-content1">
              <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3 p-3 sm:p-4">
                <SavedItemThumbnail item={item} onPreview={(src) => {
                  setLightboxImages([{ src }]);
                  setLightboxOpen(true);
                }} />

                <div className="min-w-0 space-y-1">
                  <h3 className="break-words text-sm font-semibold leading-snug text-foreground">
                    <Link href={`/products/${item.product.slug}`} className="hover:text-primary hover:underline">
                      {name}
                    </Link>
                  </h3>
                  {(variant || item.store?.name) && (
                    <p className="break-words text-xs text-default-600">
                      {[variant, item.store?.name].filter(Boolean).join(" · ")}
                    </p>
                  )}
                  <p className="text-xs tabular-nums text-default-600">
                    <bdi>{item.quantity} × {formatPrice(item.unit_price ?? item.variant.price)}</bdi>
                  </p>
                  {Boolean(item.addons?.length) && <CartAddonList addons={item.addons ?? []} />}
                </div>
              </div>

              <div className="mt-auto border-t border-divider px-3 py-3 sm:px-4">
                <div className="mb-3 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                  <span className="text-xs text-default-600">{t("orderLine.subtotal")}</span>
                  <bdi className="text-sm font-semibold tabular-nums text-foreground">
                    {formatPrice(cartLineTotal(item))}
                  </bdi>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    color="default"
                    variant="bordered"
                    className="min-w-0 flex-1 text-sm font-semibold text-foreground"
                    startContent={<Icon icon="solar:cart-plus-linear" className="shrink-0 text-base" aria-hidden="true" />}
                    isLoading={movingItemId === item.id}
                    isDisabled={isLoading || movingItemId !== null}
                    onPress={() => handleMoveToCart(item)}
                  >
                    {t("saveForLater.moveToCart")}
                  </Button>
                  <Button
                    title={t("remove_item")}
                    aria-label={t("remove_item")}
                    color="danger"
                    variant="light"
                    size="sm"
                    isDisabled={isLoading || movingItemId !== null}
                    isIconOnly
                    onPress={() => setSelectedItemId(item.id)}
                  >
                    <Icon icon="solar:trash-bin-trash-linear" className="text-base" />
                  </Button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <ConfirmationModal
        isOpen={!!selectedItemId}
        onClose={() => setSelectedItemId(null)}
        onConfirm={handleRemoveItem}
        title={t("cartItems.removeItemModal.title")}
        icon={<Icon icon="solar:trash-bin-trash-linear" className="text-base" />}
        description={t("cartItems.removeItemModal.description")}
        confirmText={t("cartItems.removeItemModal.confirmText")}
        cancelText={t("cartItems.removeItemModal.cancelText")}
        variant="danger"
        alertTitle={t("cartItems.removeItemModal.alertTitle")}
        alertDescription={t("cartItems.removeItemModal.alertDescription")}
      />
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        slides={lightboxImages}
        render={{ buttonPrev: () => null, buttonNext: () => null }}
      />
    </section>
  );
}
