import { useSettings } from "@/contexts/SettingsContext";
import type { RootState } from "@/lib/redux/store";
import { Image, Radio, RadioGroup } from "@/components/ui";
import { Info } from "lucide-react";
import { FC } from "react";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";

interface PaymentMethodsProps {
  selectedPayment: string;
  setSelectedPayment: (value: string) => void;
  hideCOD: boolean;
  codEligible?: boolean;
  isLoading: boolean;
  includeManualPayment?: boolean;
}

const PaymentMethods: FC<PaymentMethodsProps> = ({
  selectedPayment,
  setSelectedPayment,
  hideCOD = false,
  codEligible,
  isLoading = false,
  includeManualPayment = false,
}) => {
  const { t } = useTranslation();
  const { paymentSettings } = useSettings();

  const codAvailable = useSelector(
    (state: RootState) => state.cart.cartData?.payment_summary?.cod_available ?? false,
  );

  const allMethods = [
    {
      id: "razorpayPayment",
      name: t("payments.razorpay.name"),
      tagline: t("payments.razorpay.tagline"),
      icon: "/Payments/razorpay.png",
      isEnabled: paymentSettings?.razorpayPayment === true,
      disabled: false,
      disabledReason: "",
    },
    {
      id: "manualPayment",
      name: paymentSettings?.manualPaymentTitle || t("manualPayment.title", "Manual Payment"),
      tagline: t("manualPayment.tagline", "Transfer to our bank account and upload a receipt."),
      icon: paymentSettings?.manualPaymentImage,
      isEnabled: includeManualPayment && paymentSettings?.manualPayment === true,
      disabled: false,
      disabledReason: "",
    },
    {
      id: "cod",
      name: t("payments.cod.name"),
      tagline: t("payments.cod.tagline"),
      icon: "/Payments/cod.png",
      isEnabled: paymentSettings?.cod === true && !hideCOD,
      disabled: !(codEligible ?? codAvailable),
      disabledReason: t("payments.cod.notAvailable", {
        defaultValue: "Not available for this order",
      }),
    },
  ];

  const paymentMethods = allMethods.filter((method) => method.isEnabled);

  if (paymentMethods.length === 0) return null;

  return (
    <div className="space-y-3">
      <RadioGroup
        aria-label={t("paymentMethod")}
        value={selectedPayment}
        onValueChange={setSelectedPayment}
        className="w-full"
        classNames={{ wrapper: "w-full gap-2" }}
        isDisabled={isLoading}
      >
        {paymentMethods.map((method) => (
          <Radio
            key={method.id}
            value={method.id}
            isDisabled={method.disabled}
            classNames={{
              base: `inline-flex m-0 w-full max-w-full items-center justify-between flex-row-reverse cursor-pointer rounded-medium border gap-2 px-3 py-2.5 ${
                selectedPayment === method.id ? "border-primary bg-primary/5" : "border-divider bg-content1"
              }`,
              control: "text-primary-600",
            }}
          >
            <div className="flex items-center gap-2.5">
              {method.icon && (
                <Image src={method.icon} alt="" width={28} height={28} className="rounded-md" />
              )}
              <div>
                <h4 className="text-sm font-semibold text-foreground">
                  {method.name}
                </h4>
                {method.disabled && method.disabledReason ? (
                  <p className="text-xs text-danger">{method.disabledReason}</p>
                ) : method.tagline ? (
                  <p className="text-xs text-foreground/70">{method.tagline}</p>
                ) : null}
              </div>
            </div>
          </Radio>
        ))}
      </RadioGroup>
      {selectedPayment === "manualPayment" && paymentSettings?.manualPayment && includeManualPayment && (
        <div role="status" className="flex items-start gap-2 rounded-medium border border-yellow-200 bg-yellow-50 px-3 py-2 text-sm text-yellow-950 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-100">
          <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <p>{t("manualPayment.checkoutInstructions",
            "After placing your order, transfer the amount using the details in Order Details. Upload your payment receipt there within {{hours}} hours.",
            { hours: paymentSettings.manualPaymentProofWindowHours ?? 48 })}</p>
        </div>
      )}
    </div>
  );
};

export default PaymentMethods;
