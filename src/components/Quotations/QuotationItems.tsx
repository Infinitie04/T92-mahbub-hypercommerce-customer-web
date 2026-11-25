import QuotationThumbnail from "./QuotationThumbnail";
import { useQuotationMoney } from "./quotationPresentation";
import type { QuotationDetail, QuotationItemIssue } from "@/services/quotations";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChevronDown } from "lucide-react";
import { getFormattedDate } from "@/helpers/getters";
import styles from "./QuotationDetail.module.css";

type QuotationItem = QuotationDetail["items"][number];

function DetailPrice({ item, money }: { item: QuotationItem; money: ReturnType<typeof useQuotationMoney> }) {
  const { t, i18n } = useTranslation();
  if (item.status === "rejected") return null;

  const offers = (item.history ?? []).filter((event) => event.unit_price != null);
  const current = offers.find((event) => event.id === item.current_offer_id);
  const previous = offers.find((event) => event.id === current?.responds_to_offer_id);
  const difference = Math.round((Number(item.unit_price) - Number(previous?.unit_price)) * 100) / 100;
  const previousPrice = Number(previous?.unit_price);
  const change = difference / previousPrice;
  const ChangeIcon = difference < 0 ? ArrowDown : ArrowUp;
  const label = item.status === "agreed" ? t("quotation.detail.agreedPrice")
    : !current ? t("quotation.detail.unitPrice")
    : current.actor_role === "admin" ? t("quotation.detail.adminPrice")
    : t("quotation.detail.requestedPrice");

  return (
    <div className={styles.prices}>
      {previous?.unit_price != null && (
        <div className="text-sm text-default-700">
          <div>{t("quotation.detail.previousPrice")}</div>
          <del>{t("quotation.detail.perUnit", { price: money(previous.unit_price) })}</del>
        </div>
      )}
      <div>
        <div className="font-medium">{label}</div>
        <div className={styles.unitPrice}>{t("quotation.detail.perUnit", { price: money(item.unit_price) })}</div>
      </div>
      {previousPrice > 0 && difference !== 0 && (
        <span className={`${styles.badge} ${difference < 0 ? styles.success : styles.warning}`}>
          <ChangeIcon size={13} aria-hidden="true" />
          {t(difference < 0 ? "quotation.detail.priceDecrease" : "quotation.detail.priceIncrease", {
            percent: new Intl.NumberFormat(i18n.resolvedLanguage, {
              style: "percent", maximumFractionDigits: 1, signDisplay: "exceptZero",
            }).format(change),
            amount: money(Math.abs(difference)),
          })}
        </span>
      )}
    </div>
  );
}

function DetailHistory({ history, money }: {
  history: NonNullable<QuotationItem["history"]>;
  money: ReturnType<typeof useQuotationMoney>;
}) {
  const { t, i18n } = useTranslation();

  return (
    <details className={styles.history}>
      <summary><ChevronDown size={16} aria-hidden="true" />{t("quotation.detail.history", { count: history.length })}</summary>
      <ul>
        {[...history].reverse().map((event) => {
          const price = event.unit_price ?? history.find((offer) => offer.id === event.responds_to_offer_id)?.unit_price;
          const role = event.actor_role;

          return (
            <li key={event.id}>
              <span className={`${styles.badge} ${role === "admin" ? styles.success : role === "customer" ? styles.danger : styles.neutral}`}>
                {t(`quotation.detail.actor.${role}`)}
              </span>
              <div className="min-w-0 break-words">
                {t(`quotation.negotiation.event.${role}.${event.action}`)}
                {price != null && ` · ${t("quotation.detail.perUnit", { price: money(price) })}`}
                {event.reason && <p>{event.reason}</p>}
              </div>
              <time dateTime={event.created_at}>{getFormattedDate(event.created_at, i18n.resolvedLanguage, {
                day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata",
              })}</time>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export default function QuotationItems({ quote, issues, agreedOnly, detail, renderActions }: {
  quote: QuotationDetail;
  issues?: QuotationItemIssue[];
  agreedOnly?: boolean;
  detail?: boolean;
  renderActions?: (item: QuotationItem) => ReactNode;
}) {
  const { t } = useTranslation();
  const money = useQuotationMoney(quote.currency_code);

  return (
    <ul className={detail ? styles.items : "divide-y divide-divider rounded-large border border-divider bg-content1"}>
      {quote.items.map((item, index) => {
        if (agreedOnly && quote.item_negotiation && item.status !== "agreed") return null;

        const product = (
          <>
            <QuotationThumbnail src={item.image} detail={detail} />
            <div className="min-w-0">
              <div className={detail ? styles.productTitle : "break-words font-semibold"}>{item.title}</div>
              {item.variant_title !== item.title && <div className={`${detail ? "text-xs" : "text-sm"} break-words text-default-600`}>{item.variant_title}</div>}
              {detail && <div className={styles.quantity}>{t("quotation.quantityLabel")}: <strong>{item.quantity}</strong></div>}
            </div>
          </>
        );

        return (
          <li key={item.id ?? index} className={detail ? styles.item : "space-y-2 p-4"}>
            <div className={detail ? styles.itemGrid : "flex flex-wrap justify-between gap-2"}>
              {item.product_slug ? (
                <Link href={`/products/${encodeURIComponent(item.product_slug)}`}
                  className={`${detail ? styles.product : "flex min-w-0 items-center gap-3"} rounded-small hover:text-primary hover:underline focus-visible:outline-2 focus-visible:outline-primary`}>
                  {product}
                </Link>
              ) : <div className={detail ? styles.product : "flex min-w-0 items-center gap-3"}>{product}</div>}
              {detail ? <>
                <DetailPrice item={item} money={money} />
                {renderActions && <div className={styles.itemActions}>{renderActions(item)}</div>}
              </> : <span className="text-sm tabular-nums">
                {item.status === "rejected"
                  ? t("quotation.quantity", { count: item.quantity })
                  : `${item.quantity} × ${money(item.unit_price)}`}
              </span>}
            </div>
            {item.addons.map((addon) => (
              <p key={addon.addon_item_id} className="text-sm text-default-600">
                {t("quotation.addOn", { name: addon.metadata?.item_title || `#${addon.addon_item_id}`, amount: money(addon.price) })}
              </p>
            ))}
            {issues?.filter((issue) => issue.cart_item_id === index + 1).map((issue) => (
              <p key={issue.reason} role="alert" className="rounded-small bg-danger-50 p-2 text-sm text-danger">{issue.reason}</p>
            ))}
            {!detail && renderActions?.(item)}
            {detail && !!item.history?.length && <DetailHistory history={item.history} money={money} />}
          </li>
        );
      })}
    </ul>
  );
}
