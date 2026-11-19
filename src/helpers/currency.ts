// Market-aware currency formatting.
//
// The backend already FX-converts every amount to the active market's currency
// and returns the per-market number-format rules (symbol, separators, decimals,
// symbol position). This util applies those rules to a numeric amount so the UI
// formats prices consistently for the selected market instead of a static
// symbol + toFixed(2).

import type { MarketFormat } from "@/types/ApiResponse";
export type { MarketFormat };

const DEFAULT_FORMAT: Required<MarketFormat> = {
  symbol_position: "before",
  space_between_symbol: false,
  thousand_separator: ",",
  grouping_style: "western",
  decimal_separator: ".",
  decimal_places: 2,
  negative_format: "-{n}",
};

/** Shown instead of a fabricated 0 when the amount is absent or unparseable. */
export const MISSING_AMOUNT = "—";

const groupThousands = (digits: string, separator: string, style: string): string => {
  if (!separator || digits.length <= 3) return digits;
  if (style === "indian") {
    const leading = digits.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, () => separator);
    return leading + separator + digits.slice(-3);
  }
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, () => separator);
};

/**
 * Format a numeric amount (already in the market currency) into a display
 * string using the market's number-format rules. Symbol is applied per
 * `symbol_position` / `space_between_symbol`. Negatives use `negative_format`.
 */
export const formatCurrency = (
  amount: number | string | null | undefined,
  symbol: string = "",
  format?: MarketFormat | null,
): string => {
  // A present-but-null field must not beat the default, so drop empties
  // before the spread rather than guarding each read.
  const supplied = Object.fromEntries(
    Object.entries(format || {}).filter(
      ([key, value]) => value != null && (value !== "" || key === "thousand_separator")
    )
  );
  const f = { ...DEFAULT_FORMAT, ...supplied };
  const num = Number(amount);

  // A missing or unparseable amount is not zero — rendering it as one turns a
  // failed fetch into a believable balance.
  if (!Number.isFinite(num)) return MISSING_AMOUNT;

  const safe = num;

  const negative = safe < 0;
  const abs = Math.abs(safe);

  const decimals =
    typeof f.decimal_places === "number" && f.decimal_places >= 0
      ? f.decimal_places
      : 2;

  const fixed = abs.toFixed(decimals);
  const [intPart, decPart] = fixed.split(".");

  const grouped = groupThousands(intPart, f.thousand_separator, f.grouping_style);
  let number =
    decimals > 0 && decPart !== undefined
      ? `${grouped}${f.decimal_separator}${decPart}`
      : grouped;

  const gap = f.space_between_symbol ? " " : "";
  let withSymbol = symbol
    ? f.symbol_position === "after"
      ? `${number}${gap}${symbol}`
      : `${symbol}${gap}${number}`
    : number;

  if (negative) {
    withSymbol = (f.negative_format || "-{n}").replace("{n}", withSymbol);
  }

  return withSymbol;
};
