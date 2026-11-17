import { FC, useEffect, useState } from "react";
import { useRouter } from "next/router";
import { useTranslation } from "react-i18next";
import { useDispatch } from "react-redux";
import { Button, Spinner, toast } from "@/components/ui";
import { Icon } from "@iconify/react";
import { setIdempotencyKey } from "@/lib/redux/slices/checkoutSlice";
import { useSettings } from "@/contexts/SettingsContext";
import RazorPay from "@/components/PaymentGateway/RazorPay";
import Stripe from "@/components/PaymentGateway/Stripe";
import PayStack from "@/components/PaymentGateway/Paystack";
import FlutterwavePayment from "@/components/PaymentGateway/FlutterwavePayment";
import XenditPayment from "@/components/PaymentGateway/XenditPayment";
import MercadoPagoPayment from "@/components/PaymentGateway/MercadoPagoPayment";
import { getSpecificOrders, verifyRazorpayOrderPayment } from "@/services/orders";
import { Order } from "@/types/order";

type Phase = "loading" | "checking" | "pay" | "waiting" | "success" | "failed";

const OrderPaymentView: FC = () => {
  const router = useRouter();
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { formatPrice } = useSettings();
  const slug = typeof router.query.slug === "string" ? router.query.slug : "";
  const returnedFromXendit = router.query.xendit_return === "1";
  const returnedFromMercadoPago = router.query.mercado_pago_return === "1";
  const returnedFromHostedGateway =
    returnedFromXendit || returnedFromMercadoPago;

  const [order, setOrder] = useState<Order | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [isLoading, setIsLoading] = useState(false);
  const [startedSlug, setStartedSlug] = useState("");
  const isRazorpay = order?.payment_method === "razorpayPayment";
  const paymentStarted = order?.payment_started || startedSlug === slug;
  const quotationId = order?.quotation_id;

  // Load the order and gate on its state.
  useEffect(() => {
    if (!slug) return;
    let active = true;
    (async () => {
      const res = await getSpecificOrders({ slug });
      if (!active) return;
      const o = res?.data;
      if (!res?.success || !o) {
        toast({
          title: res?.message || t("checkout.failed.title"),
          color: "danger",
        });
        router.replace("/my-account/orders");
        return;
      }
      if (o.payment_status === "completed") {
        if (!o.quotation_id) dispatch(setIdempotencyKey(""));
        router.replace(`/my-account/orders/${slug}`);
        return;
      }
      setOrder(o);
      if (o.payment_status === "failed" || o.status === "cancelled") {
        setPhase("failed");
      } else if (o.quotation_id && o.payment_method === "razorpayPayment") {
        setPhase("checking");
      } else {
        setPhase(returnedFromHostedGateway ? "waiting" : "pay");
      }
    })();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, returnedFromHostedGateway]);

  const onError = () => setPhase(quotationId && isRazorpay ? "checking" : "failed");
  const onSuccess = () => setPhase("waiting");

  useEffect(() => {
    if ((phase !== "waiting" && phase !== "checking") || !slug) return;
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    let verifyAt = isRazorpay ? started + (phase === "checking" ? 0 : 5000) : Infinity;

    const poll = async () => {
      if (!active) return;
      const shouldVerify = Date.now() >= verifyAt;
      if (shouldVerify) verifyAt = Date.now() + 10000;

      const verification = shouldVerify
        ? await verifyRazorpayOrderPayment(slug).catch(() => null)
        : null;
      const result = shouldVerify ? verification : (await getSpecificOrders({ slug }))?.data;

      if (!active) return;
      if (result?.payment_status === "completed") {
        setPhase("success");
        return;
      }
      if (result?.payment_status === "failed" || result?.status === "cancelled") {
        setPhase("failed");
        return;
      }
      if (phase === "checking" && verification?.can_pay) {
        setPhase("pay");
        return;
      }
      if (Date.now() - started >= 90000) {
        toast({
          title: t("checkout.paymentPending", {
            defaultValue: "We'll notify you once your payment is confirmed.",
          }),
          color: "warning",
        });
        void router.push(quotationId ? `/my-account/quotations/${quotationId}` : "/my-account/orders");
        return;
      }
      timer = setTimeout(poll, Math.min(3000, Math.max(0, verifyAt - Date.now())));
    };

    timer = setTimeout(poll, phase === "checking" ? 0 : 2000);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [phase, slug, isRazorpay, quotationId, router, t]);

  // Success → order detail.
  useEffect(() => {
    if (phase !== "success") return;
    if (!order?.quotation_id) dispatch(setIdempotencyKey(""));
    toast({
      title: t("checkout.paymentConfirmed", { defaultValue: "Payment confirmed" }),
      color: "success",
    });
    const timer = setTimeout(
      () => router.push(`/my-account/orders/${slug}`),
      1400,
    );
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, slug]);

  const cancel = () => router.push(order?.quotation_id ? `/my-account/quotations/${order.quotation_id}` : "/cart/checkout");

  // ---------- Loading ----------
  if (phase === "loading" || !order || order.slug !== slug) {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <Spinner size="lg" color="primary" />
        <p className="text-sm text-foreground/60">
          {t("checkout.loadingOrder", { defaultValue: "Loading your order…" })}
        </p>
      </div>
    );
  }

  // ---------- Waiting screen ----------
  if (phase === "waiting" || phase === "checking") {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-4">
        <div className="w-full rounded-large border border-divider bg-content1 p-8 text-center">
          <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center">
            <span className="absolute inset-0 animate-ping rounded-full bg-primary-100 opacity-60" />
            <span className="relative flex h-20 w-20 items-center justify-center rounded-full bg-primary-50">
              <Spinner size="lg" color="primary" />
            </span>
          </div>

          <h1 className="text-lg font-bold text-foreground">
            {t("checkout.confirmingPaymentTitle", {
              defaultValue: "Confirming your payment",
            })}
          </h1>

          <div className="mt-2 flex items-center justify-center gap-1">
            <span className="text-sm text-foreground/60">
              {t("checkout.confirmingPayment", {
                defaultValue: "This usually takes a few seconds",
              })}
            </span>
            <span className="flex gap-0.5">
              <span className="h-1 w-1 animate-bounce rounded-full bg-foreground/40" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-foreground/40 [animation-delay:150ms]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-foreground/40 [animation-delay:300ms]" />
            </span>
          </div>

          <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-content2 px-4 py-2 text-sm">
            <span className="text-foreground/60">
              {t("checkout.amountToPay", { defaultValue: "Amount" })}
            </span>
            <span className="font-semibold text-foreground">
              {formatPrice(order.total_payable)}
            </span>
          </div>

          <div className="mt-6 flex items-center justify-center gap-1.5 rounded-xl bg-warning-50 px-3 py-2 text-xs text-warning-700">
            <Icon icon="solar:info-circle-linear" className="shrink-0 text-sm" />
            {t("checkout.doNotClose", {
              defaultValue: "Please don't close or refresh this page.",
            })}
          </div>
        </div>
      </div>
    );
  }

  // ---------- Success ----------
  if (phase === "success") {
    return (
      <div className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col items-center justify-center px-4">
        <div className="w-full rounded-large border border-divider bg-content1 p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-50">
            <Icon icon="solar:check-circle-bold" className="text-4xl text-success" />
          </div>
          <h1 className="text-lg font-bold text-foreground">
            {t("checkout.paymentSuccessTitle", {
              defaultValue: "Payment successful!",
            })}
          </h1>
          <p className="mt-2 text-sm text-foreground/60">
            {t("checkout.redirectingOrder", {
              defaultValue: "Redirecting you to your order…",
            })}
          </p>
          <div className="mt-5 inline-flex items-center gap-2">
            <Spinner size="sm" color="primary" />
            <span className="text-xs text-foreground/50">
              {t("please_wait", { defaultValue: "Please wait" })}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // ---------- Pay (also the failed retry surface) ----------
  const gatewayProps = {
    onSuccess,
    onError,
    isLoading,
    setIsLoading,
    usageType: "order" as const,
    orderSlug: slug,
  };

  const gateway = (() => {
    switch (order.payment_method) {
      case "razorpayPayment":
        return <RazorPay {...gatewayProps} quotationId={order.quotation_id} onStarted={() => setStartedSlug(slug)} />;
      case "stripePayment":
        return <Stripe {...gatewayProps} />;
      case "paystackPayment":
        return <PayStack {...gatewayProps} />;
      case "flutterwavePayment":
        return (
          <FlutterwavePayment
            onSuccess={onSuccess}
            onError={onError}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            orderSlug={slug}
          />
        );
      case "xenditPayment":
        return (
          <XenditPayment
            onError={onError}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            orderSlug={slug}
          />
        );
      case "mercadoPagoPayment":
        return (
          <MercadoPagoPayment
            onError={onError}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            orderSlug={slug}
          />
        );
      default:
        return null;
    }
  })();

  return (
    <div className="mx-auto w-full max-w-md px-4 py-8">
      <div className="rounded-large border border-divider bg-content1 p-5 sm:p-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50">
            <Icon
              icon="solar:lock-keyhole-minimalistic-bold"
              className="text-2xl text-primary-600"
            />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground">
              {t("checkout.completePayment", {
                defaultValue: "Complete your payment",
              })}
            </h1>
            <p className="text-xs text-foreground/50">
              {t("checkout.secureCheckout", { defaultValue: "Secure checkout" })}
            </p>
          </div>
        </div>

        {/* Amount */}
        <div className="mt-5 rounded-xl bg-content2 p-4 text-center">
          <p className="text-xs text-foreground/50">
            {t("checkout.amountToPay", { defaultValue: "Amount to pay" })}
          </p>
          <p className="mt-1 text-3xl font-extrabold text-foreground">
            {formatPrice(order.total_payable)}
          </p>
        </div>

        {/* Failed banner */}
        {phase === "failed" && (
          <div className="mt-4 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-700">
            <Icon
              icon="solar:danger-triangle-bold"
              className="mt-0.5 shrink-0 text-base"
            />
            <div>
              <p className="font-semibold">
                {t("checkout.paymentFailed", { defaultValue: "Payment failed" })}
              </p>
              {!quotationId && <p className="text-xs text-red-600">
                {t("checkout.paymentFailedHelp", {
                  defaultValue:
                    "Your payment didn't go through. You can try again below.",
                })}
              </p>}
            </div>
          </div>
        )}

        {/* Gateway pay button */}
        {!(quotationId && phase === "failed") && <div className="mt-5 w-full">{gateway}</div>}
        {isRazorpay && paymentStarted && order.payment_status === "pending" && (
          <Button
            variant="light"
            fullWidth
            className="mt-2"
            isDisabled={isLoading}
            onPress={() => setPhase("waiting")}
          >
            {t("checkout.checkPaymentStatus", { defaultValue: "Check payment status" })}
          </Button>
        )}

        {/* Trust note */}
        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-foreground/40">
          <Icon icon="solar:shield-check-linear" className="text-sm" />
          {t("checkout.securePaymentNote", {
            defaultValue: "Payments are encrypted & secure",
          })}
        </div>
      </div>

      <div className="mt-4 text-center">
        <Button
          variant="light"
          onPress={cancel}
          className="text-foreground/60"
          startContent={
            <Icon icon="solar:alt-arrow-left-linear" className="text-base" />
          }
        >
          {t("checkout.backToCheckout", { defaultValue: "Back to checkout" })}
        </Button>
      </div>
    </div>
  );
};

export default OrderPaymentView;
