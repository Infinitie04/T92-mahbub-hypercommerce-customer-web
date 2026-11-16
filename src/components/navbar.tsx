import React, {
  CSSProperties,
  FC,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button, Image, useDisclosure } from "@/components/ui";
import Link from "next/link";
import { Icon } from "@iconify/react";
import LocationSelector from "./Location/LocationSelector";
import GlobalSearchbar from "./Functional/GlobalSearchbar";
import dynamic from "next/dynamic";
import { useSelector } from "react-redux";
import { RootState } from "@/lib/redux/store";
import { useRouter } from "next/router";
import { parseQuotationId } from "@/helpers/quotationCheckout";
import { useSettings } from "@/contexts/SettingsContext";
import { siteConfig } from "@/config/site";
import { useTranslation } from "react-i18next";
import { authSheetStore } from "@/stores/authSheetStore";
import { Heart, ShoppingCart, User, Package } from "lucide-react";
import { getCookie, setCookie } from "@/lib/cookies";
import { onHomeCategoryChange } from "@/helpers/events";
import useSWR from "swr";
import { getHomeNavbar } from "@/services/home";
import { STALE_TIME } from "@/hooks/useInfiniteData";
import { resolveHeaderSettings } from "@/config/header";

type HeaderPaletteStyle = CSSProperties & {
  "--header-font-color": string;
  "--header-active-color": string;
  "--header-navigation-font-color": string;
  "--header-navigation-active-color": string;
};

const LanguageSwitcher = dynamic(
  () => import("./Functional/LanguageSwitcher"),
  { ssr: false },
);
const OfflineCartDrawer = dynamic(() => import("./Cart/OfflineCartDrawer"), {
  ssr: false,
});

const MOBILE_HEADER_HIDE_DISTANCE = 12;
const MOBILE_HEADER_REVEAL_DISTANCE = 10;
const MOBILE_HEADER_COLLAPSE_OFFSET = 56;
const MOBILE_HEADER_SCROLL_LOCK_MS = 500;
const MOBILE_SCROLL_INTENT_WINDOW_MS = 1200;
const desktopHeaderWidth = "mx-auto w-full max-w-site px-4";
const headerActionClass =
  "relative flex min-w-14 flex-col items-center gap-0.5 rounded-small px-1 py-1 text-compact font-medium leading-4 text-current transition-colors hover:text-primary focus-visible:outline-2 focus-visible:outline-primary";

const HeaderAction = ({
  icon,
  label,
  href,
  showLabel,
}: {
  icon: React.ReactNode;
  label: string;
  href: string;
  showLabel: boolean;
}) => (
  <Link
    href={href}
    title={label}
    aria-label={label}
    className={headerActionClass}
  >
    {icon}
    {showLabel ? <span>{label}</span> : null}
  </Link>
);

export const Navbar: FC = () => {
  const { t } = useTranslation();
  const [showDemoWarning, setShowDemoWarning] = useState(true);
  const [showHeaderAnnouncement, setShowHeaderAnnouncement] = useState(true);
  const [isHeaderScrolled, setIsHeaderScrolled] = useState(false);
  const [isMobileSurfaceWhite, setIsMobileSurfaceWhite] = useState(false);
  const [isDesktopViewport, setIsDesktopViewport] = useState(true);
  const [isMobileHeaderExpanded, setIsMobileHeaderExpanded] = useState(true);
  const isMobileHeaderExpandedRef = useRef(true);
  const mobileScrollAnchorY = useRef(0);
  const mobileTransitionLockUntil = useRef(0);
  const mobileScrollIntentAt = useRef(0);
  const mobileScrollIntentDirection = useRef<"up" | "down" | null>(null);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const isLoggedIn = useSelector((state: RootState) => state.auth.isLoggedIn);
  const {
    webSettings,
    demoMode,
    systemSettings,
    homeGeneralSettings,
    headerSettings,
  } = useSettings();
  const header = useMemo(
    () => resolveHeaderSettings(headerSettings),
    [headerSettings],
  );
  const router = useRouter();
  const isCategoryNavigationRoute =
    header.navigationSource !== "categories" &&
    (router.pathname === "/" || router.pathname.startsWith("/categories"));
  const cartCount =
    useSelector((state: RootState) => state.cart.cartData?.items_count) || 0;

  const offLineCartCount =
    useSelector((state: RootState) => state.offlineCart.items)?.length || 0;

  const bagCount = isLoggedIn ? cartCount : offLineCartCount;

  const { data: homeNavbarRes } = useSWR(
    header.enabled &&
      header.showCategoryNavigation &&
      isCategoryNavigationRoute &&
      header.navigationSource === "categories"
      ? "home-tab:web"
      : null,
    () => getHomeNavbar("web"),
    { revalidateOnFocus: false, dedupingInterval: STALE_TIME.reference },
  );
  const homeNavbarItems = homeNavbarRes?.data ?? [];
  const selectedNavbarSlug =
    typeof router.query.home === "string"
      ? router.query.home
      : mounted && typeof getCookie("homeNavbar") === "string"
        ? String(getCookie("homeNavbar"))
        : "";
  const legacyCategorySlug =
    typeof router.query.category === "string" ? router.query.category : "";
  const selectedNavbarItem = homeNavbarItems.find(
    (item) =>
      item.slug === selectedNavbarSlug ||
      (!selectedNavbarSlug && item.slug === legacyCategorySlug),
  );
  const globalDesktopAppearance = homeGeneralSettings?.homeAppearance?.desktop;
  const globalMobileAppearance = homeGeneralSettings?.homeAppearance?.app;
  const activeDesktopAppearance =
    selectedNavbarItem?.home_appearance?.desktop ??
    selectedNavbarItem?.appearance ??
    globalDesktopAppearance;
  const activeMobileAppearance =
    selectedNavbarItem?.home_appearance?.app ?? globalMobileAppearance;
  const activeSearchLabels = selectedNavbarItem?.search_labels?.length
    ? selectedNavbarItem.search_labels
    : homeGeneralSettings?.searchLabels;
  const usesHomeAppearance = Boolean(activeDesktopAppearance);
  const desktopBackgroundType = usesHomeAppearance
    ? activeDesktopAppearance?.background_type
    : header.backgroundType;
  const effectiveDesktopBackgroundImage = selectedNavbarItem
    ? activeDesktopAppearance?.desktop_background_image ||
      activeDesktopAppearance?.background_image ||
      null
    : usesHomeAppearance
      ? homeGeneralSettings?.desktopBackgroundImage ||
        globalDesktopAppearance?.background_image ||
        homeGeneralSettings?.backgroundImage ||
        null
      : header.backgroundImage;
  const effectiveTabletBackgroundImage = usesHomeAppearance
    ? activeDesktopAppearance?.tablet_background_image ||
      effectiveDesktopBackgroundImage
    : effectiveDesktopBackgroundImage;
  const effectiveMobileBackgroundImage = usesHomeAppearance
    ? activeDesktopAppearance?.mobile_background_image ||
      activeDesktopAppearance?.app_background_image ||
      effectiveTabletBackgroundImage ||
      effectiveDesktopBackgroundImage
    : (header.mobileBackgroundImage ?? header.backgroundImage);
  const mobileBackgroundType = usesHomeAppearance
    ? activeMobileAppearance?.background_type || desktopBackgroundType
    : header.backgroundType;
  const effectiveDesktopBackgroundType =
    desktopBackgroundType === "image" && !effectiveDesktopBackgroundImage
      ? "color"
      : desktopBackgroundType;
  const effectiveMobileBackgroundType =
    mobileBackgroundType === "image" && !effectiveMobileBackgroundImage
      ? "color"
      : mobileBackgroundType;
  const containerClass =
    header.containerWidth === "full"
      ? "max-w-none"
      : header.containerWidth === "wide"
        ? "max-w-screen-2xl"
        : "max-w-site";
  const surfaceToneClass =
    header.contentTone === "light"
      ? "bg-ink text-ink-foreground"
      : "bg-content1 text-foreground";
  const effectiveControlTone = usesHomeAppearance
    ? ("inherit" as const)
    : header.contentTone;
  const hasScrolledMobileSurface = isMobileSurfaceWhite && !isDesktopViewport;
  const activePaletteAppearance =
    activeMobileAppearance || activeDesktopAppearance;
  const headerFontColor =
    activePaletteAppearance?.font_color ||
    header.textColor ||
    header.navigationTextColor ||
    "currentColor";
  const headerActiveColor =
    activePaletteAppearance?.active_font_color ||
    header.navigationActiveColor ||
    headerFontColor;
  const navigationFontColor =
    activePaletteAppearance?.font_color ||
    header.navigationTextColor ||
    headerFontColor;
  const navigationActiveColor =
    activePaletteAppearance?.active_font_color ||
    header.navigationActiveColor ||
    headerActiveColor;
  const headerPaletteStyle: HeaderPaletteStyle = {
    "--header-font-color": headerFontColor,
    "--header-active-color": headerActiveColor,
    "--header-navigation-font-color": navigationFontColor,
    "--header-navigation-active-color": navigationActiveColor,
  };
  const gradientDirection = {
    "to-right": "to right",
    "to-left": "to left",
    "to-bottom": "to bottom",
    "to-bottom-right": "to bottom right",
  }[header.gradientDirection];
  const activeGradientAngle = Number(
    activeDesktopAppearance?.gradient_angle ?? 90,
  );
  const surfaceStyle: CSSProperties = usesHomeAppearance
    ? {
        ...(effectiveDesktopBackgroundType === "color" &&
        activeDesktopAppearance?.gradient_start
          ? { backgroundColor: activeDesktopAppearance.gradient_start }
          : {}),
        ...(effectiveDesktopBackgroundType === "gradient" &&
        activeDesktopAppearance?.gradient_start &&
        activeDesktopAppearance.gradient_end
          ? {
              backgroundImage: `linear-gradient(${Number.isFinite(activeGradientAngle) ? activeGradientAngle : 90}deg, ${activeDesktopAppearance.gradient_start}, ${activeDesktopAppearance.gradient_end})`,
            }
          : {}),
        ...(activePaletteAppearance?.font_color
          ? { color: activePaletteAppearance.font_color }
          : {}),
      }
    : {
        ...(header.backgroundType === "color" && header.backgroundColor
          ? { backgroundColor: header.backgroundColor }
          : {}),
        ...(header.backgroundType === "gradient" &&
        header.gradientFrom &&
        header.gradientTo
          ? {
              backgroundImage: `linear-gradient(${gradientDirection}, ${header.gradientFrom}, ${header.gradientTo})`,
            }
          : {}),
        ...(header.textColor ? { color: header.textColor } : {}),
      };
  const desktopBackgroundStyle: CSSProperties | undefined =
    effectiveDesktopBackgroundType === "image" &&
    effectiveDesktopBackgroundImage
      ? {
          backgroundImage: `url(${JSON.stringify(effectiveDesktopBackgroundImage)})`,
          backgroundPosition: header.backgroundPosition,
          backgroundSize:
            header.backgroundFit === "fill" ? "100% 100%" : "cover",
        }
      : undefined;
  const tabletBackgroundStyle: CSSProperties | undefined =
    effectiveDesktopBackgroundType === "image" &&
    effectiveTabletBackgroundImage
      ? {
          backgroundImage: `url(${JSON.stringify(effectiveTabletBackgroundImage)})`,
          backgroundPosition: header.backgroundPosition,
          backgroundSize:
            header.backgroundFit === "fill" ? "100% 100%" : "cover",
        }
      : undefined;
  const mobileBackgroundStyle: CSSProperties | undefined =
    effectiveMobileBackgroundType === "image" &&
    effectiveMobileBackgroundImage
      ? {
          backgroundImage: `url(${JSON.stringify(effectiveMobileBackgroundImage)})`,
          backgroundPosition: header.backgroundPosition,
          backgroundSize: "cover",
        }
      : undefined;
  const overlayStyle: CSSProperties = {
    ...(header.overlayColor ? { backgroundColor: header.overlayColor } : {}),
    opacity: header.overlayOpacity,
  };

  const {
    isOpen: isOfflineCartOpen,
    onOpen: openOfflineCart,
    onClose: closeOfflineCart,
  } = useDisclosure();

  useEffect(() => {
    if (webSettings?.headerScript) {
      const temp = document.createElement("div");
      temp.innerHTML = webSettings.headerScript;

      Array.from(temp.querySelectorAll("script")).forEach((oldScript) => {
        const newScript = document.createElement("script");
        if (oldScript.src) {
          newScript.src = oldScript.src;
        }
        if (oldScript.textContent) {
          newScript.textContent = oldScript.textContent;
        }
        document.head.appendChild(newScript);
      });
    }
  }, [webSettings?.headerScript]);

  useEffect(() => {
    if (isLoggedIn && isOfflineCartOpen) {
      closeOfflineCart();
    }
  }, [isLoggedIn, isOfflineCartOpen, closeOfflineCart]);

  useEffect(() => {
    const desktopMedia = window.matchMedia("(min-width: 1024px)");
    const updateViewport = () => {
      setIsDesktopViewport(desktopMedia.matches);
      if (desktopMedia.matches) {
        isMobileHeaderExpandedRef.current = true;
        setIsMobileHeaderExpanded(true);
      }
      mobileScrollAnchorY.current = Math.max(0, window.scrollY);
    };

    updateViewport();
    desktopMedia.addEventListener("change", updateViewport);
    return () => desktopMedia.removeEventListener("change", updateViewport);
  }, []);

  useEffect(() => {
    if (!header.sticky) {
      const resetFrame = window.requestAnimationFrame(() => {
        setIsHeaderScrolled(false);
        setIsMobileSurfaceWhite(false);
        isMobileHeaderExpandedRef.current = true;
        setIsMobileHeaderExpanded(true);
      });
      return () => window.cancelAnimationFrame(resetFrame);
    }

    mobileScrollAnchorY.current = Math.max(0, window.scrollY);
    let scrollFrame: number | null = null;
    let lastTouchY: number | null = null;

    const recordScrollIntent = (deltaY: number) => {
      if (Math.abs(deltaY) < 1) return;
      mobileScrollIntentAt.current = performance.now();
      mobileScrollIntentDirection.current = deltaY > 0 ? "down" : "up";
    };

    const handleWheel = (event: WheelEvent) => {
      recordScrollIntent(event.deltaY);
    };

    const handleTouchStart = (event: TouchEvent) => {
      lastTouchY = event.touches[0]?.clientY ?? null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const currentTouchY = event.touches[0]?.clientY;
      if (currentTouchY === undefined || lastTouchY === null) return;
      recordScrollIntent(lastTouchY - currentTouchY);
      lastTouchY = currentTouchY;
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (
        ["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(
          event.key,
        )
      ) {
        recordScrollIntent(
          ["ArrowUp", "PageUp", "Home"].includes(event.key) ? -1 : 1,
        );
      }
    };

    const setMobileHeaderExpanded = (nextExpanded: boolean) => {
      if (isMobileHeaderExpandedRef.current === nextExpanded) return;
      isMobileHeaderExpandedRef.current = nextExpanded;
      mobileTransitionLockUntil.current =
        performance.now() + MOBILE_HEADER_SCROLL_LOCK_MS;
      setIsMobileHeaderExpanded(nextExpanded);
    };

    const updateScrolledState = () => {
      scrollFrame = null;
      const currentScrollY = Math.max(0, window.scrollY);
      setIsHeaderScrolled((current) => {
        const openThreshold = Math.max(
          0,
          header.navigationScrollThreshold - 24,
        );
        return current
          ? currentScrollY > openThreshold
          : currentScrollY > header.navigationScrollThreshold;
      });

      const heroSection =
        router.pathname === "/"
          ? document.querySelector<HTMLElement>(
              "#home-builder > section:first-of-type",
            )
          : null;
      const stickyHeader = document.querySelector<HTMLElement>("header");
      const heroBounds = heroSection?.getBoundingClientRect();
      const mobileSurfaceThreshold = heroBounds
        ? Math.max(
            header.navigationScrollThreshold,
            currentScrollY +
              heroBounds.top +
              heroBounds.height -
              (stickyHeader?.getBoundingClientRect().height ?? 0),
          )
        : router.pathname === "/"
          ? Math.max(
              header.navigationScrollThreshold,
              window.innerHeight * 0.25,
            )
          : header.navigationScrollThreshold;
      setIsMobileSurfaceWhite((current) => {
        const closeThreshold = Math.max(0, mobileSurfaceThreshold - 24);
        return current
          ? currentScrollY > closeThreshold
          : currentScrollY > mobileSurfaceThreshold;
      });

      const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
      if (isDesktop) {
        setMobileHeaderExpanded(true);
        mobileScrollAnchorY.current = currentScrollY;
        return;
      }

      if (currentScrollY <= header.navigationScrollThreshold) {
        setMobileHeaderExpanded(true);
        mobileScrollAnchorY.current = currentScrollY;
        return;
      }

      if (
        isMobileHeaderExpandedRef.current &&
        currentScrollY <=
          header.navigationScrollThreshold + MOBILE_HEADER_COLLAPSE_OFFSET
      ) {
        mobileScrollAnchorY.current = currentScrollY;
        return;
      }

      if (performance.now() < mobileTransitionLockUntil.current) {
        mobileScrollAnchorY.current = currentScrollY;
        return;
      }

      if (
        performance.now() - mobileScrollIntentAt.current >
        MOBILE_SCROLL_INTENT_WINDOW_MS
      ) {
        mobileScrollAnchorY.current = currentScrollY;
        return;
      }

      if (isMobileHeaderExpandedRef.current) {
        if (mobileScrollIntentDirection.current !== "down") {
          mobileScrollAnchorY.current = currentScrollY;
          return;
        }
        if (currentScrollY < mobileScrollAnchorY.current) {
          mobileScrollAnchorY.current = currentScrollY;
        } else if (
          currentScrollY - mobileScrollAnchorY.current >=
          MOBILE_HEADER_HIDE_DISTANCE
        ) {
          setMobileHeaderExpanded(false);
          mobileScrollAnchorY.current = currentScrollY;
        }
      } else if (mobileScrollIntentDirection.current !== "up") {
        mobileScrollAnchorY.current = currentScrollY;
      } else if (currentScrollY > mobileScrollAnchorY.current) {
        mobileScrollAnchorY.current = currentScrollY;
      } else if (
        mobileScrollAnchorY.current - currentScrollY >=
        MOBILE_HEADER_REVEAL_DISTANCE
      ) {
        setMobileHeaderExpanded(true);
        mobileScrollAnchorY.current = currentScrollY;
      }
    };

    const requestScrollUpdate = () => {
      if (scrollFrame !== null) return;
      scrollFrame = window.requestAnimationFrame(updateScrolledState);
    };

    requestScrollUpdate();
    window.addEventListener("wheel", handleWheel, { passive: true });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchmove", handleTouchMove, { passive: true });
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("scroll", requestScrollUpdate, { passive: true });
    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchmove", handleTouchMove);
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("scroll", requestScrollUpdate);
      if (scrollFrame !== null) {
        window.cancelAnimationFrame(scrollFrame);
      }
    };
  }, [header.navigationScrollThreshold, header.sticky, router.pathname]);

  const openCart = (event: React.MouseEvent) => {
    event.preventDefault();
    if (isLoggedIn) {
      router.push("/cart");
    } else {
      openOfflineCart();
    }
  };

  const {
    siteHeaderLogo,
    siteHeaderDarkLogo,
    siteName = siteConfig.name,
  } = webSettings || {};
  const desktopLogo = header.logoUrl || siteHeaderLogo || siteConfig.logo;
  const mobileLogo =
    header.mobileLogoUrl ||
    header.logoUrl ||
    (header.contentTone === "light"
      ? siteHeaderDarkLogo || siteConfig.darkLogo
      : desktopLogo);
  const displayedMobileLogo = hasScrolledMobileSurface
    ? siteHeaderLogo ||
      (mobileLogo === siteConfig.darkLogo ? siteConfig.logo : mobileLogo)
    : mobileLogo;
  const logoHeightClass = "h-9 min-[1024px]:h-10";

  const SiteLogo = (
    <Link
      href="/"
      title={t("nav.home")}
      className="flex shrink-0 items-center"
      style={{ maxWidth: header.logoMaxWidth }}
      onClick={(event) => {
        event.preventDefault();
        router.push("/");
      }}
    >
      {displayedMobileLogo !== desktopLogo ? (
        <>
          <span className="min-[1024px]:hidden">
            <Image
              removeWrapper
              loading="eager"
              disableSkeleton
              disableAnimation
              src={displayedMobileLogo}
              alt={siteName}
              radius="none"
              className={`${logoHeightClass} w-auto max-w-full object-contain`}
            />
          </span>
          <span className="hidden min-[1024px]:block">
            <Image
              removeWrapper
              loading="eager"
              disableSkeleton
              disableAnimation
              src={desktopLogo}
              alt={siteName}
              radius="none"
              className={`${logoHeightClass} w-auto max-w-full object-contain`}
            />
          </span>
        </>
      ) : (
        <Image
          removeWrapper
          loading="eager"
          disableSkeleton
          disableAnimation
          src={desktopLogo}
          alt={siteName}
          radius="none"
          className={`${logoHeightClass} w-auto max-w-full object-contain`}
        />
      )}
    </Link>
  );

  const AccountAction =
    mounted && isLoggedIn ? (
      <HeaderAction
        href="/my-account"
        icon={<User className="size-5" />}
        label={t("nav.account", "Account")}
        showLabel={header.showActionLabels}
      />
    ) : (
      <button
        type="button"
        id="login-btn"
        aria-label={t("nav.account", "Account")}
        onClick={() => authSheetStore.open()}
        className={`${headerActionClass} cursor-pointer`}
      >
        <User className="size-5" />
        {header.showActionLabels ? (
          <span>{t("nav.account", "Account")}</span>
        ) : null}
      </button>
    );

  const showAccountLinks = mounted && isLoggedIn;

  const WishlistAction = showAccountLinks ? (
    <HeaderAction
      icon={<Heart className="size-5" />}
      label={t("nav.wishlist", "Wishlist")}
      href="/my-account/wishlists"
      showLabel={header.showActionLabels}
    />
  ) : null;

  const OrdersAction = showAccountLinks ? (
    <HeaderAction
      icon={<Package className="size-5" />}
      label={t("nav.orders", "Orders")}
      href="/my-account/orders"
      showLabel={header.showActionLabels}
    />
  ) : null;

  const CartAction = (
    <button
      type="button"
      onClick={openCart}
      aria-label={t("nav.cart", "Cart")}
      className={`${headerActionClass} cursor-pointer`}
    >
      <ShoppingCart className="size-5" />
      {header.showActionLabels ? (
        <span className="hidden min-[640px]:block">
          {t("nav.cart", "Cart")}
        </span>
      ) : null}
      {mounted && bagCount > 0 && (
        <span className="absolute -top-1 start-1/2 ms-1 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-xxs font-bold text-primary-foreground">
          {bagCount}
        </span>
      )}
    </button>
  );

  const headerTools =
    header.showLocation || header.showSearch ? (
      <div className="flex min-w-0 flex-1 items-center gap-5">
        {header.showLocation ? (
          <LocationSelector
            variant="showcase"
            tone="inherit"
            showLabel={header.showLocationLabel}
          />
        ) : null}
        {header.showSearch ? (
          <GlobalSearchbar
            tone="storefront"
            shape="rounded"
          />
        ) : null}
      </div>
    ) : null;

  const mobileSearch = header.showSearch ? (
    <div className="w-full min-w-0">
      <GlobalSearchbar
        tone={
          usesHomeAppearance
            ? "inherit"
            : hasScrolledMobileSurface
              ? "dark"
              : effectiveControlTone
        }
        size="default"
        shape="rounded"
        searchLabels={activeSearchLabels}
      />
    </div>
  ) : null;

  const headerActions = (
    <nav className="flex shrink-0 items-center gap-2">
      {header.actionItems.map((item) => (
        <Link
          key={item.id}
          href={item.url}
          target={item.openInNewTab ? "_blank" : undefined}
          rel={item.openInNewTab ? "noreferrer" : undefined}
          className={`hidden min-w-24 items-center justify-center gap-1.5 rounded-small border px-4 py-2 text-xs font-bold min-[1024px]:inline-flex ${
            item.style === "solid"
              ? "border-primary bg-primary text-primary-foreground"
              : item.style === "soft"
                ? "border-transparent bg-content2 text-foreground"
                : "border-divider bg-content1/80 text-foreground"
          }`}
        >
          {item.icon ? <Icon icon={item.icon} className="text-base" /> : null}
          {item.label}
        </Link>
      ))}
      {header.showWishlist ? WishlistAction : null}
      {header.showOrders ? OrdersAction : null}
      {header.showAccount ? AccountAction : null}
      {header.showCart ? CartAction : null}
    </nav>
  );

  const announcementContent = header.announcementText ? (
    <span className="text-center text-xs font-semibold sm:text-sm">
      {header.announcementText}
    </span>
  ) : null;

  const renderSurfaceBackground = () => {
    if (
      !desktopBackgroundStyle &&
      !tabletBackgroundStyle &&
      !mobileBackgroundStyle
    ) {
      return null;
    }

    return (
      <>
        {desktopBackgroundStyle ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 hidden min-[1024px]:block"
            style={desktopBackgroundStyle}
          />
        ) : null}
        {tabletBackgroundStyle ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 hidden min-[640px]:block min-[1024px]:hidden"
            style={tabletBackgroundStyle}
          />
        ) : null}
        {mobileBackgroundStyle ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 min-[640px]:hidden"
            style={mobileBackgroundStyle}
          />
        ) : null}
        <div
          aria-hidden="true"
          className={`absolute inset-0 ${header.overlayColor ? "" : "bg-ink"}`}
          style={overlayStyle}
        />
      </>
    );
  };

  const socialLinks = [
    {
      label: "Facebook",
      url: webSettings?.facebookLink,
      icon: "logos:facebook",
    },
    {
      label: "Instagram",
      url: webSettings?.instagramLink,
      icon: "skill-icons:instagram",
    },
    {
      label: "YouTube",
      url: webSettings?.youtubeLink,
      icon: "logos:youtube-icon",
    },
    { label: "X", url: webSettings?.xLink, icon: "ri:twitter-x-fill" },
  ].filter(
    (item): item is { label: string; url: string; icon: string } =>
      typeof item.url === "string" && item.url.trim().length > 0,
  );

  const utilityText = header.utilityText?.trim();
  const supportNumber = webSettings?.supportNumber?.trim();
  const showSocialLinks = header.showSocialLinks && socialLinks.length > 0;
  const showSupportPhone = header.showSupportPhone && Boolean(supportNumber);
  const showLeftUtility = showSupportPhone || header.showLanguage;
  const showRightUtility = Boolean(utilityText) || showSocialLinks;
  const showUtilityContent =
    header.showUtilityBar && (showLeftUtility || showRightUtility);

  const utilityIsHidden =
    header.sticky && isHeaderScrolled && header.hideUtilityOnScroll;
  const utilityBar = showUtilityContent ? (
    <div
      aria-hidden={utilityIsHidden}
      inert={utilityIsHidden ? true : undefined}
      className={`relative z-10 hidden overflow-hidden bg-primary text-primary-foreground transition-[max-height,opacity,transform] duration-700 ease-in-out motion-reduce:transition-none min-[1024px]:block ${
        utilityIsHidden
          ? "pointer-events-none max-h-0 -translate-y-full opacity-0"
          : "max-h-8 translate-y-0 opacity-100"
      }`}
    >
      <div
        className={`${desktopHeaderWidth} flex h-8 items-center justify-between gap-4 text-xs font-semibold`}
      >
        <div className="flex min-w-0 items-center gap-3">
          {showSupportPhone ? (
            <a
              href={`tel:${supportNumber}`}
              className="inline-flex h-8 items-center gap-2 rounded-small hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-current"
            >
              <Icon icon="solar:phone-calling-linear" className="size-4" />
              {supportNumber}
            </a>
          ) : null}
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2.5">
          {showRightUtility ? (
            <span className="truncate text-xs font-semibold opacity-90">
              {utilityText || t("nav.followUs", "Follow us")}
            </span>
          ) : null}
          {showSocialLinks
            ? socialLinks.map((item) => (
                <Link
                  key={item.label}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={item.label}
                  className="inline-flex h-7 w-7 items-center justify-center rounded-small transition-colors hover:bg-content1/30 hover:text-(--header-active-color) focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus"
                >
                  <Icon icon={item.icon} className="h-4 w-4" />
                </Link>
              ))
            : null}
          {header.showLanguage ? <LanguageSwitcher /> : null}
        </div>
      </div>
    </div>
  ) : null;

  const showNavigation =
    header.showCategoryNavigation && isCategoryNavigationRoute;
  const navigationIsCompact =
    isDesktopViewport &&
    header.sticky &&
    isHeaderScrolled &&
    header.navigationScrollBehavior !== "hide";
  const navigationIsHidden =
    isDesktopViewport &&
    header.sticky &&
    isHeaderScrolled &&
    header.navigationScrollBehavior === "hide";
  const navigationUsesIcons = header.navigationStyle === "icons";
  const navigationStyle = navigationIsCompact
    ? "links"
    : header.navigationStyle;
  const navigationItemClass = (isActive: boolean) =>
    `shrink-0 cursor-pointer whitespace-nowrap text-xs font-semibold transition-all duration-500 ease-in-out motion-reduce:transition-none min-[640px]:text-sm ${
      navigationUsesIcons
        ? `relative flex flex-col items-center ${
            navigationIsCompact
              ? "min-w-16 gap-0 px-2 py-1.5 min-[640px]:min-w-20 min-[640px]:px-3"
              : "min-w-16 gap-0.5 px-2 pb-0.5 min-[640px]:min-w-20 min-[640px]:px-3"
          } ${
            isActive
              ? "font-bold text-(--header-navigation-active-color)"
              : "text-(--header-navigation-font-color) opacity-85 hover:text-(--header-navigation-active-color) hover:opacity-100"
          }`
        : `relative px-4 py-1.5 ${navigationStyle === "pills" ? "rounded-full" : ""} ${
            isActive
              ? navigationStyle === "pills"
                ? "bg-primary font-bold text-(--header-navigation-active-color)"
                : "font-bold text-(--header-navigation-active-color)"
              : "text-(--header-navigation-font-color) opacity-70 hover:text-(--header-navigation-active-color) hover:opacity-100"
          }`
    }`;
  const navigationIndicator = (isActive: boolean) =>
    isActive && navigationStyle !== "pills" ? (
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute inset-x-0 h-0.75 rounded-full bg-(--header-navigation-active-color) ${
          navigationIsCompact ? "-bottom-1.5" : "-bottom-0.5"
        }`}
      />
    ) : null;
  const navigationIconClass = `flex w-8 shrink-0 items-center justify-center overflow-hidden transition-[height,opacity,transform] duration-500 ease-in-out motion-reduce:transition-none ${
    navigationIsCompact
      ? "h-0 -translate-y-6 opacity-0"
      : "h-8 translate-y-0 opacity-100"
  }`;
  const navigationBar = showNavigation ? (
    <div
      aria-hidden={navigationIsHidden}
      inert={navigationIsHidden ? true : undefined}
      className={`relative z-10 overflow-hidden transition-[max-height,opacity,transform] duration-500 ease-in-out motion-reduce:transition-none ${
        navigationIsHidden
          ? "pointer-events-none max-h-0 -translate-y-full opacity-0"
          : navigationIsCompact
            ? "max-h-12 translate-y-0 opacity-100"
            : "max-h-24 translate-y-0 opacity-100"
      } ${
        header.layout === "showcase" || usesHomeAppearance
          ? "bg-transparent"
          : "bg-content1/90 backdrop-blur-md"
      }`}
      style={{
        ...headerPaletteStyle,
        ...(!hasScrolledMobileSurface &&
        !usesHomeAppearance &&
        header.navigationBackgroundColor
          ? { backgroundColor: header.navigationBackgroundColor }
          : {}),
        ...(!hasScrolledMobileSurface && activePaletteAppearance?.font_color
          ? {
              color: activePaletteAppearance.font_color,
            }
          : !hasScrolledMobileSurface && header.navigationTextColor
            ? { color: header.navigationTextColor }
            : {}),
      }}
    >
      <div
        className={`mx-auto flex items-center overflow-x-auto px-4 transition-transform duration-500 ease-in-out motion-reduce:transition-none no-scrollbar ${
          navigationUsesIcons
            ? "gap-3 pb-0 pt-3.75"
            : navigationIsCompact
              ? "gap-2 py-1"
              : "gap-2 py-2"
        } ${containerClass}`}
      >
        {header.navigationSource === "categories"
          ? homeNavbarItems.map((item) => {
              const isAll = item.is_default === true || !item.slug;
              const isActive = isAll
                ? (!selectedNavbarSlug || selectedNavbarSlug === "all") &&
                  !legacyCategorySlug
                : item.id === selectedNavbarItem?.id;
              const desktopDefaultItemImage =
                item.desktop_icon || item.appearance.icon || null;
              const desktopItemImage =
                (isActive
                  ? item.desktop_active_icon || item.appearance.active_icon
                  : desktopDefaultItemImage) || null;
              const mobileItemImage =
                (isActive
                  ? isAll
                    ? homeGeneralSettings?.activeIcon
                    : item.active_icon || item.home_appearance?.app.active_icon
                  : isAll
                    ? homeGeneralSettings?.icon
                    : item.icon || item.home_appearance?.app.icon) ||
                desktopDefaultItemImage ||
                desktopItemImage;
              return (
                <button
                  key={item.id ?? "all"}
                  type="button"
                  aria-current={isActive ? "page" : undefined}
                  onClick={async () => {
                    const slug = item.slug || "all";
                    setCookie("homeNavbar", slug);
                    setCookie("homeCategory", "all");
                    if (router.pathname === "/") {
                      await router.push(
                        {
                          pathname: "/",
                          query: isAll ? {} : { home: slug },
                        },
                        undefined,
                        { shallow: true },
                      );
                      onHomeCategoryChange();
                    } else {
                      router.push(isAll ? "/" : `/?home=${slug}`);
                    }
                  }}
                  className={navigationItemClass(isActive)}
                >
                  {navigationUsesIcons ? (
                    <span className={navigationIconClass} aria-hidden="true">
                      {mobileItemImage || desktopItemImage ? (
                        <picture className="block size-8">
                          {desktopItemImage ? (
                            <source
                              media="(min-width: 1024px)"
                              srcSet={desktopItemImage}
                            />
                          ) : null}
                          <img
                            src={mobileItemImage || desktopItemImage || ""}
                            alt=""
                            loading="eager"
                            className="size-8 object-contain"
                          />
                        </picture>
                      ) : (
                        <Icon icon="solar:widget-2-linear" className="size-8" />
                      )}
                    </span>
                  ) : null}
                  <span className="relative">
                    {item.title}
                    {navigationIndicator(isActive)}
                  </span>
                </button>
              );
            })
          : header.navigationItems.map((item) => {
              const isActive = router.asPath === item.url;
              return (
                <Link
                  key={item.id}
                  href={item.url}
                  target={item.openInNewTab ? "_blank" : undefined}
                  rel={item.openInNewTab ? "noreferrer" : undefined}
                  aria-current={isActive ? "page" : undefined}
                  className={navigationItemClass(isActive)}
                >
                  {navigationUsesIcons ? (
                    <span className={navigationIconClass} aria-hidden="true">
                      {item.imageUrl ? (
                        <Image
                          removeWrapper
                          disableAnimation
                          src={item.imageUrl}
                          alt=""
                          radius="none"
                          className="size-8 object-contain"
                        />
                      ) : (
                        <Icon
                          icon={item.icon ?? "solar:link-circle-linear"}
                          className="size-8"
                        />
                      )}
                    </span>
                  ) : null}
                  <span className="relative">
                    {item.label}
                    {navigationIndicator(isActive)}
                  </span>
                </Link>
              );
            })}
      </div>
    </div>
  ) : null;

  const mobileTopRow = (
    <div
      aria-hidden={!isMobileHeaderExpanded}
      inert={!isMobileHeaderExpanded ? true : undefined}
      className={`relative z-10 overflow-hidden transition-[max-height,opacity,transform] duration-300 ease-out motion-reduce:transition-none min-[1024px]:hidden ${
        isMobileHeaderExpanded
          ? "max-h-16 translate-y-0 opacity-100"
          : "pointer-events-none max-h-0 -translate-y-3 opacity-0"
      } ${usesHomeAppearance ? "text-(--header-font-color)" : hasScrolledMobileSurface ? "text-foreground" : "text-current"}`}
    >
      <div className={`mx-auto px-3 pt-1.5 ${containerClass}`}>
        <div className="flex min-h-11 min-w-0 items-center gap-2">
          <div className="max-w-28 shrink-0">{SiteLogo}</div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
            {header.showLocation ? (
              <div className="min-w-0 flex-1">
                <LocationSelector
                  variant="mobile"
                  tone={
                    usesHomeAppearance
                      ? "inherit"
                      : hasScrolledMobileSurface
                        ? "dark"
                        : effectiveControlTone
                  }
                />
              </div>
            ) : null}
            {header.showLanguage ? <LanguageSwitcher variant="mobile" /> : null}
            {header.showNotifications && showAccountLinks ? (
              <button
                type="button"
                aria-label={t("profileBtn.notifications")}
                onClick={() => {
                  router.push("/my-account/notifications");
                }}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-current transition-colors hover:bg-content2/70 hover:text-(--header-active-color)"
              >
                <Icon icon="solar:bell-bing-linear" className="text-lg" />
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );

  const mobileSearchRow = mobileSearch ? (
    <div
      className={`relative z-10 mx-auto px-3 pb-2 transition-all duration-300 ease-out motion-reduce:transition-none min-[1024px]:hidden ${
        isMobileHeaderExpanded ? "pt-1" : "pt-2.5"
      } ${containerClass}`}
    >
      {mobileSearch}
    </div>
  ) : null;

  const isCheckoutOrPayment =
    router.pathname === "/cart/checkout" ||
    router.pathname.startsWith("/payment");

  if (isCheckoutOrPayment) {
    const isPaymentPage = router.pathname.startsWith("/payment");
    const quotationId = parseQuotationId(router.query.quotation);
    let backHref = "/cart";
    let backText = t("nav.backToCart", "Back to Cart");
    if (quotationId) {
      backHref = `/my-account/quotations/${quotationId}`;
      backText = t("quotation.number", { id: quotationId });
    } else if (isPaymentPage) {
      backHref = "/cart/checkout";
      backText = t("nav.backToCheckout", "Back to Checkout");
    }
    const titleText = isPaymentPage
      ? t("nav.securePayment", "Secure Payment")
      : t("nav.secureCheckout", "Secure Checkout");

    return (
      <header className="sticky top-0 z-50 w-full bg-ink text-ink-foreground border-b border-zinc-800">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:py-4">
          {/* Logo on the left */}
          <div className="flex items-center">{SiteLogo}</div>

          {/* Secure label in the center */}
          <div className="flex items-center gap-1.5 text-zinc-300">
            <Icon
              icon="solar:shield-keyhole-bold-duotone"
              className="text-emerald-400 text-lg sm:text-xl shrink-0"
            />
            <span className="font-display text-sm sm:text-base font-bold tracking-tight text-white leading-none">
              {titleText}
            </span>
          </div>

          {/* Back Action on the right */}
          <Link
            href={backHref}
            className="group inline-flex items-center gap-1 text-xs sm:text-sm font-bold text-zinc-400 hover:text-white transition-colors cursor-pointer"
          >
            <Icon
              icon="solar:alt-arrow-left-linear"
              className="text-sm transition-transform group-hover:-translate-x-0.5 rtl:rotate-180"
            />
            {backText}
          </Link>
        </div>
      </header>
    );
  }

  if (!header.enabled) {
    return (
      <OfflineCartDrawer
        isOpen={isOfflineCartOpen}
        onClose={closeOfflineCart}
      />
    );
  }

  return (
    <>
      {demoMode && showDemoWarning && (
        <div className="w-full relative flex items-center justify-center gap-2 border-b border-amber-200/70 bg-amber-50 px-10 py-2 text-amber-800">
          <Icon
            icon="solar:info-circle-bold"
            className="shrink-0 text-base text-amber-500"
          />
          <span className="text-center text-xs font-medium leading-snug sm:text-[13px]">
            {systemSettings?.customerDemoModeMessage
              ? systemSettings.customerDemoModeMessage
              : "Currently running in Demo Mode"}
          </span>
          <Button
            onPress={() => setShowDemoWarning(false)}
            aria-label="Close demo mode warning"
            isIconOnly
            size="sm"
            radius="full"
            variant="light"
            className="absolute right-2 top-1/2 h-6 w-6 min-w-6 -translate-y-1/2 text-amber-700"
          >
            <Icon icon="solar:close-circle-linear" className="text-base" />
          </Button>
        </div>
      )}

      {header.announcementEnabled &&
      announcementContent &&
      showHeaderAnnouncement ? (
        <div
          className="relative flex w-full items-center justify-center gap-2 bg-primary px-10 py-2 text-primary-foreground"
          style={{
            ...(header.announcementBackgroundColor
              ? { backgroundColor: header.announcementBackgroundColor }
              : {}),
            ...(header.announcementTextColor
              ? { color: header.announcementTextColor }
              : {}),
          }}
        >
          {header.announcementUrl ? (
            <Link
              href={header.announcementUrl}
              target={
                header.announcementUrl.startsWith("http") ? "_blank" : undefined
              }
              rel={
                header.announcementUrl.startsWith("http")
                  ? "noreferrer"
                  : undefined
              }
            >
              {announcementContent}
            </Link>
          ) : (
            announcementContent
          )}
          {header.announcementDismissible ? (
            <Button
              isIconOnly
              aria-label={t("close")}
              className="absolute end-2 top-1/2 h-6 w-6 min-w-6 -translate-y-1/2 text-current"
              radius="full"
              size="sm"
              variant="light"
              onPress={() => setShowHeaderAnnouncement(false)}
            >
              <Icon icon="solar:close-circle-linear" className="text-base" />
            </Button>
          ) : null}
        </div>
      ) : null}

      <header
        className={`${header.sticky ? "sticky" : "relative"} top-0 z-40 w-full border-b border-header-divider shadow-[0_2px_5px_rgb(0_0_0_/_0.12)]`}
      >
        <div
          className={`relative isolate overflow-hidden border-0 ${surfaceToneClass}`}
          style={{ ...surfaceStyle, ...headerPaletteStyle }}
        >
          {renderSurfaceBackground()}
          <div
            aria-hidden="true"
            className={`pointer-events-none absolute inset-0 z-0 bg-content1 transition-opacity duration-300 motion-reduce:transition-none min-[1024px]:hidden ${
              hasScrolledMobileSurface ? "opacity-100" : "opacity-0"
            }`}
          />
          {utilityBar}
          {mobileTopRow}
          {mobileSearchRow}
          <div className="relative z-10 hidden bg-content1 text-ink min-[1024px]:block">
            <div
              className={`${desktopHeaderWidth} grid min-h-16 grid-cols-[auto_1fr_auto] items-center gap-5`}
            >
              <div className="flex items-center gap-4">
                {SiteLogo}
                {header.showLocation ? (
                  <span aria-hidden="true" className="h-6 w-px bg-header-divider" />
                ) : null}
              </div>
              {headerTools ?? <span />}
              {headerActions}
            </div>
          </div>
          {navigationBar}
        </div>
      </header>

      <OfflineCartDrawer
        isOpen={isOfflineCartOpen}
        onClose={closeOfflineCart}
      />
    </>
  );
};
