import { CheckoutShipping, CheckoutTax } from "../CheckoutPageView/CheckoutBreakdown";
import { FC, useState } from "react";
import { CartResponse } from "@/types/ApiResponse";
import { Button, toast, Divider, Alert } from "@/components/ui";
import { Icon } from "@iconify/react";
import PaymentMethods from "@/components/PaymentMethods";
import { useSettings } from "@/contexts/SettingsContext";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/lib/redux/store";
import { updateCartData } from "@/helpers/updators";
import { setPromoCode } from "@/lib/redux/slices/checkoutSlice";
import { clearCart } from "@/routes/api";
import ConfirmationModal from "@/components/Modals/ConfirmationModal";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { handleCheckout, ensureIdempotencyKey } from "@/helpers/functionalHelpers";

interface CheckoutSectionProps {
  cart: CartResponse;
}

const CheckoutSection: FC<CheckoutSectionProps> = ({ cart }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [paymentChoice, setSelectedPayment] = useState("");
  const [showClearCartModal, setShowClearCartModal] = useState(false);
  const router = useRouter();
  const { formatPrice, paymentSettings, systemSettings } = useSettings();
  const { payment_summary, items } = cart;
  const selectedAddress = useSelector(
    (state: RootState) => state.checkout.selectedAddress,
  );

  const codAvailable = Boolean(selectedAddress?.id && paymentSettings?.cod && payment_summary.cod_available);
  const selectedPayment =
    (paymentChoice === "cod" && codAvailable) ||
    (paymentChoice === "razorpayPayment" && paymentSettings?.razorpayPayment)
      ? paymentChoice
      : "";
  const codFee = selectedPayment === "cod"
    ? payment_summary.eligible_cod_fee ?? payment_summary.cod_fee
    : 0;
  const displayedPayable = payment_summary.payable_amount - payment_summary.cod_fee + codFee;

  const wholesaleProducts = new Set(cart.pricing_groups?.map((group) => group.product_id));
  const productQuantities = new Map<number, number>();
  for (const item of items) {
    if (!item.save_for_later && wholesaleProducts.has(item.product_id)) {
      productQuantities.set(item.product_id, (productQuantities.get(item.product_id) ?? 0) + item.quantity);
    }
  }
  const exceedsProductMaximum = items.find((item) =>
    item.product.total_allowed_quantity > 0 &&
    (productQuantities.get(item.product_id) ?? 0) > item.product.total_allowed_quantity
  );
  const wholesaleBlocked = Boolean(exceedsProductMaximum) ||
    Boolean(cart.pricing_groups?.some((group) => !group.quantity_step_valid));
  const shipments = payment_summary.seller_shipping_costs ?? [];
  const shippingBlocked =
    Boolean(selectedAddress?.id) &&
    shipments.some((shipment) => !shipment.is_fulfillable);

  const dispatch = useDispatch();

  const isLoading = useSelector((state: RootState) => state.cart.isLoading);

  // Attachment guard shared by both checkout paths.
  const attachmentsMissing = (): boolean => {
    const attachments = (window as any).__cartAttachments || {};
    const itemsRequiringAttachments =
      items?.filter(
        (item) =>
          item.product.is_attachment_required &&
          item.product.attachment_mode === "required",
      ) || [];

    const itemsMissingAttachments = itemsRequiringAttachments.filter(
      (item) =>
        !attachments[item.product.id] ||
        attachments[item.product.id].length === 0,
    );

    if (itemsMissingAttachments.length > 0) {
      const productNames = itemsMissingAttachments
        .map((item) => item.product.name)
        .filter(Boolean)
        .join(", ");

      toast({
        title: t("checkout.attachmentsRequired.title", {
          defaultValue: "Attachments Required",
        }),
        description: t("checkout.attachmentsRequired.description", {
          products: productNames,
          defaultValue: `Please upload required attachments for: ${productNames}`,
        }),
        color: "warning",
      });
      return true;
    }
    return false;
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddress) {
      toast({
        title: t("checkout.noAddressSelected.title"),
        description: t("checkout.noAddressSelected.description"),
        color: "warning",
      });
      return;
    }

    if (shippingBlocked || wholesaleBlocked || attachmentsMissing()) return;

    if (!selectedPayment) {
      toast({ title: t("please_select_payment_method"), color: "warning" });
      return;
    }

    setLoading(true);
    try {
      ensureIdempotencyKey(selectedPayment);
      const res = await handleCheckout(selectedPayment, {});

      if (!res?.success) {
        if (!res?.data?.cart) updateCartData(true, false);
        return;
      }

      const slug = res?.data?.slug;
      if (selectedPayment === "cod") {
        dispatch(setPromoCode(""));
        await router.push(
          slug ? `/my-account/orders/${slug}` : "/my-account/orders",
        );
      } else {
        await router.push(`/payment/${slug}`);
      }
    } catch (error) {
      console.error("Error in handlePlaceOrder:", error);
      toast({
        title: t("general.error.title"),
        description: t("general.error.somethingWentWrong"),
        color: "danger",
      });
      updateCartData(true, false);
    } finally {
      setLoading(false);
    }
  };

  const promo = Array.isArray(payment_summary?.promo_applied)
    ? null
    : payment_summary?.promo_applied || null;

  const isFreeShipping = promo?.discount_type === "free_shipping";
  const isInstantPromo = promo?.promo_mode === "instant";

  // Validation checks based on system settings
  const validationErrors: string[] = [];

  if (
    systemSettings?.checkoutType === "single_store" &&
    items?.length > 0
  ) {
    const uniqueStoreIds = new Set(
      items.map((item) => item.store?.id).filter(Boolean),
    );
    if (uniqueStoreIds.size > 1) {
      validationErrors.push(
        t("checkout.validation.multipleBranches", {
          defaultValue:
            "Your order must ship from one branch. Remove items assigned to another branch to continue.",
        }),
      );
    }
  }

  if (
    systemSettings?.maximumItemsAllowedInCart &&
    items.length > systemSettings.maximumItemsAllowedInCart
  ) {
    validationErrors.push(
      t("checkout.validation.maxItemsExceeded", {
        maxItems: systemSettings.maximumItemsAllowedInCart,
        currentItems:
          items.length -
          Number(systemSettings.maximumItemsAllowedInCart),
        defaultValue: `Maximum ${systemSettings.maximumItemsAllowedInCart} items allowed in cart. You have ${items.length} cart lines.`,
      }),
    );
  }

  const minimumCartAmount =
    payment_summary.minimum_cart_amount ||
    systemSettings?.minimumCartAmount ||
    0;
  if (minimumCartAmount && payment_summary.items_total < minimumCartAmount) {
    const remainingAmount = minimumCartAmount - payment_summary.items_total;
    validationErrors.push(
      t("checkout.validation.minCartAmount", {
        minAmount: formatPrice(minimumCartAmount),
        currentAmount: formatPrice(payment_summary.items_total),
        remainingAmount: formatPrice(remainingAmount),
        currencySymbol: "",
        defaultValue: `Minimum cart amount is ${formatPrice(minimumCartAmount)}. Add ${formatPrice(remainingAmount)} more to proceed.`,
      }),
    );
  }

  const hasValidationErrors = validationErrors.length > 0;

  return (
    <div className="flex w-full flex-col gap-4 md:sticky md:top-24">
      {/* ---------- Bill Details ---------- */}
      <div className="w-full rounded-large border border-divider bg-content1 p-4 sm:p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold text-foreground">
            {t("cart.billDetails", { defaultValue: "Bill Details" })}
          </h2>
          <Button
            size="sm"
            variant="light"
            className="h-7 text-xs"
            color="danger"
            title={t("checkout.clearCart")}
            startContent={
              <Icon icon="solar:trash-bin-trash-linear" className="text-sm" />
            }
            onPress={() => setShowClearCartModal(true)}
          >
            {t("checkout.clearCart")}
          </Button>
        </div>

        <div className="mt-4 w-full space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-foreground/60">
              {t("checkout.itemsTotal")}
            </span>
            <span className="font-semibold">
              {formatPrice(payment_summary.items_total)}
            </span>
          </div>
          <div className="-mt-2 w-full text-start text-xs text-foreground/50">
            {`${t("checkout.allPricesIncludeTaxes")}`}
          </div>

          {payment_summary.total_saving > 0 && (
            <div className="flex justify-between text-success">
              <span>
                {t("checkout.totalSaving", { defaultValue: "Total savings" })}
              </span>
              <span>{formatPrice(-payment_summary.total_saving)}</span>
            </div>
          )}

          {selectedAddress?.id && (
            <div className="flex justify-between">
              <span className="text-foreground/60">
                {t("checkout.deliveryCharges")}
              </span>

              {shippingBlocked ? (
                <span className="text-danger">
                  {t("checkout.notAvailable", { defaultValue: "Not available" })}
                </span>
              ) : isFreeShipping && isInstantPromo ? (
                <span className="flex items-center gap-2">
                  <span className="text-foreground/50 line-through">
                    {formatPrice(payment_summary.delivery_charges)}
                  </span>
                  <span className="font-semibold text-success">
                    {t("checkout.freeShipping")}
                  </span>
                </span>
              ) : (
                <span>
                  {payment_summary.delivery_charges === 0 && shipments.length > 0
                    ? t("checkout.freeShipping")
                    : formatPrice(payment_summary.delivery_charges)}
                </span>
              )}
            </div>
          )}

          {selectedAddress?.id && <CheckoutShipping shipments={shipments} formatPrice={formatPrice} itemLink={(id) => `/cart#cart-item-${id}`} />}
          <CheckoutTax total={payment_summary.tax_total} breakdown={payment_summary.tax_breakdown} formatPrice={formatPrice} />

          {payment_summary.platform_fee > 0 && (
            <div className="flex justify-between">
              <span className="text-foreground/60">
                {t("checkout.platformFee", { defaultValue: "Platform fee" })}
              </span>
              <span>{formatPrice(payment_summary.platform_fee)}</span>
            </div>
          )}

          {codFee > 0 && (
            <div className="flex justify-between">
              <span className="text-foreground/60">
                {t("checkout.codFee", { defaultValue: "COD fee" })}
              </span>
              <span>{formatPrice(codFee)}</span>
            </div>
          )}

          {payment_summary.pending_charges?.length > 0 && (
            <div className="space-y-1 rounded-lg bg-warning-50 p-2 text-xs">
              {payment_summary.pending_charges.map((charge) => (
                <div key={charge.id} className="flex justify-between">
                  <span className="text-foreground/80">
                    {charge.reason_note || charge.reason}
                  </span>
                  <span>{formatPrice(charge.amount)}</span>
                </div>
              ))}
              {payment_summary.pending_charges_total > 0 && (
                <div className="flex justify-between border-t border-warning-200 pt-1 font-medium">
                  <span>
                    {t("checkout.pendingChargesTotal", {
                      defaultValue: "Pending charges",
                    })}
                  </span>
                  <span>
                    {formatPrice(payment_summary.pending_charges_total)}
                  </span>
                </div>
              )}
            </div>
          )}

          {selectedAddress?.id ? (
            <>
              {payment_summary.promo_applied &&
                payment_summary.promo_discount > 0 &&
                isInstantPromo && (
                  <div className="flex items-center justify-between text-success">
                    <span className="flex items-center gap-1.5 font-medium">
                      <Icon icon="solar:tag-linear" className="text-base" />
                      {t("checkout.promo")}: {payment_summary?.promo_code}
                    </span>
                    <span className="whitespace-nowrap font-semibold">
                      {isFreeShipping
                        ? t("checkout.freeShipping")
                        : `- ${formatPrice(payment_summary.promo_discount)}`}
                    </span>
                  </div>
                )}

              {payment_summary.promo_error && (
                <div className="flex items-center gap-2 text-xs text-danger">
                  <Icon icon="solar:tag-linear" className="text-sm" />
                  <span>{payment_summary.promo_error}</span>
                </div>
              )}
            </>
          ) : null}

          <Divider />

          <div className="flex justify-between text-lg font-bold text-foreground">
            <span>{t("checkout.totalAmount")}</span>
            <span>{formatPrice(displayedPayable)}</span>
          </div>

          {payment_summary.total_saving > 0 && (
            <div className="flex items-center gap-2 rounded-xl bg-green-50 px-3 py-2.5 text-sm font-semibold text-green-700">
              <Icon icon="solar:tag-price-bold" className="shrink-0 text-base" />
              <span>
                {t("cart.savedOnOrder", {
                  amount: formatPrice(payment_summary.total_saving),
                  defaultValue: `You saved ${formatPrice(payment_summary.total_saving)} on this order!`,
                })}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ---------- Payment methods (inline) ---------- */}
      {!hasValidationErrors && (
        <div className="w-full rounded-large border border-divider bg-content1 p-4 sm:p-5">
          <h3 className="text-sm font-bold text-foreground">
            {t("checkout.payWith", {
              amount: formatPrice(displayedPayable),
              defaultValue: `Pay: ${formatPrice(displayedPayable)} with`,
            })}
          </h3>

          <div className="mt-1">
            <PaymentMethods
              selectedPayment={selectedPayment}
              setSelectedPayment={setSelectedPayment}
              hideCOD={!selectedAddress?.id}
              isLoading={loading || isLoading}
            />
          </div>
        </div>
      )}

      {/* ---------- Place order ---------- */}
      {hasValidationErrors ? (
        <Alert
          color="warning"
          variant="faded"
          title={t("checkout.validation.title", {
            defaultValue: "Cannot proceed to checkout",
          })}
          description={
            <ul className="list-disc ps-5">
              {validationErrors.map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          }
          classNames={{ description: "text-xs" }}
        />
      ) : (
        <div className="space-y-2">
          {wholesaleBlocked && (
            <p id="checkout-wholesale-blocked" className="text-sm text-danger">
              {exceedsProductMaximum
                ? t("wholesale.productMaximum", {
                    product: exceedsProductMaximum.product.name,
                    maximum: exceedsProductMaximum.product.total_allowed_quantity,
                    defaultValue: "{{product}} allows up to {{maximum}} units per order.",
                  })
                : t("wholesale.checkoutBlocked", "Adjust the wholesale group quantities above to continue.")}
            </p>
          )}
          {shippingBlocked && (
            <p id="checkout-shipping-blocked" className="text-sm text-danger" role="status">
              {t("checkout.shippingBlocked", {
                defaultValue: "Update the unavailable items above to continue.",
              })}
            </p>
          )}
          <Button
            color="primary"
            fullWidth
            className="font-semibold"
            isLoading={loading}
            isDisabled={isLoading || shippingBlocked || wholesaleBlocked}
            aria-describedby={
              [shippingBlocked && "checkout-shipping-blocked", wholesaleBlocked && "checkout-wholesale-blocked"]
                .filter(Boolean).join(" ") || undefined
            }
            onPress={handlePlaceOrder}
          >
            {t("checkout.placeOrder", { defaultValue: "Place Order" })}
          </Button>
        </div>
      )}

      <ConfirmationModal
        isOpen={showClearCartModal}
        onClose={() => setShowClearCartModal(false)}
        onConfirm={async () => {
          await clearCart();
          setShowClearCartModal(false);
          toast({
            title: t("checkout.cartCleared.title"),
            description: t("checkout.cartCleared.description"),
            color: "success",
          });
          await router.push("/");
          updateCartData(true, false);
        }}
        title="Clear Cart"
        icon={<Icon icon="solar:trash-bin-trash-linear" className="text-base" />}
        description={t("checkout.clearCartModal.description")}
        confirmText={t("checkout.clearCartModal.confirmText")}
        cancelText={t("checkout.clearCartModal.cancelText")}
        variant="danger"
        alertTitle={t("checkout.clearCartModal.alertTitle")}
        alertDescription={t("checkout.clearCartModal.alertDescription")}
      />
    </div>
  );
};

export default CheckoutSection;
