import { describe, expect, it } from "vitest";
import { createHarness, startCheckout } from "./helpers";

describe("Alipay checkout", () => {
  it("creates a pending CNY order with the exact catalog amount", async () => {
    const { app, store, payments } = createHarness();
    const response = await startCheckout(app);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      url: "https://alipay.test/pay?order=cn_test_1",
    });

    const order = await store.getOrder("cn_test_1");
    expect(order).toMatchObject({
      productId: "book-guide-ebook-cny",
      email: "buyer@example.com",
      amountCents: 2900,
      currency: "CNY",
      status: "pending",
    });
    expect(payments).toEqual([
      {
        orderId: "cn_test_1",
        title: "Example Guide",
        priceCents: 2900,
        returnUrl:
          "https://cn.example.test/thanks?order=cn_test_1",
      },
    ]);
  });

  it("rejects planned and USD products", async () => {
    const { app, store } = createHarness();

    const planned = await startCheckout(
      app,
      "course-starter-1-cny"
    );
    expect(planned.status).toBe(404);

    const usd = await startCheckout(app, "book-guide-ebook-usd");
    expect(usd.status).toBe(404);
    expect(store.orders.size).toBe(0);
  });

  it("rejects a missing or invalid email", async () => {
    const { app, store } = createHarness();
    const response = await startCheckout(
      app,
      "book-guide-ebook-cny",
      "not-an-email"
    );
    expect(response.status).toBe(400);
    expect(store.orders.size).toBe(0);
  });

  it("renders a checkout form with legal links and no WeChat option", async () => {
    const { app } = createHarness();
    const response = await app.request("/product/book-guide-ebook-cny");
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('action="/checkout"');
    expect(html).toContain('href="/terms"');
    expect(html).toContain('href="/privacy"');
    expect(html).toContain('href="/refund"');
    expect(html).not.toContain("微信");
    expect(html).not.toContain("WeChat");
  });

  it("shows WeChat only when the merchant, region and SKU allow it", async () => {
    const enabled = createHarness({ wechatPay: true });
    const enabledHtml = await (
      await enabled.app.request("/product/book-guide-ebook-cny")
    ).text();
    expect(enabledHtml).toContain("使用微信支付");
    expect(enabledHtml).toContain('name="provider" value="wechat"');

    const international = createHarness({
      wechatPay: true,
      region: "international",
    });
    const internationalHtml = await (
      await international.app.request("/product/book-guide-ebook-cny")
    ).text();
    expect(internationalHtml).not.toContain("微信");

    const disabledSku = createHarness({ wechatPay: true });
    const disabledHtml = await (
      await disabledSku.app.request("/product/book-guide-tripwire-cny")
    ).text();
    expect(disabledHtml).toContain("使用支付宝支付");
    expect(disabledHtml).not.toContain("微信");
  });

  it("renders a Native WeChat QR page from the HTML checkout form", async () => {
    const { app, store } = createHarness({ wechatPay: true });
    const response = await app.request("/checkout", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        productId: "book-guide-ebook-cny",
        email: "buyer@example.com",
        provider: "wechat",
      }).toString(),
    });

    expect(response.status).toBe(200);
    const html = await response.text();
    expect(html).toContain("<svg");
    expect(html).toContain("微信支付");
    expect(html).toContain("/thanks?order=cn_test_1");
    expect((await store.getOrder("cn_test_1"))?.provider).toBe("wechat");
  });
});
