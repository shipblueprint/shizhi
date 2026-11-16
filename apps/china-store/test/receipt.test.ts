import { describe, expect, it } from "vitest";
import { buildReceiptState } from "../src/receipt";
import { createHarness } from "./helpers";

describe("China receipt page", () => {
  it("shows pending, paid, failed, refunded and unknown states honestly", async () => {
    const harness = createHarness();
    const states = ["pending", "paid", "refunded", "failed"] as const;
    for (const status of states) {
      await harness.store.createOrder({
        id: `cn_${status}`,
        provider: "alipay",
        productId: "book-guide-ebook-cny",
        email: "buyer@example.com",
        amountCents: 2900,
        createdAt: harness.now,
      });
      const order = await harness.store.getOrder(`cn_${status}`);
      if (!order) throw new Error("order missing");
      harness.store.orders.set(order.id, { ...order, status });
    }

    const output = new Map<string, string>();
    for (const status of states) {
      const response = await harness.app.request(`/thanks?order=cn_${status}`);
      expect(response.status).toBe(200);
      output.set(status, await response.text());
    }

    expect(output.get("pending")).toContain("我们还没有确认这笔付款");
    expect(output.get("paid")).toContain("付款已确认");
    expect(output.get("refunded")).toContain("这笔订单已退款");
    expect(output.get("failed")).toContain("这笔付款没有完成");

    expect(buildReceiptState(null).heading).toContain("找不到");
    const unknown = await harness.app.request("/thanks?order=missing");
    expect(await unknown.text()).toContain("找不到这个订单号");
  });
});

describe("China legal pages", () => {
  it("ships local terms, privacy and refund pages linked from the footer", async () => {
    const harness = createHarness();
    for (const [path, text] of [
      ["/terms", "服务条款"],
      ["/privacy", "隐私政策"],
      ["/refund", "退款政策"],
    ] as const) {
      const response = await harness.app.request(path);
      expect(response.status).toBe(200);
      const html = await response.text();
      expect(html).toContain(text);
      expect(html).toContain('href="/terms"');
      expect(html).toContain('href="/privacy"');
      expect(html).toContain('href="/refund"');
    }
  });

  it("never renders a WeChat payment button", async () => {
    const harness = createHarness();
    for (const path of ["/", "/store", "/product/book-guide-ebook-cny"]) {
      const html = await (await harness.app.request(path)).text();
      expect(html).not.toContain("微信");
      expect(html).not.toContain("WeChat");
    }
  });
});
