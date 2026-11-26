export type SiteConfig = typeof siteConfig;

export const siteConfig = {
  name: "T92 Fashion",
  description:
    "Browse wholesale garments and request a quote from T92 Fashion.",
  metaKeywords:
    "T92 Fashion, wholesale garments, bulk apparel, clothing supplier",
  metaDescription:
    "Shop wholesale garments from T92 Fashion. Browse the catalog, view bulk pricing, and request a quotation.",
  logo: "/default-logo.png",
  darkLogo: "/default-dark-logo.png",
  favicon: "/default-favicon.ico?v=t92-white",
  appleTouchIcon: "/logo-192.png?v=t92-white",
  navItems: [
    {
      label: "Home",
      href: "/",
    },
    {
      label: "Categories",
      href: "/categories",
    },

    {
      label: "Blogs",
      href: "/blogs",
    },
    {
      label: "About",
      href: "/about",
    },
  ],
  navMenuItems: [
    {
      label: "Profile",
      href: "/my-account",
    },
    {
      label: "Dashboard",
      href: "/",
    },

    {
      label: "Logout",
      href: "/logout",
    },
  ],
  links: {
    github: "https://github.com/heroui-inc/heroui",
    twitter: "https://twitter.com/hero_ui",
    docs: "https://heroui.com",
    discord: "https://discord.gg/9b6yyZKmH4",
    sponsor: "https://patreon.com/jrgarciadev",
  },
};
