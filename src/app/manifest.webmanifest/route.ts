import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import type { WebSettings } from "@/types/settings";

export const dynamic = "force-static";
export const revalidate = 60;

type PwaSettings = Pick<
  WebSettings,
  | "pwaName"
  | "pwaDescription"
  | "pwaLogo144x144"
  | "pwaLogo192x192"
  | "pwaLogo512x512"
>;

async function fetchPwaSettings(): Promise<Partial<PwaSettings>> {
  const panelUrl = process.env.NEXT_PUBLIC_ADMIN_PANEL_URL?.replace(/\/+$/, "");
  if (!panelUrl) return {};

  try {
    const response = await fetch(`${panelUrl}/api/settings/web`, {
      headers: { Accept: "application/json" },
      next: { revalidate },
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return {};

    const result = await response.json();
    return result.success ? (result.data?.value ?? {}) : {};
  } catch {
    return {};
  }
}

function manifestIcon(url: string | undefined, size: 144 | 192 | 512) {
  const sizes = `${size}x${size}`;
  if (url && /^https?:\/\//i.test(url)) return { src: url, sizes };
  return { src: `/logo-${size}.png?v=t92-white`, sizes, type: "image/png" };
}

export async function GET() {
  const settings = await fetchPwaSettings();
  const name = settings.pwaName?.trim() || siteConfig.name;
  const manifest: MetadataRoute.Manifest = {
    id: "/",
    name,
    short_name: name,
    description: settings.pwaDescription?.trim() || siteConfig.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#000000",
    orientation: "portrait",
    icons: [
      manifestIcon(settings.pwaLogo144x144, 144),
      manifestIcon(settings.pwaLogo192x192, 192),
      manifestIcon(settings.pwaLogo512x512, 512),
    ],
  };

  return Response.json(manifest, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
