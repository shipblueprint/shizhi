import {
  createCipheriv,
  createSign,
  generateKeyPairSync,
} from "node:crypto";
import { describe, expect, it } from "vitest";
import { createWechatPayGateway } from "../src/wechat";

const APP_ID = "wx_test_app_id";
const MCH_ID = "1900000109";
const SERIAL_NO = "SERIAL123";
const API_V3_KEY = "00000000000000000000000000000000";
const PLATFORM_SERIAL = "PUB_KEY_ID_TEST";
const NOW = 1_800_000_000;
const NONCE = "fixednonce";

function rsaKeys() {
  return generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
}

function sign(message: string, privateKey: string): string {
  return createSign("RSA-SHA256").update(message, "utf8").sign(privateKey, "base64");
}

function encryptNotification(
  payload: Record<string, unknown>,
  key = API_V3_KEY,
  nonce = "abcdefghijkl"
): string {
  const cipher = createCipheriv(
    "aes-256-gcm",
    Buffer.from(key, "utf8"),
    Buffer.from(nonce, "utf8")
  );
  cipher.setAAD(Buffer.from("transaction", "utf8"));
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
    cipher.getAuthTag(),
  ]);
  return encrypted.toString("base64");
}

function notificationBody(
  privateKey: string,
  resource: Record<string, unknown> = {
    appid: APP_ID,
    mchid: MCH_ID,
    out_trade_no: "cn_test_1",
    transaction_id: "4200000000000000001",
    trade_state: "SUCCESS",
    amount: { total: 2900, currency: "CNY" },
  },
  options: {
    key?: string;
    nonce?: string;
    timestamp?: number;
    eventType?: string;
  } = {}
) {
  const body = JSON.stringify({
    id: "evt_1",
    event_type: options.eventType ?? "TRANSACTION.SUCCESS",
    resource: {
      algorithm: "AEAD_AES_256_GCM",
      ciphertext: encryptNotification(resource, options.key, options.nonce),
      associated_data: "transaction",
      nonce: options.nonce ?? "abcdefghijkl",
      original_type: "transaction",
    },
  });
  const timestamp = String(options.timestamp ?? NOW);
  const nonce = "notifynonce";
  const signature = sign(`${timestamp}\n${nonce}\n${body}\n`, privateKey);
  return {
    body,
    headers: {
      "wechatpay-timestamp": timestamp,
      "wechatpay-nonce": nonce,
      "wechatpay-signature": signature,
      "wechatpay-serial": PLATFORM_SERIAL,
    },
  };
}

function gateway(
  keys: ReturnType<typeof rsaKeys>,
  fetchImpl?: typeof fetch
) {
  return createWechatPayGateway({
    appId: APP_ID,
    mchId: MCH_ID,
    serialNo: SERIAL_NO,
    privateKey: keys.privateKey,
    apiV3Key: API_V3_KEY,
    appUrl: "https://cn.example.test",
    platformPublicKeys: { [PLATFORM_SERIAL]: keys.publicKey },
    gatewayUrl: "https://api.mch.weixin.test",
    now: () => NOW,
    nonce: () => NONCE,
    fetchImpl,
  });
}

function authorizationParams(header: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const match of header.matchAll(/(\w+)="([^"]*)"/g)) {
    params[match[1]] = match[2];
  }
  return params;
}

describe("WeChat Pay v3 Native gateway", () => {
  it("creates a signed CNY Native order and returns the QR code URL", async () => {
    const keys = rsaKeys();
    let requestedUrl = "";
    let requestedInit: RequestInit | undefined;
    const gatewayInstance = gateway(keys, async (input, init) => {
      requestedUrl = String(input);
      requestedInit = init;
      return new Response(
        JSON.stringify({ code_url: "weixin://wxpay/bizpayurl?pr=abc" }),
        { status: 200, headers: { "content-type": "application/json" } }
      );
    });

    const result = await gatewayInstance.createPayment({
      orderId: "cn_test_1",
      product: { title: "Example Guide", priceCents: 2900 },
    });

    expect(result.codeUrl).toBe("weixin://wxpay/bizpayurl?pr=abc");
    expect(requestedUrl).toBe(
      "https://api.mch.weixin.test/v3/pay/transactions/native"
    );
    expect(requestedInit?.method).toBe("POST");
    const body = String(requestedInit?.body);
    expect(JSON.parse(body)).toEqual({
      appid: APP_ID,
      mchid: MCH_ID,
      description: "Example Guide",
      out_trade_no: "cn_test_1",
      notify_url: "https://cn.example.test/api/webhook/wechat",
      amount: { total: 2900, currency: "CNY" },
    });

    const headers = new Headers(requestedInit?.headers);
    const authorization = headers.get("authorization") ?? "";
    expect(authorization.startsWith("WECHATPAY2-SHA256-RSA2048 ")).toBe(true);
    const params = authorizationParams(authorization);
    expect(params.mchid).toBe(MCH_ID);
    expect(params.serial_no).toBe(SERIAL_NO);
    expect(params.nonce_str).toBe(NONCE);
    expect(params.timestamp).toBe(String(NOW));
    const signed = [
      "POST",
      "/v3/pay/transactions/native",
      String(NOW),
      NONCE,
      body,
      "",
    ].join("\n");
    const { createVerify } = await import("node:crypto");
    expect(
      createVerify("RSA-SHA256")
        .update(signed, "utf8")
        .verify(keys.publicKey, params.signature, "base64")
    ).toBe(true);
  });

  it("rejects a failed Native order response", async () => {
    const keys = rsaKeys();
    const gatewayInstance = gateway(
      keys,
      async () =>
        new Response(JSON.stringify({ code: "FAIL", message: "bad" }), {
          status: 400,
        })
    );

    await expect(
      gatewayInstance.createPayment({
        orderId: "cn_test_1",
        product: { title: "Book", priceCents: 2900 },
      })
    ).rejects.toThrow("WeChat Pay order creation failed: 400");
  });

  it("verifies the notification signature and decrypts the resource", async () => {
    const keys = rsaKeys();
    const { body, headers } = notificationBody(keys.privateKey);

    const notification = await gateway(keys).verifyNotification(
      headers,
      body
    );

    expect(notification).toEqual({
      id: "evt_1",
      eventType: "TRANSACTION.SUCCESS",
      appId: APP_ID,
      mchId: MCH_ID,
      outTradeNo: "cn_test_1",
      transactionId: "4200000000000000001",
      tradeState: "SUCCESS",
      amountCents: 2900,
      currency: "CNY",
    });
  });

  it("rejects a notification with a tampered signature", async () => {
    const keys = rsaKeys();
    const { body, headers } = notificationBody(keys.privateKey);
    const tampered = JSON.stringify({
      ...JSON.parse(body),
      event_type: "TRANSACTION.REFUND",
    });

    expect(
      await gateway(keys).verifyNotification(headers, tampered)
    ).toBeNull();
  });

  it("rejects a notification it cannot decrypt", async () => {
    const keys = rsaKeys();
    const { body, headers } = notificationBody(
      keys.privateKey,
      undefined,
      { key: "ffffffffffffffffffffffffffffffff" }
    );

    expect(await gateway(keys).verifyNotification(headers, body)).toBeNull();
  });

  it("rejects an unknown platform serial", async () => {
    const keys = rsaKeys();
    const { body, headers } = notificationBody(keys.privateKey);

    expect(
      await gateway(keys).verifyNotification(
        { ...headers, "wechatpay-serial": "PUB_KEY_ID_UNKNOWN" },
        body
      )
    ).toBeNull();
  });

  it("acknowledges a signed non-payment event", async () => {
    const keys = rsaKeys();
    const { body, headers } = notificationBody(
      keys.privateKey,
      undefined,
      { eventType: "REFUND.SUCCESS" }
    );

    const notification = await gateway(keys).verifyNotification(
      headers,
      body
    );
    expect(notification?.eventType).toBe("REFUND.SUCCESS");
    expect(notification?.outTradeNo).toBe("");
  });

  it("rejects a stale notification timestamp", async () => {
    const keys = rsaKeys();
    const { body, headers } = notificationBody(
      keys.privateKey,
      undefined,
      { timestamp: NOW - 301 }
    );

    expect(await gateway(keys).verifyNotification(headers, body)).toBeNull();
  });
});
