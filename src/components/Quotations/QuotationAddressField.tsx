import { Button } from "@/components/ui";
import AddressModal from "@/components/Modals/AddressModal";
import AddressSelectionModal from "@/components/Modals/AddressSelectionModal";
import type { RootState } from "@/lib/redux/store";
import { getAddresses } from "@/routes/api";
import type { QuotationAddress } from "@/services/quotations";
import { useState } from "react";
import { useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import useSWRInfinite from "swr/infinite";

export default function QuotationAddressField({ address, onChange, disabled, errorMessage }: {
  address?: QuotationAddress | null;
  onChange?: (address: QuotationAddress) => void;
  disabled?: boolean;
  errorMessage?: string;
}) {
  const { t } = useTranslation();
  const userId = useSelector((state: RootState) => state.auth.user?.id);
  const [dialog, setDialog] = useState<"pick" | "add" | null>(null);
  const [picked, setPicked] = useState("");
  const { data: pages, error, mutate, size, setSize, isValidating } = useSWRInfinite(
    (index, previous) => userId && dialog === "pick" && (!previous || previous.data.length === 10)
      ? ["quotation-address-book", userId, index + 1] : null,
    async ([, , page]) => {
      const response = await getAddresses({ page: Number(page), per_page: 10 });
      if (!response.success) throw new Error(response.message);
      return response.data;
    },
  );
  const addresses = pages?.flatMap((page) => page.data) ?? [];

  function choose(next: QuotationAddress) {
    setDialog(null);
    onChange?.(next);
  }

  return (
    <section className="space-y-2 rounded-large border border-divider bg-content1 p-4">
      <h2 className="font-semibold">{t("address.deliveryAddress")}</h2>
      <p className="break-words text-sm text-default-600">
        {address ? [address.address_line1, address.address_line2, address.landmark, address.city, address.state,
          address.zipcode, address.country].filter(Boolean).join(", ") : t("quotation.selectDelivery")}
      </p>
      {errorMessage && <p role="alert" className="text-sm text-danger">{errorMessage}</p>}
      {onChange && (
        <Button type="button" size="sm" variant="bordered" isDisabled={disabled} onPress={() => {
          setPicked(String(address?.id ?? ""));
          setDialog("pick");
        }}>{t(address ? "change" : "address.selectAddress")}</Button>
      )}
      {dialog === "pick" && (
        <AddressSelectionModal isOpen onOpenChange={(open?: boolean) => setDialog(open ? "pick" : null)}
          onAddNew={() => setDialog("add")} addresses={addresses} selectedAddressId={String(address?.id ?? "")}
          tempSelectedId={picked} handleModalSelection={setPicked}
          handleConfirmSelection={() => { const selected = addresses.find((item) => String(item.id) === picked); if (selected) choose(selected); }}
          isLoading={!pages && !error} loadError={Boolean(error)} onRetry={() => void mutate()}
          totalAddresses={pages?.[0]?.total ?? 0} onLoadMore={() => void setSize(size + 1)} isLoadingMore={isValidating} />
      )}
      {dialog === "add" && (
        <AddressModal isOpen onOpenChange={() => setDialog(null)} onSavedAddress={choose} />
      )}
    </section>
  );
}
