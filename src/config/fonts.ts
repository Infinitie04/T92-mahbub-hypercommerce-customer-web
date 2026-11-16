import localFont from "next/font/local";

// The storefront sans. Exposed to Tailwind through the `--font-sans` variable,
// which _app.tsx defines from this family.
export const fontSans = localFont({
  src: "../assets/fonts/DMSans-VariableFont_opsz,wght.ttf",
  weight: "100 1000",
  display: "swap",
  fallback: [
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "Arial",
    "sans-serif",
  ],
});

// The display font for headings, titles etc.
export const fontDisplay = localFont({
  src: "../assets/fonts/SpaceGrotesk-VariableFont_wght.ttf",
  weight: "300 700",
  display: "swap",
  fallback: [
    "ui-sans-serif",
    "system-ui",
    "-apple-system",
    "Segoe UI",
    "Roboto",
    "Arial",
    "sans-serif",
  ],
});

export const fontMono = localFont({
  src: "../assets/fonts/Figtree-VariableFont_wght.ttf",
  weight: "300 900",
  style: "normal",
  variable: "--font-mono",
  display: "swap",
  preload: true,
  adjustFontFallback: "Arial",
  fallback: ["ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
});

