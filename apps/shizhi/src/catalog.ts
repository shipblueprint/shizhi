import {
  CATALOG,
  getSku,
  isFreeCatalogSku,
  isSellableSku,
  variantGroupId,
  type CatalogSku,
  type Family,
} from "@repo/catalog";

export { isFreeCatalogSku };

/**
 * The China storefront sells only CNY offers and lists free entry assets.
 * USD/EUR prices stay on the global store so this app never shows a currency
 * it cannot collect.
 */
export function isChinaStoreSku(sku: CatalogSku): boolean {
  return isFreeCatalogSku(sku) || sku.currency === "CNY";
}

export function isChinaPaidSku(
  sku: CatalogSku
): sku is CatalogSku & { priceCents: number; currency: "CNY" } {
  return (
    sku.currency === "CNY" &&
    isSellableSku(sku) &&
    typeof sku.priceCents === "number" &&
    Number.isFinite(sku.priceCents) &&
    sku.priceCents > 0
  );
}

export type ChinaPaymentMethod = "alipay" | "wechat";

export function isAlipayEnabled(sku: CatalogSku): boolean {
  return sku.alipayEnabled !== false;
}

export function isWechatEnabled(sku: CatalogSku): boolean {
  return sku.wechatPayEnabled === true;
}

export type ChinaCatalogOptions = {
  /** Whether the deployment can create WeChat Pay orders. */
  wechatAvailable?: boolean;
};

export function hasChinaPaymentMethod(
  sku: CatalogSku,
  options: ChinaCatalogOptions = {}
): boolean {
  return (
    isAlipayEnabled(sku) ||
    (options.wechatAvailable !== false && isWechatEnabled(sku))
  );
}

export function resolveChinaSku(id: string): CatalogSku | undefined {
  const sku = getSku(id);
  if (!sku || !isChinaStoreSku(sku)) return undefined;
  if (isFreeCatalogSku(sku) || isChinaPaidSku(sku)) return sku;
  return undefined;
}

export type ChinaCatalogItem = {
  groupId: string;
  title: string;
  description?: string;
  format: CatalogSku["format"];
  free: boolean;
  priceCents: number | null;
  priceLabel: string;
  sku: CatalogSku;
};

export function formatCny(cents: number | null): string {
  if (cents == null) return "免费";
  return `¥${(cents / 100).toFixed(2)}`;
}

/**
 * One card per product. A priced CNY variant wins over a free teaser in the
 * same variant group.
 */
export function getChinaCatalog(
  catalog: CatalogSku[] = CATALOG,
  options: ChinaCatalogOptions = {}
): ChinaCatalogItem[] {
  const items = new Map<string, ChinaCatalogItem>();
  for (const sku of catalog) {
    if (!isChinaStoreSku(sku)) continue;
    const free = isFreeCatalogSku(sku);
    let priceCents: number | null = null;
    if (!free) {
      if (!isChinaPaidSku(sku) || !hasChinaPaymentMethod(sku, options)) {
        continue;
      }
      priceCents = sku.priceCents;
    }

    const groupId = variantGroupId(sku);
    const existing = items.get(groupId);
    if (existing && (!existing.free || free)) continue;

    items.set(groupId, {
      groupId,
      title: sku.title,
      description: sku.description,
      format: sku.format,
      free,
      priceCents,
      priceLabel: formatCny(priceCents),
      sku,
    });
  }
  return [...items.values()].sort((a, b) => {
    if (a.free !== b.free) return a.free ? 1 : -1;
    return a.title.localeCompare(b.title);
  });
}

export type ChinaOfferCard = {
  offerId: string;
  family: Family;
  title: string;
  description?: string;
  representative: ChinaCatalogItem;
  freeItem?: ChinaCatalogItem;
  paidItems: ChinaCatalogItem[];
  priceLabel: string;
};

/**
 * The family pages use one card per offer, matching the global storefront.
 * A free teaser and its paid version stay together instead of reading as two
 * unrelated products.
 */
export function getChinaOfferCards(
  items: ChinaCatalogItem[]
): ChinaOfferCard[] {
  const offers = new Map<string, ChinaCatalogItem[]>();
  for (const item of items) {
    const group = offers.get(item.sku.offerId) ?? [];
    group.push(item);
    offers.set(item.sku.offerId, group);
  }

  const cards: ChinaOfferCard[] = [];
  for (const [offerId, offerItems] of offers) {
    const freeItem = offerItems.find((item) => item.free);
    const paidItems = offerItems
      .filter((item) => !item.free)
      .sort((a, b) => (a.priceCents ?? 0) - (b.priceCents ?? 0));
    const representative = paidItems[0] ?? freeItem ?? offerItems[0];
    if (!representative) continue;
    cards.push({
      offerId,
      family: representative.sku.family,
      title: representative.title,
      description: representative.description,
      representative,
      freeItem,
      paidItems,
      priceLabel: paidItems[0]?.priceLabel ?? "免费",
    });
  }

  return cards.sort((a, b) => a.title.localeCompare(b.title));
}
