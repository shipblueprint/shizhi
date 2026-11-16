import { describe, expect, it } from "vitest";
import { notifyBody, startCheckout, createHarness } from "./helpers";

async function postNotification(
  app: ReturnType<typeof createHarness>["app"],
  body: string
) {
  return app.request("/api/webhook/alipay", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body,
  });
}

describe("Alipay notification validation", () => {
  it("marks the order paid, issues one token and sends one email", async () => {
    const { app, store, email } = createHarness();
    await startCheckout(app);

    const response = await postNotification(app, notifyBody());
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("success");

    expect((await store.getOrder("cn_test_1"))?.status).toBe("paid");
    expect(store.tokens.size).toBe(1);
    expect(email.sent).toHaveLength(1);
    expect(email.sent[0]).toMatchObject({
      kind: "download",
      to: "buyer@example.com",
      title: "Example Guide",
    });
    expect(email.sent[0].url).toMatch(
      /^https:\/\/cn\.example\.test\/download\/[a-f0-9]{64}$/
    );
  });

  it("treats a duplicate paid notification as idempotent", async () => {
    const { app, store, email } = createHarness();
    await startCheckout(app);
    await postNotification(app, notifyBody());

    const duplicate = await postNotification(
      app,
      notifyBody({ tradeNo: "2026110922000000000002" })
    );
    expect(duplicate.status).toBe(200);
    await expect(duplicate.text()).resolves.toBe("success");
    expect(store.tokens.size).toBe(1);
    expect(email.sent).toHaveLength(1);
  });

  it("rejects a wrong amount and leaves the order pending", async () => {
    const { app, store, email } = createHarness();
    await startCheckout(app);

    const response = await postNotification(
      app,
      notifyBody({ amount: "0.01" })
    );
    expect(response.status).toBe(400);
    await expect(response.text()).resolves.toBe("fail");
    expect((await store.getOrder("cn_test_1"))?.status).toBe("pending");
    expect(store.tokens.size).toBe(0);
    expect(email.sent).toHaveLength(0);
  });

  it("rejects a wrong currency", async () => {
    const { app, store, email } = createHarness();
    await startCheckout(app);

    const response = await postNotification(
      app,
      notifyBody({ currency: "USD" })
    );
    expect(response.status).toBe(400);
    expect((await store.getOrder("cn_test_1"))?.status).toBe("pending");
    expect(store.tokens.size).toBe(0);
    expect(email.sent).toHaveLength(0);
  });

  it("rejects a notification for the wrong app or seller", async () => {
    const { app, store } = createHarness();
    await startCheckout(app);

    expect(
      (
        await postNotification(
          app,
          notifyBody({ appId: "2021999999999999" })
        )
      ).status
    ).toBe(400);
    expect(
      (
        await postNotification(
          app,
          notifyBody({ sellerId: "2088999999999999" })
        )
      ).status
    ).toBe(400);
    expect((await store.getOrder("cn_test_1"))?.status).toBe("pending");
  });

  it("acknowledges non-success trade states without delivering", async () => {
    const { app, store, email } = createHarness();
    await startCheckout(app);

    const response = await postNotification(
      app,
      notifyBody({ status: "TRADE_CLOSED" })
    );
    expect(response.status).toBe(200);
    await expect(response.text()).resolves.toBe("success");
    expect((await store.getOrder("cn_test_1"))?.status).toBe("pending");
    expect(store.tokens.size).toBe(0);
    expect(email.sent).toHaveLength(0);
  });

  it("rejects payment for a planned CNY product", async () => {
    const { app, store, email } = createHarness();
    await store.createOrder({
      id: "cn_test_1",
      provider: "alipay",
      productId: "course-starter-1-cny",
      email: "buyer@example.com",
      amountCents: 24900,
      createdAt: 1_800_000_000,
    });

    const response = await postNotification(
      app,
      notifyBody({ amount: "249.00" })
    );
    expect(response.status).toBe(400);
    expect(store.tokens.size).toBe(0);
    expect(email.sent).toHaveLength(0);
  });

  it("finishes delivery when the first attempt failed after payment", async () => {
    const { app, store, email } = createHarness();
    await startCheckout(app);
    email.failNext = true;

    const first = await postNotification(app, notifyBody());
    expect(first.status).toBe(500);
    expect((await store.getOrder("cn_test_1"))?.status).toBe("paid");
    expect(store.tokens.size).toBe(0);

    const retry = await postNotification(app, notifyBody());
    expect(retry.status).toBe(200);
    await expect(retry.text()).resolves.toBe("success");
    expect(store.tokens.size).toBe(1);
    expect(email.sent).toHaveLength(1);
  });

  it("uses the stored order amount, not the current catalog price", async () => {
    const { app, store } = createHarness();
    await store.createOrder({
      id: "cn_test_1",
      provider: "alipay",
      productId: "book-guide-ebook-cny",
      email: "buyer@example.com",
      amountCents: 2800,
      createdAt: 1_800_000_000,
    });

    const response = await postNotification(
      app,
      notifyBody({ amount: "28.00" })
    );
    expect(response.status).toBe(200);
    expect((await store.getOrder("cn_test_1"))?.status).toBe("paid");
  });
});
