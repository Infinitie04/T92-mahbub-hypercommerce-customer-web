import { geoDetectForCountry, switchMarket } from "@/routes/api";
import { getCookie, setCookie } from "@/lib/cookies";
import { mutate } from "swr";

/**
 * SWR keys whose payload changes with the active market: settings, the whole
 * catalogue, the home layout and search. A market switch has to drop all of
 * them, not just `/settings`.
 */
const MARKET_SCOPED_KEY_PREFIXES = [
  "/settings",
  "/products",
  "/categories",
  "/brands",
  "/stores",
  "/home-layout",
  "/infinite-data",
  "search:",
  "seller-reviews",
  "user-wallet",
];

export const isMarketScopedKey = (key: unknown): boolean => {
  const head = Array.isArray(key) ? key[0] : key;

  return (
    typeof head === "string" &&
    MARKET_SCOPED_KEY_PREFIXES.some((prefix) => head.startsWith(prefix))
  );
};

// Serialize market switches across the desktop selector, mobile selector, and checkout.
let pendingMarket: Promise<string | null> = Promise.resolve(null);

export const resolveMarketForCountry = (countryCode?: string): Promise<string | null> => {
  const resolve = async () => {
    const res = await geoDetectForCountry(countryCode);
    const code = res?.data?.suggested_market?.code;
    if (!code) return null;
    if (getCookie<string>("market") !== code) {
      const switched = await switchMarket(code);
      if (!switched.success) return null;
      setCookie("market", code);
      await mutate(isMarketScopedKey);
    }
    return code;
  };
  pendingMarket = pendingMarket.then(resolve).catch(() => null);
  return pendingMarket;
};
