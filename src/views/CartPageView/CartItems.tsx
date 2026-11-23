import { FC, useState, ReactNode } from "react";
import { CartItem, CartPricingGroup, Product, ProductVariant } from "@/types/ApiResponse";
import type { CartItemIssue } from "@/types/cart";
import {
  toast,
  Button,
  Image,
  useDisclosure,
} from "@/components/ui";
import { Icon } from "@iconify/react";
import Link from "next/link";
import CartQuantityControl from "@/components/CartQuantityControl";
import {
  removeItemFromCart,
  saveCartItemToSaveForLater,
  getProductBySlug,
} from "@/routes/api";
import dynamic from "next/dynamic";

const ProductModal = dynamic(() => import("@/components/Modals/ProductModal"), {
  ssr: false,
});
import ConfirmationModal from "@/components/Modals/ConfirmationModal";
import { updateCartData } from "@/helpers/updators";
import { formatDeliveryByDate } from "@/helpers/delivery";
import { useSelector } from "react-redux";
import { RootState } from "@/lib/redux/store";
import { useTranslation } from "react-i18next";
import { hasFiniteStock } from "@/helpers/stock";
import Lightbox from "yet-another-react-lightbox";
import { mutate } from "swr";
import { useSettings } from "@/contexts/SettingsContext";
import AttachmentUploader from "@/components/Cart/AttachmentUploader";
import type { AttachmentFile } from "@/components/Cart/AttachmentUploader";
import CartAddonList from "@/components/Cart/CartAddonList";
import { cartLineTotal } from "@/helpers/cartPricing";

interface CartItemsProps {
  items: CartItem[];
  pricingGroups?: CartPricingGroup[];
  itemIssues?: CartItemIssue[];
  checkout?: boolean;
}

const CartItems: FC<CartItemsProps> = ({
  items = [],
  pricingGroups = [],
  itemIssues = [],
  checkout = false,
}) => {
  const { t } = useTranslation();
  const { formatPrice, market, systemSettings } = useSettings();
  const [selectedItemId, setSelectedItemId] = useState<number | null>(null);
  const isLoading = useSelector((state: RootState) => state.cart.isLoading);
  // Local state for attachments: Record<productId, AttachmentFile[]>
  const [attachments, setAttachments] = useState<
    Record<number, AttachmentFile[]>
  >({});
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxImages, setLightboxImages] = useState<{ src: string }[]>([]);
  const {
    isOpen: isModalOpen,
    onOpen: onModalOpen,
    onClose: onModalClose,
  } = useDisclosure();
  const [customizingProduct, setCustomizingProduct] = useState<Product | null>(
    null,
  );
  const [customizingVariant, setCustomizingVariant] =
    useState<ProductVariant | null>(null);
  const [initialAddons, setInitialAddons] = useState<Record<number, number[]>>(
    {},
  );
  const [isCustomizing, setIsCustomizing] = useState(false);
  const [editingCartItemId, setEditingCartItemId] = useState<
    number | string | null
  >(null);
  const [editingQuantity, setEditingQuantity] = useState<number>(1);

  // Store attachments in parent component or context
  // Export this for checkout validation
  if (checkout && typeof window !== "undefined") {
    (window as any).__cartAttachments = attachments;
  }

  const lowStockLimit = Number(systemSettings?.lowStockLimit || 0) || null;

  const deliveryEtaLabel = (item: CartItem): string | null => {
    const byDate = formatDeliveryByDate(item.delivery_eta);
    return byDate ? t("cart.deliveryBy", {
      date: byDate,
      defaultValue: `Delivery by ${byDate}`,
    }) : null;
  };

  const pricingById = new Map(pricingGroups.map((group) => [group.group_id, group]));
  const productGroups = new Map<string, { pricing?: CartPricingGroup; lines: CartItem[] }>();
  for (const item of items) {
    const pricing = item.pricing_group_id == null
      ? undefined
      : pricingById.get(item.pricing_group_id);
    const key = `${item.product.id}:${pricing?.group_id ?? "regular"}`;
    const group = productGroups.get(key);
    if (group) {
      group.lines.push(item);
    } else {
      productGroups.set(key, { pricing, lines: [item] });
    }
  }

  const handleRemoveItem = async () => {
    if (!selectedItemId) return;

    try {
      const response = await removeItemFromCart(selectedItemId);
      if (response.success) {
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
      await updateCartData(true, true);
      document.getElementById("refetch-similar-products")?.click();
    }
  };

  // Placeholder for "Save for Later"
  const handleSaveForLater = async (itemId: number, quantity: number) => {
    try {
      const res = await saveCartItemToSaveForLater(itemId, quantity);
      if (res.success) {
        mutate(["/save-for-later", market?.code]);
        updateCartData(true, false);
        toast({
          title: t("saveForLater.movedMessage"),
          color: "success",
        });
      } else {
        toast({
          title: t("saveForLater.errorMessage"),
          color: "success",
        });
      }
    } catch (error) {
      console.error(error);
      toast({
        title: t("cartItems.networkError.title"),
        description: t("cartItems.networkError.description"),
        color: "danger",
      });
    }
  };

  // Handle attachment change for a single product
  const handleAttachmentChange = (
    productId: number,
    attachmentFiles: AttachmentFile[],
  ) => {
    setAttachments((prev) => ({
      ...prev,
      [productId]: attachmentFiles,
    }));
  };

  const handleCustomize = async (item: CartItem) => {
    setIsCustomizing(true);
    try {
      const res = await getProductBySlug({
        slug: item.product.slug,
      });
      if (res.success && res.data) {
        setCustomizingProduct(res.data);
        const variant = res.data.variants.find(
          (v) => v.id === item.product_variant_id,
        );
        setCustomizingVariant(variant || null);

        // Convert cart addons back to modal format
        const addonsMap =
          item.addons?.reduce(
            (acc, addon) => {
              if (!acc[addon.addon_group_id]) acc[addon.addon_group_id] = [];
              acc[addon.addon_group_id].push(addon.addon_item_id);
              return acc;
            },
            {} as Record<number, number[]>,
          ) || {};

        setInitialAddons(addonsMap);
        setEditingCartItemId(item.id);
        setEditingQuantity(item.quantity);
        onModalOpen();
      }
    } catch (error) {
      console.error(error);
      toast({
        title: t("general.error.title"),
        description: t("general.error.somethingWentWrong"),
        color: "danger",
      });
    } finally {
      setIsCustomizing(false);
    }
  };

  const openLightbox = (src: string) => {
    setLightboxImages([{ src }]);
    setLightboxOpen(true);
  };

  // Shared sub-blocks so the two layouts stay in sync -----------------------

  // "finish" -> "Finish", "screen_size" -> "Screen Size"
  const prettifyKey = (k: string) =>
    k.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // Human-readable variant detail for a line. Prefers the backend's structured
  // attribute map (e.g. "Finish: Walnut"); otherwise falls back to the variant
  // title with the redundant "{product name} - " prefix stripped, since the API
  // returns titles like "Extendable Dining Table - Walnut". Returns "" for
  // simple/default products so no extra line renders.
  const getVariantLabel = (item: CartItem): string => {
    const attrs = item.variant.attributes;
    if (attrs && typeof attrs === "object") {
      const parts = Object.entries(attrs)
        .filter(([, v]) => v != null && String(v).trim() !== "")
        .map(([k, v]) => `${prettifyKey(k)}: ${String(v).trim()}`);
      if (parts.length) return parts.join(" · ");
    }
    if (item.variant.variant?.length) return item.variant.variant.join(" · ");
    const title = (item.variant?.title || "").trim();
    const name = (item.product?.name || "").trim();
    if (title && name && title.toLowerCase().startsWith(name.toLowerCase())) {
      return title.slice(name.length).replace(/^[\s|,/·\-–—:]+/, "").trim();
    }
    return title;
  };

  const renderVariantMeta = (item: CartItem, isLowStock: boolean): ReactNode => {
    const variantLabel = getVariantLabel(item);
    return (
    <>
      {(variantLabel || isLowStock) && (
        <div className="flex flex-wrap items-center gap-1.5 text-sm font-medium text-foreground">
          {variantLabel && <span className="break-words">{variantLabel}</span>}
          {isLowStock && (
            <span className="rounded bg-warning-50 px-1.5 py-0.5 text-xs font-semibold text-warning-600">
              {t("product_modal.low_stock_alert", { stock: item.variant.stock })}
            </span>
          )}
        </div>
      )}

      {item.addons && item.addons.length > 0 && (
        <CartAddonList addons={item.addons} />
      )}

      {!checkout && item.variant.is_addons && (
        <button
          type="button"
          onClick={() => handleCustomize(item)}
          disabled={isCustomizing}
          className="flex w-fit items-center gap-0.5 text-sm font-semibold text-primary-600 transition-opacity hover:opacity-80"
        >
          <span className="cursor-pointer">
            {isCustomizing && customizingProduct?.slug === item.product.slug
              ? t("loading")
              : t("cartItems.customize")}
          </span>
          <Icon icon="solar:alt-arrow-right-linear" className="mt-0.5 text-sm" />
        </button>
      )}
    </>
    );
  };

  const renderAttachment = (item: CartItem): ReactNode =>
    item.product.is_attachment_required ? (
      <div className="space-y-2 border-t border-divider px-3 py-2">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <p className="text-xs font-semibold text-foreground">
            {item.product.name} ·{" "}
            {item.product.attachment_mode === "required"
              ? t("cart.attachments.requiredLabel", {
                  defaultValue: "Attachment required",
                })
              : t("cart.attachments.optionalLabel", {
                  defaultValue: "Attachment optional",
                })}
          </p>
          <p className="text-xxs text-foreground/60">
            {t("cart.attachments.helperModeText", {
              defaultValue:
                item.product.attachment_mode === "required"
                  ? "Upload at least one file."
                  : "Upload files if you want.",
            })}
          </p>
        </div>
        <AttachmentUploader
          attachment={attachments[item.product.id] || []}
          onAttachmentChange={(attachmentFiles) =>
            handleAttachmentChange(item.product.id, attachmentFiles)
          }
        />
      </div>
    ) : null;

  const modals = (
    <>
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
      {isModalOpen && customizingProduct && (
        <ProductModal
          isOpen={isModalOpen}
          onClose={onModalClose}
          product={customizingProduct}
          selectedVariant={customizingVariant}
          initialSelectedAddons={initialAddons}
          initialStep="addons"
          editingCartItemId={editingCartItemId}
          editingQuantity={editingQuantity}
        />
      )}
    </>
  );

  const renderLine = (item: CartItem, showBranch: boolean) => {
    const image = item.variant.image || item.product.image;
    const isLowStock =
      lowStockLimit !== null &&
      hasFiniteStock(item.variant.stock) &&
      item.variant.stock > 0 &&
      item.variant.stock <= lowStockLimit;
    const eta = deliveryEtaLabel(item);

    return (
      <div
        key={item.id}
        id={`cart-item-${item.id}`}
        className={`grid scroll-mt-24 grid-cols-[auto_minmax(0,1fr)_minmax(0,auto)] items-start gap-x-3 gap-y-1 px-3 py-2 target:bg-content2 ${checkout ? "" : "@lg:grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,auto)]"}`}
      >
        {image ? (
          <button
            type="button"
            className="col-start-1 row-start-1 flex size-12 items-center justify-center overflow-hidden rounded-medium bg-content2"
            aria-label={t("cart.previewVariant", "Preview {{variant}}", {
              variant: item.variant.title || item.product.name,
            })}
            onClick={() => openLightbox(image)}
          >
            <Image
              src={image}
              alt=""
              removeWrapper
              radius="none"
              className="size-12 object-contain"
            />
          </button>
        ) : <span className="col-start-1 row-start-1 size-12" aria-hidden="true" />}

        <div className="col-start-2 row-start-1 min-w-0 self-center">
          {checkout && <p className="break-words font-semibold">{item.product.name}</p>}
          {renderVariantMeta(item, isLowStock)}
          {showBranch && (
            <p className="text-xs text-foreground/70">{item.store.name}</p>
          )}
          {eta && (
            <p className="text-xs font-medium text-success">{eta}</p>
          )}
        </div>

        <div className={`col-start-3 row-start-1 self-center text-right text-sm tabular-nums ${checkout ? "" : "@lg:col-start-4"}`}>
          <div className="whitespace-nowrap font-semibold text-foreground">
            {formatPrice(cartLineTotal(item))}
          </div>
          <div className="text-xs text-foreground/70">
            {checkout && <>{item.quantity} × </>}
            {formatPrice(Number(item.unit_price ?? item.variant.price))} / {t("wholesale.unit", "unit")}
          </div>
        </div>

        {!checkout && (
          <div className="col-span-full row-start-2 flex items-center justify-between gap-x-2 @lg:col-span-1 @lg:col-start-3 @lg:row-start-1 @lg:self-center">
            <CartQuantityControl
              item={item}
              maxQuantity={item.product.total_allowed_quantity}
              minQuantity={item.product.minimum_order_quantity}
              quantityStep={item.product.quantity_step_size}
              stock={item.variant.stock}
            />
            <div className="flex items-center">
              <Button
                title={t("saveForLater.title")}
                aria-label={t("saveForLater.title")}
                color="primary"
                variant="light"
                size="sm"
                isDisabled={isLoading}
                isIconOnly
                onPress={() => handleSaveForLater(item.id, item.quantity)}
              >
                <Icon icon="solar:bookmark-linear" className="text-base" />
              </Button>
              <Button
                title={t("remove_item")}
                aria-label={t("remove_item")}
                color="danger"
                variant="light"
                size="sm"
                isDisabled={isLoading}
                isIconOnly
                onPress={() => setSelectedItemId(item.id)}
              >
                <Icon icon="solar:trash-bin-trash-linear" className="text-base" />
              </Button>
            </div>
          </div>
        )}
        {itemIssues.filter((issue) => issue.cart_item_id === item.id).map((issue) => (
          <p key={issue.reason} role="alert" className="col-span-full rounded-small bg-danger-50 px-2 py-1 text-sm text-danger">
            {issue.reason}
          </p>
        ))}
      </div>
    );
  };

  const multipleBranches = new Set(items.map((item) => item.store_id)).size > 1;
  const attachmentProducts = checkout
    ? Array.from(new Map(items.map((item) => [item.product.id, item])).values())
        .filter((item) => item.product.is_attachment_required)
    : [];

  return (
    <div className="flex w-full flex-col gap-4">
      {checkout ? (
        <ul className="divide-y divide-divider overflow-hidden rounded-medium border border-divider">
          {items.map((item) => <li key={item.id}>{renderLine(item, multipleBranches)}</li>)}
        </ul>
      ) : [...productGroups].map(([key, { pricing, lines }]) => {
        const { product } = lines[0];
        const quantity = pricing?.quantity ?? lines.reduce((total, item) => total + item.quantity, 0);
        const subtotal = lines.reduce((total, item) => total + cartLineTotal(item), 0);
        const showBranch = new Set(lines.map((item) => item.store_id)).size > 1;
        const header = (
          <>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <h3 className="text-base font-semibold leading-snug">
                  {checkout ? product.name : (
                    <Link href={`/products/${product.slug}`} className="hover:underline">
                      {product.name}
                    </Link>
                  )}
                </h3>
                {pricing && <span className="text-sm font-medium text-foreground/70">{pricing.name}</span>}
              </div>
              <div className="flex flex-wrap gap-x-2 text-sm text-foreground/70">
                <span>{t("wholesale.units", "{{count}} units", { count: quantity })}</span>
                {!checkout && pricing && pricing.minimum_order_quantity > 1 && (
                  <span>{t("wholesale.cartMinimum", "Min. {{minimum}}", { minimum: pricing.minimum_order_quantity })}</span>
                )}
              </div>
            </div>
            <div className="shrink-0 text-right tabular-nums">
              <div className="text-sm text-foreground/70">{t("subtotal", "Subtotal")}</div>
              <div className="text-base font-bold">{formatPrice(subtotal)}</div>
            </div>
          </>
        );
        const groupNote = pricing && (
          pricing.quantity_remaining > 0 ? (
            <p className="px-3 pb-2 text-sm font-medium text-danger">
              {t("wholesale.groupShortfall", "Add {{quantity}} more to check out.", {
                quantity: pricing.quantity_remaining,
              })}
            </p>
          ) : !pricing.quantity_step_valid ? (
            <p className="px-3 pb-2 text-sm font-medium text-danger">
              {t("wholesale.groupStep", "Adjust group quantity in increments of {{step}} above the minimum.", {
                step: pricing.quantity_step_size,
              })}
            </p>
          ) : null
        );
        return (
          <section key={key} className="@container rounded-large border border-divider bg-content1">
            <div className="rounded-t-large bg-content2">
              <div className="flex items-center gap-3 px-3 py-2">{header}</div>
              {groupNote}
            </div>
            <div className="divide-y divide-divider border-t border-divider">
              {lines.map((item) => renderLine(item, showBranch))}
            </div>
          </section>
        );
      })}

      {attachmentProducts.length > 0 && (
        <section className="overflow-hidden rounded-large border border-divider bg-content1">
          <h3 className="px-3 py-2 text-sm font-semibold">{t("cart.attachments.title", "Attachments")}</h3>
          {attachmentProducts.map((item) => (
            <div key={item.product.id}>{renderAttachment(item)}</div>
          ))}
        </section>
      )}

      {modals}
    </div>
  );
};

export default CartItems;
