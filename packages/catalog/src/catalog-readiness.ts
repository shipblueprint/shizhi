import {
  CATALOG,
  PRODUCTS,
  type CatalogSku,
  type Product,
} from "./catalog";

export type Provider = "creem" | "alipay";
export type ReadinessReason = "missing" | "placeholder" | "disabled";

export type CatalogReadinessIssue = {
  skuId: string;
  provider: Provider;
  reason: ReadinessReason;
};

export type ProviderCatalogEnv = {
  CREEM_PRODUCT_IDS?: string;
};

const PLACEHOLDER_PATTERNS = [
  /^prod_xxx(?:_[a-z0-9]+)*$/i,
  /^creem_course_\d+_[a-z]+$/i,
  /^(?:placeholder|replace[-_]?me|todo|tbd)$/i,
  /^(?:your|example)[-_]/i,
  /^prod_(?:test|example|your)[-_]/i,
];

/**
 * Returns true when a value looks like a repository placeholder rather than a
 * provider-issued identifier. Empty values are missing, not placeholders.
 */
export function isPlaceholderProviderId(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

export function isRealProviderId(value: unknown): value is string {
  if (typeof value !== "string" || value.trim() === "") return false;
  return !isPlaceholderProviderId(value);
}

function readProviderIdMap(raw: unknown): Record<string, string> {
  if (typeof raw !== "string" || !raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const out: Record<string, string> = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (typeof value === "string" && value.trim()) {
        out[key] = value.trim();
      }
    }
    return out;
  } catch {
    return {};
  }
}

function rawProviderId(
  skuId: string,
  staticId: string | undefined,
  env?: ProviderCatalogEnv
): string {
  const mapped = readProviderIdMap(env?.CREEM_PRODUCT_IDS)[skuId];
  if (mapped) return mapped;
  return typeof staticId === "string" ? staticId.trim() : "";
}

function isValidCreemProductId(value: string): boolean {
  if (!isRealProviderId(value)) return false;
  return /^prod_[A-Za-z0-9_-]+$/.test(value);
}

/**
 * Resolves a Creem product id from the environment map first, then the catalog.
 * Placeholder values are never returned, so callers cannot forward one to the
 * provider.
 */
export function resolveCreemProductId(
  skuId: string,
  staticId?: string,
  env?: ProviderCatalogEnv
): string | undefined {
  const value = rawProviderId(skuId, staticId, env);
  return isValidCreemProductId(value) ? value : undefined;
}

/** Mirrors checkout eligibility: live, priced, not gated, not on approval, deliverable. */
export function isSellableSku(sku: CatalogSku): boolean {
  if (sku.status !== "live") return false;
  if (typeof sku.priceCents !== "number" || !Number.isFinite(sku.priceCents)) {
    return false;
  }
  if (sku.fulfillment === "none") return false;
  if (sku.shipPhase === "on-approval") return false;
  return true;
}

function isSellableProduct(product: Product): boolean {
  return Number.isFinite(product.priceCents);
}

function checkCreemIdentifier(
  issues: CatalogReadinessIssue[],
  skuId: string,
  catalogId: string | undefined,
  env: ProviderCatalogEnv | undefined,
  required: boolean
): void {
  const raw = rawProviderId(skuId, catalogId, env);
  if (!raw) {
    if (required) {
      issues.push({ skuId, provider: "creem", reason: "missing" });
    }
    return;
  }
  if (!isValidCreemProductId(raw)) {
    issues.push({ skuId, provider: "creem", reason: "placeholder" });
  }
}

/**
 * Reports sellable catalog entries that cannot open a checkout because their
 * provider identifier is missing or still a placeholder.
 */
export function findCatalogReadinessIssues({
  env = {},
  catalog = CATALOG,
  products = PRODUCTS,
}: {
  env?: ProviderCatalogEnv;
  catalog?: CatalogSku[];
  products?: Record<string, Product>;
} = {}): CatalogReadinessIssue[] {
  const issues: CatalogReadinessIssue[] = [];

  for (const sku of catalog) {
    if (!isSellableSku(sku)) continue;
    if (sku.currency === "USD" || sku.currency === "EUR") {
      checkCreemIdentifier(issues, sku.id, sku.creemProductId, env, true);
    } else if (sku.currency === "CNY") {
      if (sku.alipayEnabled === false) {
        issues.push({ skuId: sku.id, provider: "alipay", reason: "disabled" });
      }
    }
  }

  for (const product of Object.values(products)) {
    if (!isSellableProduct(product)) continue;
    if (product.currency === "USD" || product.currency === "EUR") {
      checkCreemIdentifier(
        issues,
        product.id,
        product.creemProductId,
        env,
        true
      );
    }
  }

  return issues;
}
