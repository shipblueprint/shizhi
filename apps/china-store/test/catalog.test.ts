import { describe, expect, it } from "vitest";
import { getChinaCatalog, resolveChinaSku } from "../src/catalog";

describe("China storefront catalog", () => {
  it("lists free and CNY offers from the shared catalog", () => {
    const items = getChinaCatalog();
    expect(items.some((item) => item.free)).toBe(true);
    expect(
      items.some((item) => !item.free && item.sku.currency === "CNY")
    ).toBe(true);
    expect(items.every((item) => item.free || item.sku.currency === "CNY")).toBe(
      true
    );
  });

  it("does not sell USD variants in the China store", () => {
    expect(resolveChinaSku("book-guide-ebook-usd")).toBeUndefined();
    expect(resolveChinaSku("book-guide-ebook-cny")?.priceCents).toBe(2900);
  });

  it("rejects planned CNY products", () => {
    expect(resolveChinaSku("course-starter-1-cny")).toBeUndefined();
  });

  it("formats CNY prices in yuan", () => {
    const item = getChinaCatalog().find(
      (entry) => entry.sku.id === "book-guide-ebook-cny"
    );
    expect(item?.priceLabel).toBe("¥29.00");
  });

  it("hides a WeChat-only SKU when WeChat is unavailable", () => {
    const base = getChinaCatalog().find(
      (entry) => entry.sku.id === "book-guide-ebook-cny"
    )?.sku;
    expect(base).toBeDefined();
    const wechatOnly = {
      ...base!,
      id: "test-wechat-only",
      alipayEnabled: false,
      wechatPayEnabled: true,
    };

    expect(
      getChinaCatalog([wechatOnly], { wechatAvailable: false })
    ).toHaveLength(0);
    expect(
      getChinaCatalog([wechatOnly], { wechatAvailable: true })
    ).toHaveLength(1);
  });
});
