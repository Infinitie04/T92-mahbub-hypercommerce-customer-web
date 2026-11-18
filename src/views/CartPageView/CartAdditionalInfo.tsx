import { FC, useState, useEffect, useMemo } from "react";
import { Textarea, useDisclosure } from "@/components/ui";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/lib/redux/store";
import AddressModal from "../../components/Modals/AddressModal";
import AddressSection from "@/components/Cart/AddressSection";
import CartItems from "./CartItems";
import { setOrderNote } from "@/lib/redux/slices/checkoutSlice";
import { debounce } from "lodash";
import PromoCodeSection from "@/components/Cart/PromoCodeSection";
import { useTranslation } from "react-i18next";
import Link from "next/link";

const CartAdditionalInfo: FC = () => {
  const { t } = useTranslation();
  const [deliveryInstructions, setDeliveryInstructions] = useState<string>("");
  const address = useSelector((state: RootState) => state.checkout.selectedAddress);
  const { cartData, isLoading, error } = useSelector((state: RootState) => state.cart);
  const items = cartData?.items ?? [];

  const {
    isOpen: isAddressModalOpen,
    onOpen: onAddressModalOpen,
    onClose: onAddressModalClose,
  } = useDisclosure();
  const dispatch = useDispatch();

  const debouncedDispatch = useMemo(() => {
    return debounce((note: string) => {
      dispatch(setOrderNote(note));
    }, 500);
  }, [dispatch]);

  useEffect(() => {
    debouncedDispatch(deliveryInstructions);
    return debouncedDispatch.cancel;
  }, [deliveryInstructions, debouncedDispatch]);

  return (
    <div className="space-y-4">
      <AddressSection onAddAddressModalOpen={onAddressModalOpen} />

      {/* Cart items */}
      {items.length > 0 && !error && (!address || (!isLoading && Number(cartData?.address_id) === Number(address.id))) && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-foreground">
              {t("checkout.orderItems", "Order items")} ({cartData?.total_quantity})
            </h2>
            <Link href="/cart" className="text-sm font-medium text-primary hover:underline">
              {t("checkout.editCart", "Edit cart")}
            </Link>
          </div>
          <CartItems items={items} pricingGroups={cartData?.pricing_groups} checkout />
        </div>
      )}

      {/* Delivery note — promo-style card */}
      <div className="rounded-large border border-divider bg-content1 p-4">
        <h3 className="text-sm font-bold text-foreground">
          {t("cart.deliveryInstructions.title")}
        </h3>
        <Textarea
          className="mt-3"
          placeholder={t("cart.deliveryInstructions.placeholder")}
          value={deliveryInstructions}
          onValueChange={setDeliveryInstructions}
          minRows={3}
          maxRows={3}
          isClearable
        />
      </div>

      {/* Promo Code */}
      <PromoCodeSection />

      <AddressModal
        isOpen={isAddressModalOpen}
        onOpenChange={(state) =>
          state ? onAddressModalOpen() : onAddressModalClose()
        }
        onSave={() => {
          document.getElementById("reset-cart-addresses")?.click();
        }}
      />
    </div>
  );
};

export default CartAdditionalInfo;
