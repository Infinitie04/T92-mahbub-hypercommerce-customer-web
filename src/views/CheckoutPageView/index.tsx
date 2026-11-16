import { FC } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { RootState } from "@/lib/redux/store";
import CartAdditionalInfo from "../CartPageView/CartAdditionalInfo";
import CheckoutSection from "../CartPageView/CheckoutSection";
import CartPageEmpty from "../empty/CartPageEmpty";
import CheckoutLayout from "./CheckoutLayout";
import ConfettiTrigger from "@/components/Functional/ConfettiTrigger";

/**
 * Checkout page (redesign `/redesign/checkout`): delivery address + promo on the
 * left, the order summary + payment on the right. Reached from the cart page's
 * "Proceed to Checkout".
 */
const CheckoutPageView: FC = () => {
  const { t } = useTranslation();
  const { cartData } = useSelector((state: RootState) => state.cart);

  if (!cartData || cartData.items.length === 0) {
    return <CartPageEmpty />;
  }

  return (
    <>
      <ConfettiTrigger />
      <CheckoutLayout
        heading={t("pageTitle.checkout", { defaultValue: "Checkout" })}
        details={<CartAdditionalInfo />}
        summary={<CheckoutSection cart={cartData} />}
      />
    </>
  );
};

export default CheckoutPageView;
