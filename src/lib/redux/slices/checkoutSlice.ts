import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Address } from "@/types/ApiResponse";

export interface CheckoutState {
  selectedAddress: Address | null;
  billingAddress: Address | "delivery" | null;
  orderNote: string;
  promoCode: string;
  idempotencyKey: string;
}

const initialState: CheckoutState = {
  selectedAddress: null,
  billingAddress: null,
  orderNote: "",
  promoCode: "",
  idempotencyKey: "",
};

const checkoutSlice = createSlice({
  name: "checkout",
  initialState,
  reducers: {
    setSelectedAddress: (state, action: PayloadAction<Address | null>) => {
      state.selectedAddress = action.payload;
    },
    setBillingAddress: (state, action: PayloadAction<CheckoutState["billingAddress"]>) => {
      state.billingAddress = action.payload;
    },
    setOrderNote: (state, action: PayloadAction<string>) => {
      state.orderNote = action.payload;
    },
    setPromoCode: (state, action: PayloadAction<string>) => {
      state.promoCode = action.payload;
    },
    setIdempotencyKey: (state, action: PayloadAction<string>) => {
      state.idempotencyKey = action.payload;
    },
  },
});

export const {
  setSelectedAddress,
  setBillingAddress,
  setOrderNote,
  setPromoCode,
  setIdempotencyKey,
} = checkoutSlice.actions;
export default checkoutSlice.reducer;
