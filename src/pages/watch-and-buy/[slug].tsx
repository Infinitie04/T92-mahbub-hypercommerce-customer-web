import { redirectHiddenFeature } from "@/components/Functional/HiddenFeatureRedirect";

const redirect = redirectHiddenFeature("/");

export const getServerSideProps = redirect.getServerSideProps;
export default redirect.Page;
