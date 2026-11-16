import { createSign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createAlipayGateway } from "../src/alipay";

function toBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

function toPem(buffer: ArrayBuffer, label: string): string {
  const lines = toBase64(buffer).match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

async function keyPair() {
  const pair = await crypto.subtle.generateKey(
    {
      name: "RSASSA-PKCS1-v1_5",
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: "SHA-256",
    },
    true,
    ["sign", "verify"]
  );
  return {
    privateKey: toPem(
      await crypto.subtle.exportKey("pkcs8", pair.privateKey),
      "PRIVATE KEY"
    ),
    publicKey: toPem(
      await crypto.subtle.exportKey("spki", pair.publicKey),
      "PUBLIC KEY"
    ),
  };
}

async function signedNotification(
  privateKey: string,
  input: Record<string, string>
): Promise<string> {
  const params = {
    ...input,
    sign_type: "RSA2",
  };
  // Sign through Node's crypto with a canonical string built independently
  // from the production signer, so this test catches canonicalisation drift.
  const canonical = Object.keys(params)
    .filter((key) => key !== "sign" && key !== "sign_type")
    .sort()
    .map((key) => `${key}=${params[key as keyof typeof params]}`)
    .join("&");
  const sign = createSign("RSA-SHA256")
    .update(canonical, "utf8")
    .sign(privateKey, "base64");
  return new URLSearchParams({ ...params, sign }).toString();
}

describe("Alipay RSA2", () => {
  it("verifies a correctly signed notification and rejects tampering", async () => {
    const keys = await keyPair();
    const gateway = createAlipayGateway({
      appId: "2021000000000000",
      sellerId: "2088000000000000",
      privateKey: keys.privateKey,
      publicKey: keys.publicKey,
      appUrl: "https://cn.example.test",
    });
    const body = await signedNotification(keys.privateKey, {
      app_id: "2021000000000000",
      seller_id: "2088000000000000",
      notify_type: "trade_status_sync",
      out_trade_no: "cn_test_1",
      trade_no: "2026110922000000000001",
      total_amount: "29.00",
      trade_status: "TRADE_SUCCESS",
    });

    const verified = await gateway.verifyNotification(body);
    expect(verified?.get("out_trade_no")).toBe("cn_test_1");

    const tampered = body.replace("29.00", "0.01");
    expect(await gateway.verifyNotification(tampered)).toBeNull();

    const plain = body.replace("RSA2", "RSA1");
    expect(await gateway.verifyNotification(plain)).toBeNull();
  });

  it("creates a page-pay URL with the signed CNY amount", async () => {
    const keys = await keyPair();
    const gateway = createAlipayGateway({
      appId: "2021000000000000",
      sellerId: "2088000000000000",
      privateKey: keys.privateKey,
      publicKey: keys.publicKey,
      appUrl: "https://cn.example.test",
      gatewayUrl: "https://openapi.alipay.test/gateway.do",
      now: () => new Date("2026-11-09T00:00:00Z"),
    });

    const { url } = await gateway.createPayment({
      orderId: "cn_test_1",
      product: { title: "Example Guide", priceCents: 2900 },
      returnUrl: "https://cn.example.test/thanks?order=cn_test_1",
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://openapi.alipay.test/gateway.do"
    );
    expect(parsed.searchParams.get("method")).toBe("alipay.trade.page.pay");
    expect(parsed.searchParams.get("notify_url")).toBe(
      "https://cn.example.test/api/webhook/alipay"
    );
    expect(parsed.searchParams.get("timestamp")).toBe("2026-11-09 08:00:00");
    expect(parsed.searchParams.get("sign")).toBeTruthy();
    const biz = JSON.parse(parsed.searchParams.get("biz_content") ?? "{}");
    expect(biz).toMatchObject({
      out_trade_no: "cn_test_1",
      total_amount: "29.00",
      product_code: "FAST_INSTANT_TRADE_PAY",
    });
  });
});
