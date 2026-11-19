import { FC, useState, useEffect, useMemo } from "react";
import { Textarea } from "@/components/ui";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "@/lib/redux/store";
import AddressSection from "@/components/Cart/AddressSection";
import CartItems from "./CartItems";
import { setOrderNote } from "@/lib/redux/slices/checkoutSlice";
import { debounce } from "lodash";
import { useTranslation } from "react-i18next";
import { SquarePen } from "lucide-react";
import Link from "next/link";

const CartAdditionalInfo: FC = () => {
  const { t, i18n } = useTranslation();
  const [deliveryInstructions, setDeliveryInstructions] = useState<string>("");
  const address = useSelector((state: RootState) => state.checkout.selectedAddress);
  const { cartData, isLoading, error } = useSelector((state: RootState) => state.cart);
  const items = cartData?.items ?? [];

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
    <div className="flex min-w-0 flex-col gap-3">
      <AddressSection />

      <div className="rounded-large border border-divider bg-content1 p-4">
        <h3 className="flex flex-wrap items-center gap-2 text-base font-bold text-foreground">
          <SquarePen className="size-4 text-primary" />{t("cart.deliveryInstructions.title")} <span className="text-sm font-normal">({t("optional", "Optional")})</span>
        </h3>
        <Textarea
          className="mt-2"
          placeholder={t("cart.deliveryInstructions.placeholder")}
          value={deliveryInstructions}
          onValueChange={setDeliveryInstructions}
          aria-label={t("cart.deliveryInstructions.title")}
          minRows={2}
          maxRows={3}
          isClearable
        />
      </div>

      {/* Cart items */}
      {items.length > 0 && !error && (!address || (!isLoading && Number(cartData?.address_id) === Number(address.id))) && (
        <section className="rounded-large border border-divider bg-content1 p-4">
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h2 className="text-base font-bold text-foreground">
              {t("checkout.orderItems", "Order items")} ({t("checkout.unitCount", { units: Number(cartData?.total_quantity ?? 0).toLocaleString(i18n.language) })})
            </h2>
            <Link href="/cart" className="text-sm font-medium text-primary hover:underline">
              {t("checkout.editCart", "Edit cart")}
            </Link>
          </div>
          <CartItems items={items} pricingGroups={cartData?.pricing_groups} checkout />
        </section>
      )}
    </div>
  );
};

export default CartAdditionalInfo;
