import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { MapPin, Plus, ReceiptText } from "lucide-react";
import useSWR from "swr";
import useSWRInfinite from "swr/infinite";
import { Button, Card, CardBody, toast } from "@/components/ui";
import AddressModal from "@/components/Modals/AddressModal";
import AddressSelectionModal from "@/components/Modals/AddressSelectionModal";
import { resolveMarketForCountry } from "@/helpers/market";
import { updateCartData } from "@/helpers/updators";
import { setBillingAddress, setSelectedAddress } from "@/lib/redux/slices/checkoutSlice";
import { RootState } from "@/lib/redux/store";
import { getAddresses } from "@/routes/api";
import { Address } from "@/types/ApiResponse";

type Purpose = "delivery" | "billing";
type Dialog = { purpose: Purpose; mode: "pick" | "add" };

export default function AddressSection({ onAddressSelected }: { onAddressSelected?: (address: Address) => void }) {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const { selectedAddress: delivery, billingAddress: choice } = useSelector((state: RootState) => state.checkout);
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [pickedId, setPickedId] = useState("");
  const { data: defaultBilling, error: defaultError, mutate: reloadDefault } = useSWR(
    userId ? ["checkout-default-billing", userId] : null,
    async () => {
      const res = await getAddresses({ per_page: 1, is_default_billing: 1 });
      if (!res.success) throw new Error(res.message);
      return res.data.data[0] ?? null;
    },
  );
  const billing = choice === "delivery" ? delivery : choice ?? defaultBilling ?? delivery;
  const { data: pages, size, setSize, isValidating, mutate: reloadList, error } = useSWRInfinite(
    (index, previous) => userId && dialog?.mode === "pick" && (!previous || previous.data.length === 10)
      ? ["checkout-address-book", userId, index + 1] : null,
    async ([, , page]) => {
      const res = await getAddresses({ page: Number(page), per_page: 10 });
      if (!res.success) throw new Error(res.message);
      return res.data;
    },
  );
  const addresses = pages?.flatMap((page) => page.data) ?? [];

  useEffect(() => {
    dispatch(setSelectedAddress(null));
    dispatch(setBillingAddress(null));
  }, [dispatch, userId]);

  function open(purpose: Purpose, mode: Dialog["mode"]) {
    setPickedId(String((purpose === "billing" ? billing : delivery)?.id ?? ""));
    setDialog({ purpose, mode });
  }

  async function select(address: Address) {
    const purpose = dialog?.purpose;
    setDialog(null);
    if (purpose === "billing") {
      dispatch(setBillingAddress(address));
      return;
    }
    if (onAddressSelected) {
      if (!await resolveMarketForCountry(address.country_code)) {
        toast({ title: t("checkout.addresses.marketError"), color: "warning" });
        return;
      }
      onAddressSelected(address);
    }
    dispatch(setSelectedAddress(address));
    if (!onAddressSelected) await updateCartData(false, false, address.id);
  }

  return (
    <>
      {(["delivery", "billing"] as const).map((purpose) => {
        const isBilling = purpose === "billing";
        const address = isBilling ? billing : delivery;
        const billingLabel = address?.legal_name || (address && address.id === delivery?.id ? t("checkout.addresses.same") : null);
        const Icon = isBilling ? ReceiptText : MapPin;
        const waitingForDefault = isBilling && !choice && defaultBilling === undefined;
        return (
          <Card as="section" key={purpose}>
            <CardBody className="space-y-3 p-4">
              <div className="flex items-center gap-2">
                <Icon className="size-4 text-primary" aria-hidden="true" />
                <h2 className="text-sm font-semibold">{t(isBilling ? "checkout.addresses.billing" : "address.deliveryAddress")}</h2>
              </div>
              {waitingForDefault ? (
                <p role="status" className="text-sm text-default-500">
                  {defaultError ? t("checkout.addresses.loadError") : t("loading")}
                </p>
              ) : address ? (
                <div className="space-y-1 text-sm">
                  {isBilling && billingLabel && <p className="font-medium">{billingLabel}</p>}
                  <p className="text-default-600">{[address.address_line1, address.address_line2, address.landmark, address.city, address.state, address.zipcode, address.country].filter(Boolean).join(", ")}</p>
                  {isBilling && address.gstin && <p className="text-default-600">GSTIN · {address.gstin}</p>}
                  {!isBilling && address.mobile && <p className="text-default-600">{address.mobile}</p>}
                </div>
              ) : (
                <p className="text-sm text-default-500">{t(isBilling ? "checkout.addresses.deliveryFallback" : "address.chooseLocation")}</p>
              )}
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="bordered" onPress={() => open(purpose, "pick")}>
                  {t(address ? "change" : "address.selectAddress")}
                </Button>
                <Button size="sm" variant="flat" color="primary" startContent={<Plus className="size-4" />} onPress={() => open(purpose, "add")}>
                  {t(isBilling ? "checkout.addresses.addBilling" : "address.addNew")}
                </Button>
                {isBilling && delivery && (waitingForDefault || billing?.id !== delivery.id || (choice && choice !== "delivery")) && (
                  <Button size="sm" variant="light" onPress={() => dispatch(setBillingAddress("delivery"))}>{t("checkout.addresses.useDelivery")}</Button>
                )}
              </div>
            </CardBody>
          </Card>
        );
      })}
      {dialog?.mode === "pick" && (
        <AddressSelectionModal isOpen title={t(dialog.purpose === "billing" ? "checkout.addresses.billing" : "address.deliveryAddress")}
          onOpenChange={() => setDialog(null)} onAddNew={() => open(dialog.purpose, "add")}
          addresses={addresses} selectedAddressId={String((dialog.purpose === "billing" ? billing : delivery)?.id ?? "")}
          tempSelectedId={pickedId} handleModalSelection={setPickedId}
          handleConfirmSelection={() => { const address = addresses.find((a) => String(a.id) === pickedId); if (address) void select(address); }}
          isLoading={!pages && !error} totalAddresses={pages?.[0]?.total ?? 0}
          loadError={Boolean(error)} onRetry={() => void reloadList()}
          onLoadMore={() => void setSize(size + 1)} isLoadingMore={isValidating} />
      )}
      {dialog?.mode === "add" && (
        <AddressModal isOpen title={t(dialog.purpose === "billing" ? "checkout.addresses.addBilling" : "address.addNew")}
          onOpenChange={() => setDialog(null)} onSavedAddress={(address) => {
            void select(address);
            void reloadDefault();
          }} />
      )}
    </>
  );
}
