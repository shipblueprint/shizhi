import { describe, expect, it } from "vitest";
import { hashToken } from "../src/app";
import {
  createHarness,
  notifyBody,
  startCheckout,
} from "./helpers";

async function paidDownload(harness: ReturnType<typeof createHarness>) {
  await startCheckout(harness.app);
  const webhook = await harness.app.request("/api/webhook/alipay", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: notifyBody(),
  });
  expect(webhook.status).toBe(200);
  const url = harness.email.sent[0]?.url;
  if (!url) throw new Error("Missing delivery email");
  return url.split("/download/")[1];
}

describe("Private paid delivery", () => {
  it("downloads through a token without leaking storage details", async () => {
    const harness = createHarness();
    const token = await paidDownload(harness);

    const response = await harness.app.request(`/download/${token}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="example-guide.pdf"'
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await response.text()).toBe(
      "file:products/example-guide-v1.pdf"
    );
    expect(harness.storage.requestedKeys).toEqual([
      "products/example-guide-v1.pdf",
    ]);
  });

  it("honours the download limit", async () => {
    const harness = createHarness({ maxDownloads: 1 });
    const token = await paidDownload(harness);

    expect((await harness.app.request(`/download/${token}`)).status).toBe(200);
    expect((await harness.app.request(`/download/${token}`)).status).toBe(429);
  });

  it("rejects an expired token", async () => {
    const harness = createHarness({
      tokenTtlSeconds: 60,
    });
    const token = await paidDownload(harness);
    harness.setNow(harness.now + 60);

    const response = await harness.app.request(`/download/${token}`);
    expect(response.status).toBe(410);
  });

  it("rejects malformed and unknown tokens", async () => {
    const harness = createHarness();
    expect(
      (await harness.app.request("/download/not-a-token")).status
    ).toBe(404);
    expect(
      (await harness.app.request(`/download/${"f".repeat(64)}`)).status
    ).toBe(404);
  });

  it("rejects a token whose order is not paid", async () => {
    const harness = createHarness();
    const token = "b".repeat(64);
    await harness.store.createOrder({
      id: "cn_pending",
      provider: "alipay",
      productId: "book-guide-ebook-cny",
      email: "buyer@example.com",
      amountCents: 2900,
      createdAt: harness.now,
    });
    await harness.store.createDownloadToken({
      tokenHash: await hashToken(token),
      orderId: "cn_pending",
      productId: "book-guide-ebook-cny",
      expiresAt: harness.now + 3600,
      maxDownloads: 5,
      createdAt: harness.now,
    });

    const response = await harness.app.request(`/download/${token}`);
    expect(response.status).toBe(404);
    expect(harness.storage.requestedKeys).toHaveLength(0);
  });

  it("does not consume a download when storage is unavailable", async () => {
    const harness = createHarness();
    const token = await paidDownload(harness);
    harness.storage.unavailable = true;

    expect((await harness.app.request(`/download/${token}`)).status).toBe(502);
    const record = await harness.store.getDownloadToken(
      await hashToken(token)
    );
    expect(record?.downloads).toBe(0);
  });

  it("resends only to the matching buyer of a paid order", async () => {
    const harness = createHarness();
    await paidDownload(harness);

    const wrongEmail = await harness.app.request("/api/delivery/resend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: "cn_test_1",
        email: "other@example.com",
      }),
    });
    expect(wrongEmail.status).toBe(404);
    expect(harness.email.sent).toHaveLength(1);

    const resend = await harness.app.request("/api/delivery/resend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        orderId: "cn_test_1",
        email: "buyer@example.com",
      }),
    });
    expect(resend.status).toBe(200);
    expect(harness.email.sent).toHaveLength(2);
  });
});
