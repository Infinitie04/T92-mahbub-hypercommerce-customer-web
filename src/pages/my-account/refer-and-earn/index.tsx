import { redirectHiddenFeature } from "@/components/Functional/HiddenFeatureRedirect";

const redirect = redirectHiddenFeature("/my-account/");

export const getServerSideProps = redirect.getServerSideProps;
export default redirect.Page;
