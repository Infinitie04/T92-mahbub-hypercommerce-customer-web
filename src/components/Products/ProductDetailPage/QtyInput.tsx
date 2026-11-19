import { Button, toast } from "@/components/ui";
import { FC } from "react";
import { useTranslation } from "react-i18next";
import QuantityField from "@/components/QuantityField";

interface QtyInputProps {
  quantity: number;
  setQuantity: (val: number) => void;
  min?: number;
  step?: number;
  max?: number;
  stock?: number | null;
  id?: string;
  label?: string;
  disabled?: boolean;
  compact?: boolean;
}

const QtyInput: FC<QtyInputProps> = ({
  quantity,
  setQuantity,
  min = 1,
  step = 1,
  max = 0,
  stock,
  id,
  label,
  disabled = false,
  compact = false,
}) => {
  const { t } = useTranslation();
  const maximum = max > 0 ? max : Number.MAX_SAFE_INTEGER;

  const handleChange = (newQty: number) => {
    if (newQty < min) {
      toast({
        title: t("min_quantity_error_title"),
        description: t("min_quantity_error_description", { min }),
        color: "danger",
      });
      return;
    }

    if (newQty > maximum) {
      toast({
        title: t("max_quantity_error_title"),
        description: t("max_quantity_error_description", { max: maximum }),
        color: "danger",
      });
      return;
    }

    if (stock !== null && stock !== undefined && newQty > stock) {
      toast({
        title: t("stock_limit_error_title"),
        description: t("stock_limit_error_description", { stock }),
        color: "danger",
      });
      return;
    }

    if ((newQty - min) % step !== 0) {
      toast({
        title: t("step_error_title"),
        description: t("step_error_description", { step }),
        color: "danger",
      });
      return;
    }

    setQuantity(newQty);
  };

  const decrement = () => handleChange(quantity - step);
  const increment = () => handleChange(quantity + step);

  return (
    <div
      className={`inline-flex items-center overflow-hidden rounded-medium border border-divider bg-content1 ${compact ? "h-8" : "h-10"}`}
    >
      <Button
        isIconOnly
        color="default"
        variant="light"
        onPress={decrement}
        size="sm"
        aria-label={t("decrease_quantity", "Decrease quantity")}
        isDisabled={disabled || quantity <= min}
        className={`h-full rounded-none bg-transparent p-0 text-foreground shadow-none hover:bg-content2 disabled:text-foreground/30 ${compact ? "min-w-7" : "min-w-10"}`}
      >
        <span aria-hidden="true" className="text-lg font-semibold leading-none">
          −
        </span>
      </Button>
      <QuantityField
        id={id}
        label={label ?? t("wholesale.quantity", "Quantity")}
        quantity={quantity}
        onCommit={handleChange}
        disabled={disabled}
        className={compact ? "h-6 w-10" : "h-8 w-12"}
      />
      <Button
        isIconOnly
        color="default"
        variant="light"
        onPress={increment}
        size="sm"
        aria-label={t("increase_quantity", "Increase quantity")}
        isDisabled={disabled}
        className={`h-full rounded-none bg-transparent p-0 text-foreground shadow-none hover:bg-content2 ${compact ? "min-w-7" : "min-w-10"}`}
      >
        <span aria-hidden="true" className="text-lg font-semibold leading-none">
          +
        </span>
      </Button>
    </div>
  );
};

export default QtyInput;
