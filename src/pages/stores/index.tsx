import MarketplaceRedirect, {
  redirectMarketplacePage,
} from "@/components/Functional/MarketplaceRedirect";

export default MarketplaceRedirect;
export const getServerSideProps = redirectMarketplacePage;
