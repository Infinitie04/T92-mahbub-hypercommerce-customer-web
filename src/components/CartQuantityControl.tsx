import React, { useState, useCallback, useEffect, useMemo } from "react";
import { Minus, Plus } from "lucide-react";
import { debounce } from "lodash";
import { CartItem } from "@/types/ApiResponse";
import { updateCartItem } from "@/routes/api";
import { updateCartData } from "@/helpers/updators";
import { addToast } from "@heroui/react";
import { useDispatch, useSelector } from "react-redux";
import { setCartLoading } from "@/lib/redux/slices/cartSlice";
import { RootState } from "@/lib/redux/store";
import { useTranslation } from "react-i18next";
import { hasFiniteStock } from "@/helpers/stock";
import QuantityField from "@/components/QuantityField";

interface CartQuantityControlProps {
  item: CartItem;
  debounceDelay?: number;
  minQuantity?: number;
  maxQuantity?: number;
  quantityStep?: number;
  stock?: number | null;
}

const quantityButtonClass =
  "grid size-8 shrink-0 place-items-center text-foreground hover:bg-content2 focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus disabled:opacity-40 disabled:hover:bg-transparent";

const CartQuantityControl: React.FC<CartQuantityControlProps> = ({
  item,
  debounceDelay = 500,
  minQuantity = 1,
  maxQuantity = 0,
  quantityStep = 1,
  stock = null,
}) => {
  const { t } = useTranslation();
  const [localQuantity, setLocalQuantity] = useState<number>(item.quantity);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const otherQuantity = useSelector((state: RootState) =>
    state.cart.cartData?.items.reduce((sum, line) =>
      !line.save_for_later && line.product_variant_id === item.product_variant_id && line.id !== item.id
        ? sum + Number(line.quantity) : sum, 0) ?? 0);
  const maximum = maxQuantity > 0 ? Math.max(0, maxQuantity - otherQuantity) : Number.MAX_SAFE_INTEGER;
  const dispatch = useDispatch();
  const isLoading = useSelector((state: RootState) => state.cart.isLoading);

  const debouncedUpdateQuantity = useMemo(
    () =>
      debounce(async (itemId: string | number, quantity: number) => {
        setIsUpdating(true);
        dispatch(setCartLoading(true));
        try {
          const response = await updateCartItem({
            cartItemId: itemId,
            quantity: quantity,
          });

          if (response.success) {
            addToast({
              title: t("cart_updated_title"),
              description: t("cart_updated_description"),
              color: "success",
            });
          } else {
            addToast({
              title: t("update_failed_title"),
              description: response.message || t("update_failed_description"),
              color: "danger",
            });
            setLocalQuantity(item.quantity);
            console.error(response.message || "Failed to update quantity");
          }
        } catch (error) {
          console.error(error);
          setLocalQuantity(item.quantity);
          addToast({
            title: t("network_error_title"),
            description: t("network_error_description"),
            color: "danger",
          });
        } finally {
          await updateCartData(true, true);
          setIsUpdating(false);
        }
      }, debounceDelay),
    [item, debounceDelay, dispatch, t]
  );

  const handleQuantityChange = useCallback(
    (newQuantity: number, commitImmediately = false) => {
      if (newQuantity < minQuantity) {
        addToast({
          title: t("min_quantity_error_title"),
          description: t("min_quantity_error_description", {
            min: minQuantity,
          }),
          color: "danger",
        });
        return;
      }

      if (newQuantity > maximum) {
        addToast({
          title: t("max_quantity_error_title"),
          description: t("max_quantity_error_description", {
            max: maximum,
          }),
          color: "danger",
        });
        return;
      }

      if (hasFiniteStock(stock) && newQuantity > stock) {
        addToast({
          title: t("stock_limit_error_title"),
          description: t("stock_limit_error_description", { stock }),
          color: "danger",
        });
        return;
      }

      if ((newQuantity - minQuantity) % quantityStep !== 0) {
        addToast({
          title: t("step_error_title"),
          description: t("step_error_description", { step: quantityStep }),
          color: "danger",
        });
        return;
      }

      setLocalQuantity(newQuantity);
      debouncedUpdateQuantity(item.id, newQuantity);
      if (commitImmediately) debouncedUpdateQuantity.flush();
    },
    [
      item.id,
      minQuantity,
      maximum,
      stock,
      quantityStep,
      debouncedUpdateQuantity,
      t,
    ]
  );

  const handleIncrement = useCallback(
    () => handleQuantityChange(localQuantity + quantityStep),
    [localQuantity, quantityStep, handleQuantityChange]
  );
  const handleDecrement = useCallback(
    () => handleQuantityChange(localQuantity - quantityStep),
    [localQuantity, quantityStep, handleQuantityChange]
  );

  useEffect(() => {
    setLocalQuantity(item.quantity);
  }, [item.quantity]);

  useEffect(() => {
    return () => debouncedUpdateQuantity.cancel();
  }, [debouncedUpdateQuantity]);

  return (
    <div className="flex h-8 items-center overflow-hidden rounded-small border border-divider bg-content1" aria-busy={isUpdating}>
      <button
        type="button"
        className={quantityButtonClass}
        onClick={handleDecrement}
        disabled={isUpdating || isLoading}
        aria-label={t("decrease_quantity")}
      >
        <Minus className="size-3.5" aria-hidden="true" />
      </button>

      <div className="flex items-center">
        <QuantityField
          label={t("wholesale.variantQuantity", "Quantity for {{variant}}", {
            variant: item.variant.title || item.product.name,
          })}
          quantity={localQuantity}
          onCommit={(quantity) => handleQuantityChange(quantity, true)}
          disabled={isUpdating || isLoading}
          className="h-8 w-11"
        />
        {isUpdating && (
          <span className="ms-1 inline-block animate-spin">⏳</span>
        )}
      </div>

      <button
        type="button"
        className={quantityButtonClass}
        onClick={handleIncrement}
        disabled={isUpdating || isLoading}
        aria-label={t("increase_quantity")}
      >
        <Plus className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
};

export default CartQuantityControl;
