export type Family = "course" | "book" | "template";
export type Fulfillment =
  "file_download" | "external_access" | "email_delivery" | "none";
export type OfferStatus = "live" | "planned" | "gated";
export type Currency = "USD" | "EUR" | "CNY";

export type FreeAsset = {
  kind: "agent" | "checklist" | "worksheet" | "template" | "doc" | "demo";
  fulfillment: Fulfillment;
  fileKey?: string;
  externalUrl?: string;
};

export type ShipPhase =
  | "week-0"
  | "week-1"
  | "week-2"
  | "week-3"
  | "week-4"
  | "week-5"
  | "month-3"
  | "month-4"
  | "month-5"
  | "month-6"
  | "on-approval";

export type CatalogSku = {
  id: string;
  offerId: string;
  family: Family;
  format: "course" | "ebook" | "ecourse" | "template" | "agent" | "bundle";
  title: string;
  description?: string;
  status: OfferStatus;
  shipPhase?: ShipPhase;
  fulfillment: Fulfillment;

  freeAssets?: FreeAsset[];

  priceCents?: number | null;
  priceRange?: { minCents: number; maxCents: number };
  currency?: Currency;
  creemProductId?: string;
  alipayEnabled?: boolean;
  wechatPayEnabled?: boolean;

  fileKey?: string;
  filename?: string;
  externalUrl?: string;

  ctaLabel?: string;

  promo?: {
    priceCents: number;
    windowDays: number;
    surface: string;
  };
};

export type Offer = {
  offerId: string;
  family: Family;
  landingPath: string;
  title: string;
  description: string;
  tags: string[];
};

type LegacyCurrency = "USD" | "EUR" | "CNY";
export type Product = {
  id: string;
  title: string;
  description?: string;
  priceCents: number;
  currency: LegacyCurrency;
  creemProductId?: string;
  fileKey: string;
  filename: string;
};

const SAMPLE_DESCRIPTION =
  "A production-ready example product with source code and documentation.";

export const PRODUCTS: Record<string, Product> = {
  "sample-template": {
    id: "sample-template",
    title: "Sample Template",
    description: SAMPLE_DESCRIPTION,
    priceCents: 4900,
    currency: "USD",
    fileKey: "products/sample-template-v1.zip",
    filename: "sample-template-v1.zip",
  },
  "sample-template-eur": {
    id: "sample-template-eur",
    title: "Sample Template",
    description: SAMPLE_DESCRIPTION,
    priceCents: 4500,
    currency: "EUR",
    fileKey: "products/sample-template-v1.zip",
    filename: "sample-template-v1.zip",
  },
  "sample-product-cny": {
    id: "sample-product-cny",
    title: "Sample Product",
    description: "A downloadable sample product delivered after payment.",
    priceCents: 34900,
    currency: "CNY",
    fileKey: "products/sample-product-cny-v1.zip",
    filename: "sample-product-cny-v1.zip",
  },
};

export const OFFERS: Offer[] = [
  {
    offerId: "course-starter",
    family: "course",
    landingPath: "/courses/starter",
    title: "Starter Course",
    description:
      "A short example course that walks through the basics end to end.",
    tags: ["Course", "Example", "Free entry"],
  },
  {
    offerId: "book-guide",
    family: "book",
    landingPath: "/books/guide",
    title: "Example Guide",
    description: "A practical example ebook you can apply right away.",
    tags: ["Ebook", "Example"],
  },
  {
    offerId: "template-kit",
    family: "template",
    landingPath: "/templates/kit",
    title: "Starter Templates",
    description: "Example starter kits you can fork, wire up, and ship.",
    tags: ["Templates", "Example", "Starter kit"],
  },
];

/**
 * Sample launch catalog: every intentionally purchasable SKU is `live`.
 * Fixed-price ebooks ship now; the course and the template pack stay
 * `planned` until access and concrete prices exist.
 */
export const CATALOG: CatalogSku[] = [
  {
    id: "course-starter-free",
    offerId: "course-starter",
    family: "course",
    format: "ecourse",
    title: "Course 1 Foundations",
    status: "live",
    shipPhase: "week-1",
    fulfillment: "email_delivery",
    freeAssets: [
      { kind: "doc", fulfillment: "email_delivery" },
      { kind: "demo", fulfillment: "email_delivery" },
    ],
  },
  {
    id: "course-starter-1-usd",
    offerId: "course-starter",
    family: "course",
    format: "course",
    title: "Course 1 Foundations",
    status: "planned",
    shipPhase: "week-5",
    fulfillment: "external_access",
    priceCents: 9900,
    currency: "USD",
  },
  {
    id: "course-starter-1-cny",
    offerId: "course-starter",
    family: "course",
    format: "course",
    title: "Course 1 Foundations",
    status: "planned",
    shipPhase: "week-5",
    fulfillment: "external_access",
    priceCents: 19900,
    currency: "CNY",
    alipayEnabled: true,
  },
  {
    id: "book-guide-ebook-usd",
    offerId: "book-guide",
    family: "book",
    format: "ebook",
    title: "Example Guide",
    status: "live",
    shipPhase: "week-2",
    fulfillment: "file_download",
    priceCents: 2700,
    currency: "USD",
    fileKey: "products/example-guide-v1.pdf",
    filename: "example-guide.pdf",
  },
  {
    id: "book-guide-ebook-cny",
    offerId: "book-guide",
    family: "book",
    format: "ebook",
    title: "Example Guide",
    status: "live",
    shipPhase: "week-2",
    fulfillment: "file_download",
    priceCents: 2900,
    currency: "CNY",
    alipayEnabled: true,
    wechatPayEnabled: true,
    fileKey: "products/example-guide-v1.pdf",
    filename: "example-guide.pdf",
    promo: {
      priceCents: 900,
      windowDays: 7,
      surface: "course-1-delivery",
    },
  },
  {
    id: "book-guide-tripwire-usd",
    offerId: "book-guide",
    family: "book",
    format: "ebook",
    title: "Example Guide (tripwire)",
    status: "live",
    shipPhase: "week-2",
    fulfillment: "file_download",
    priceCents: 900,
    currency: "USD",
    fileKey: "products/example-guide-v1.pdf",
    filename: "example-guide.pdf",
  },
  {
    id: "book-guide-tripwire-cny",
    offerId: "book-guide",
    family: "book",
    format: "ebook",
    title: "Example Guide (tripwire)",
    status: "live",
    shipPhase: "week-2",
    fulfillment: "file_download",
    priceCents: 900,
    currency: "CNY",
    alipayEnabled: true,
    fileKey: "products/example-guide-v1.pdf",
    filename: "example-guide.pdf",
  },
  {
    id: "template-kit-free",
    offerId: "template-kit",
    family: "template",
    format: "agent",
    title: "Starter Kit",
    status: "live",
    shipPhase: "week-0",
    fulfillment: "external_access",
    externalUrl: "https://example.com/starter-kit",
    freeAssets: [{ kind: "agent", fulfillment: "external_access" }],
  },
  {
    id: "template-kit-pack-usd",
    offerId: "template-kit",
    family: "template",
    format: "bundle",
    title: "Template Pack",
    status: "planned",
    shipPhase: "week-3",
    fulfillment: "file_download",
    priceCents: null,
    priceRange: { minCents: 900, maxCents: 4900 },
    currency: "USD",
    fileKey: "products/example-pack-v1.zip",
    filename: "example-pack.zip",
  },
];

export function getProduct(id: string): Product | undefined {
  const legacy = PRODUCTS[id];
  if (legacy) return legacy;
  const sku = CATALOG.find((s) => s.id === id);
  if (!sku || typeof sku.priceCents !== "number") return undefined;
  if (sku.currency !== "USD" && sku.currency !== "CNY") {
    return undefined;
  }
  return {
    id: sku.id,
    title: sku.title,
    description: sku.description,
    priceCents: sku.priceCents,
    currency: sku.currency,
    creemProductId: sku.creemProductId,
    fileKey: sku.fileKey ?? "",
    filename: sku.filename ?? "",
  };
}

export function getSku(id: string): CatalogSku | undefined {
  return CATALOG.find((s) => s.id === id);
}

export function getOffer(offerId: string): Offer | undefined {
  return OFFERS.find((o) => o.offerId === offerId);
}

export const getOfferById = getOffer;

export function getOffers(family?: Family): Offer[] {
  return family ? OFFERS.filter((o) => o.family === family) : [...OFFERS];
}

export function isFreeCatalogSku(sku: CatalogSku): boolean {
  return (
    Boolean(sku.freeAssets?.length) &&
    sku.priceCents == null &&
    sku.priceRange == null
  );
}

export function variantGroupId(sku: Pick<CatalogSku, "id">): string {
  return sku.id.replace(/-(usd|cny|eur)$/i, "");
}

export function getOfferSkus(
  offerId: string
):
  | { offer: Offer; free: CatalogSku | undefined; paid: CatalogSku[] }
  | undefined {
  const offer = getOffer(offerId);
  if (!offer) return undefined;
  const skus = CATALOG.filter((s) => s.offerId === offerId);
  return {
    offer,
    free: skus.find(isFreeCatalogSku),
    paid: skus.filter(
      (s) => !isFreeCatalogSku(s) && !s.id.includes("-tripwire-")
    ),
  };
}
