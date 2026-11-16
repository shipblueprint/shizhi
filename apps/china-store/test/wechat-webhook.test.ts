import { describe, expect, it } from "vitest";
import {
  createHarness,
  startCheckout,
  startWechatCheckout,
  wechatNotificationBody,
} from "./helpers";

async function postWechat(
  app: ReturnType<typeof createHarness>["app"],
  body: string
) {
  return app.request("/api/webhook/wechat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

describe("WeChat Pay checkout", () => {
  it("creates a pending CNY WeChat order and returns a Native QR code", async () => {
    const { app, store, wechat } = createHarness({ wechatPay: true });
    const response = await startWechatCheckout(app);

    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      orderId: string;
      codeUrl: string;
      qrSvg: string;
    };
    expect(payload.orderId).toBe("cn_test_1");
    expect(payload.codeUrl).toBe(
      "weixin://wxpay/bizpayurl?pr=cn_test_1"
    );
    expect(payload.qrSvg).toContain("<svg");

    const order = await store.getOrder("cn_test_1");
    expect(order).toMatchObject({
      provider: "wechat",
      productId: "book-guide-ebook-cny",
      email: "buyer@example.com",
      amountCents: 2900,
      currency: "CNY",
      status: "pending",
    });
    expect(wechat?.payments).toEqual([
      {
        orderId: "cn_test_1",
        title: "Example Guide",
        priceCents: 2900,
      },
    ]);
  });

  it("rejects WeChat when the merchant is not configured", async () => {
    const { app, store } = createHarness();
    const response = await startWechatCheckout(app);

    expect(response.status).toBe(400);
    expect(store.orders.size).toBe(0);
  });

  it("rejects WeChat outside mainland China", async () => {
    const { app, store } = createHarness({
      wechatPay: true,
      region: "international",
    });
    const response = await startWechatCheckout(app);

    expect(response.status).toBe(400);
    expect(store.orders.size).toBe(0);
  });

  it("rejects WeChat for a SKU that has not enabled it", async () => {
    const { app, store } = createHarness({ wechatPay: true });
    const response = await startWechatCheckout(
      app,
      "book-guide-tripwire-cny"
    );

    expect(response.status).toBe(400);
    expect(store.orders.size).toBe(0);
  });

  it("still accepts Alipay when WeChat is disabled", async () => {
    const { app, store } = createHarness();
    const response = await startCheckout(app);

    expect(response.status).toBe(200);
    expect((await store.getOrder("cn_test_1"))?.provider).toBe("alipay");
  });
});

describe("WeChat Pay notification validation", () => {
  it("marks the order paid, issues one token and sends one email", async () => {
    const { app, store, email } = createHarness({ wechatPay: true });
    await startWechatCheckout(app);

    const response = await postWechat(app, wechatNotificationBody());
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      code: "SUCCESS",
    });

    expect((await store.getOrder("cn_test_1"))?.status).toBe("paid");
    expect(store.tokens.size).toBe(1);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]).toMatchObject({
      kind: "download",
      to: "buyer@example.com",
      title: "Example Guide",
    });
  });

  it("treats a duplicate paid notification as idempotent", async () => {
    const { app, store, email } = createHarness({ wechatPay: true });
    await startWechatCheckout(app);
    await postWechat(app, wechatNotificationBody());

    const duplicate = await postWechat(app, wechatNotificationBody());
    expect(duplicate.status).toBe(200);
    expect(store.tokens.size).toBe(1);
    expect(email.sent).toHaveLength(1);
  });

  it("rejects a second WeChat transaction for the same order", async () => {
    const { app, store, email } = createHarness({ wechatPay: true });
    await startWechatCheckout(app);
    await postWechat(app, wechatNotificationBody());

    const secondPayment = await postWechat(
      app,
      wechatNotificationBody({
        transactionId: "4200000000000000002",
      })
    );
    expect(secondPayment.status).toBe(400);
    expect(store.tokens.size).toBe(1);
    expect(email.sent).toHaveLength(1);
  });

  it("rejects a wrong amount and leaves the order pending", async () => {
    const { app, store, email } = createHarness({ wechatPay: true });
    await startWechatCheckout(app);

    const response = await postWechat(
      app,
      wechatNotificationBody({ amountCents: 1 })
    );
    expect(response.status).toBe(400);
    expect((await store.getOrder("cn_test_1"))?.status).toBe("pending");
    expect(store.tokens.size).toBe(0);
    expect(email.sent).toHaveLength(0);
  });

  it("rejects a wrong currency", async () => {
    const { app, store, email } = createHarness({ wechatPay: true });
    await startWechatCheckout(app);

    const response = await postWechat(
      app,
      wechatNotificationBody({ currency: "USD" })
    );
    expect(response.status).toBe(400);
    expect((await store.getOrder("cn_test_1"))?.status).toBe("pending");
    expect(store.tokens.size).toBe(0);
    expect(email.sent).toHaveLength(0);
  });

  it("rejects a notification for a SKU that has not enabled WeChat", async () => {
    const { app, store, email } = createHarness({ wechatPay: true });
    await store.createOrder({
      id: "cn_test_1",
      provider: "wechat",
      productId: "book-guide-tripwire-cny",
      email: "buyer@example.com",
      amountCents: 900,
      createdAt: 1_800_000_000,
    });

    const response = await postWechat(
      app,
      wechatNotificationBody({ amountCents: 900 })
    );
    expect(response.status).toBe(400);
    expect((await store.getOrder("cn_test_1"))?.status).toBe("pending");
    expect(store.tokens.size).toBe(0);
    expect(email.sent).toHaveLength(0);
  });

  it("rejects a notification for an Alipay order", async () => {
    const { app, store } = createHarness({ wechatPay: true });
    await startCheckout(app);

    const response = await postWechat(app, wechatNotificationBody());
    expect(response.status).toBe(400);
    expect((await store.getOrder("cn_test_1"))?.status).toBe("pending");
  });

  it("rejects a failed signature and a failed decrypt", async () => {
    const { app, store, wechat } = createHarness({ wechatPay: true });
    await startWechatCheckout(app);
    if (!wechat) throw new Error("missing WeChat gateway");

    for (const failure of ["signature", "decrypt"] as const) {
      wechat.failVerification = failure;
      const response = await postWechat(app, wechatNotificationBody());
      expect(response.status).toBe(400);
      expect(
        (await store.getOrder("cn_test_1"))?.status
      ).toBe("pending");
    }
    expect(store.tokens.size).toBe(0);
  });

  it("rejects a notification for the wrong merchant app", async () => {
    const { app, store } = createHarness({ wechatPay: true });
    await startWechatCheckout(app);

    expect(
      (
        await postWechat(
          app,
          wechatNotificationBody({ appId: "wx_other" })
        )
      ).status
    ).toBe(400);
    expect(
      (
        await postWechat(
          app,
          wechatNotificationBody({ mchId: "1900000999" })
        )
      ).status
    ).toBe(400);
    expect((await store.getOrder("cn_test_1"))?.status).toBe("pending");
  });

  it("acknowledges non-success events without delivering", async () => {
    const { app, store, email } = createHarness({ wechatPay: true });
    await startWechatCheckout(app);

    const response = await postWechat(
      app,
      wechatNotificationBody({ tradeState: "NOTPAY" })
    );
    expect(response.status).toBe(200);
    expect((await store.getOrder("cn_test_1"))?.status).toBe("pending");
    expect(store.tokens.size).toBe(0);
    expect(email.sent).toHaveLength(0);
  });

  it("finishes delivery when the first attempt failed after payment", async () => {
    const { app, store, email } = createHarness({ wechatPay: true });
    await startWechatCheckout(app);
    email.failNext = true;

    const first = await postWechat(app, wechatNotificationBody());
    expect(first.status).toBe(500);
    expect((await store.getOrder("cn_test_1"))?.status).toBe("paid");
    expect(store.tokens.size).toBe(0);

    const retry = await postWechat(app, wechatNotificationBody());
    expect(retry.status).toBe(200);
    expect(store.tokens.size).toBe(1);
    expect(email.sent).toHaveLength(1);
  });
});
