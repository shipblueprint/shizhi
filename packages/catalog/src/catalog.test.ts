import { describe, expect, it } from "vitest";
import { CATALOG, getSku } from "./catalog";
import { isSellableSku } from "./catalog-readiness";

const LAUNCH_PAID_SKUS = [
  "book-guide-ebook-usd",
  "book-guide-ebook-cny",
  "book-guide-tripwire-usd",
  "book-guide-tripwire-cny",
].sort();

describe("shared catalog invariants", () => {
  it("keeps the launch paid offers sellable", () => {
    expect(
      CATALOG.filter(isSellableSku)
        .map((sku) => sku.id)
        .sort()
    ).toEqual(LAUNCH_PAID_SKUS);
  });

  it("keeps paid download files private and named", () => {
    const downloads = CATALOG.filter(
      (sku) => isSellableSku(sku) && sku.fulfillment === "file_download"
    );
    expect(downloads.length).toBeGreaterThan(0);
    for (const sku of downloads) {
      expect(sku.fileKey).toMatch(/^products\/[A-Za-z0-9._-]+$/);
      expect(sku.filename).toMatch(/^[A-Za-z0-9._-]+$/);
    }
  });

  it("exposes CNY variants of the example ebook", () => {
    expect(getSku("book-guide-ebook-cny")?.currency).toBe("CNY");
    expect(getSku("book-guide-ebook-cny")?.alipayEnabled).toBe(true);
  });
});
