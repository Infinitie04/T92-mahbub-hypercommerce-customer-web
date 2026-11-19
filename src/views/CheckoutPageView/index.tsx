import { ErrorState } from "@/components/ui";
import { updateCartData } from "@/helpers/updators";
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
 * Checkout page (redesign `/redesign/checkout`): delivery and billing addresses on the
 * left, the order summary + payment on the right. Reached from the cart page's
 * "Proceed to Checkout".
 */
const CheckoutPageView: FC = () => {
  const { t } = useTranslation();
  const { cartData, error, isLoading } = useSelector((state: RootState) => state.cart);

  if (!cartData || cartData.items.length === 0) {
    if (isLoading) return <p role="status">{t("checkout.loadingCart", "Loading checkout…")}</p>;
    if (error) return <ErrorState title={error} retryLabel={t("checkout.refreshTotals", "Refresh totals")}
      onRetry={() => void updateCartData(true, false)} />;
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
