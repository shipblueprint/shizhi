import { createDecipheriv, randomBytes } from "node:crypto";
import { rsaSign, rsaVerify } from "./alipay";
import type { WechatNotification, WechatPayGateway } from "./domain";

const NATIVE_ORDER_PATH = "/v3/pay/transactions/native";
const TIMESTAMP_TOLERANCE_SECONDS = 300;

export type WechatPayConfig = {
  appId: string;
  mchId: string;
  serialNo: string;
  privateKey: string;
  apiV3Key: string;
  appUrl: string;
  platformPublicKeys: Record<string, string>;
  gatewayUrl?: string;
  now?: () => number;
  nonce?: () => string;
  fetchImpl?: typeof fetch;
};

function headerValue(
  headers: Headers | Record<string, string | undefined>,
  name: string
): string | null {
  if (headers instanceof Headers) return headers.get(name);
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted && typeof value === "string") {
      return value;
    }
  }
  return null;
}

function decryptResource(
  apiV3Key: string,
  resource: {
    algorithm?: unknown;
    ciphertext?: unknown;
    associated_data?: unknown;
    nonce?: unknown;
  }
): Record<string, unknown> | null {
  if (
    resource.algorithm !== "AEAD_AES_256_GCM" ||
    typeof resource.ciphertext !== "string" ||
    typeof resource.nonce !== "string"
  ) {
    return null;
  }
  try {
    const data = Buffer.from(resource.ciphertext, "base64");
    if (data.length <= 16) return null;
    const decipher = createDecipheriv(
      "aes-256-gcm",
      Buffer.from(apiV3Key, "utf8"),
      Buffer.from(resource.nonce, "utf8")
    );
    if (typeof resource.associated_data === "string") {
      decipher.setAAD(Buffer.from(resource.associated_data, "utf8"));
    }
    decipher.setAuthTag(data.subarray(data.length - 16));
    const plaintext = Buffer.concat([
      decipher.update(data.subarray(0, data.length - 16)),
      decipher.final(),
    ]).toString("utf8");
    const parsed: unknown = JSON.parse(plaintext);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function readNotification(
  plaintext: Record<string, unknown>
): Omit<WechatNotification, "id" | "eventType"> | null {
  const amount = plaintext.amount;
  if (!amount || typeof amount !== "object" || Array.isArray(amount)) {
    return null;
  }
  const value = amount as Record<string, unknown>;
  if (
    typeof plaintext.appid !== "string" ||
    typeof plaintext.mchid !== "string" ||
    typeof plaintext.out_trade_no !== "string" ||
    typeof plaintext.transaction_id !== "string" ||
    typeof plaintext.trade_state !== "string" ||
    typeof value.total !== "number" ||
    typeof value.currency !== "string"
  ) {
    return null;
  }
  return {
    appId: plaintext.appid,
    mchId: plaintext.mchid,
    outTradeNo: plaintext.out_trade_no,
    transactionId: plaintext.transaction_id,
    tradeState: plaintext.trade_state,
    amountCents: value.total,
    currency: value.currency,
  };
}

/** WeChat Pay API v3 Native payments, notifications and AES-GCM decryption. */
export function createWechatPayGateway(
  config: WechatPayConfig
): WechatPayGateway {
  if (Buffer.byteLength(config.apiV3Key, "utf8") !== 32) {
    throw new Error("WECHAT_PAY_API_V3_KEY must be exactly 32 bytes");
  }
  const gatewayBase = (
    config.gatewayUrl ?? "https://api.mch.weixin.qq.com"
  ).replace(/\/+$/, "");
  const now = config.now ?? (() => Math.floor(Date.now() / 1000));
  const nonce = config.nonce ?? (() => randomBytes(16).toString("hex"));
  const send = config.fetchImpl ?? fetch;

  return {
    appId: config.appId,
    mchId: config.mchId,

    async createPayment(input) {
      const body = JSON.stringify({
        appid: config.appId,
        mchid: config.mchId,
        description: input.product.title.slice(0, 127),
        out_trade_no: input.orderId,
        notify_url: `${config.appUrl.replace(/\/+$/, "")}/api/webhook/wechat`,
        amount: {
          total: input.product.priceCents,
          currency: "CNY",
        },
      });
      const timestamp = String(now());
      const nonceStr = nonce();
      const signature = await rsaSign(
        config.privateKey,
        `POST\n${NATIVE_ORDER_PATH}\n${timestamp}\n${nonceStr}\n${body}\n`
      );
      const authorization =
        `WECHATPAY2-SHA256-RSA2048 mchid="${config.mchId}",` +
        `nonce_str="${nonceStr}",signature="${signature}",` +
        `timestamp="${timestamp}",serial_no="${config.serialNo}"`;

      const response = await send(`${gatewayBase}${NATIVE_ORDER_PATH}`, {
        method: "POST",
        headers: {
          Authorization: authorization,
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body,
      });
      if (!response.ok) {
        throw new Error(
          `WeChat Pay order creation failed: ${response.status}`
        );
      }
      const value: unknown = await response.json();
      const codeUrl =
        value && typeof value === "object"
          ? (value as { code_url?: unknown }).code_url
          : undefined;
      if (typeof codeUrl !== "string" || !codeUrl.trim()) {
        throw new Error("WeChat Pay order response did not include code_url");
      }
      return { codeUrl };
    },

    async verifyNotification(headers, rawBody) {
      const timestamp = headerValue(headers, "wechatpay-timestamp");
      const nonceValue = headerValue(headers, "wechatpay-nonce");
      const signature = headerValue(headers, "wechatpay-signature");
      const serial = headerValue(headers, "wechatpay-serial");
      if (!timestamp || !nonceValue || !signature || !serial) return null;

      const sentAt = Number(timestamp);
      if (
        !Number.isInteger(sentAt) ||
        Math.abs(now() - sentAt) > TIMESTAMP_TOLERANCE_SECONDS
      ) {
        return null;
      }

      const publicKey = config.platformPublicKeys[serial];
      if (!publicKey) return null;
      const verified = await rsaVerify(
        publicKey,
        `${timestamp}\n${nonceValue}\n${rawBody}\n`,
        signature
      );
      if (!verified) return null;

      let envelope: Record<string, unknown>;
      try {
        const parsed: unknown = JSON.parse(rawBody);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          return null;
        }
        envelope = parsed as Record<string, unknown>;
      } catch {
        return null;
      }

      const resource = envelope.resource;
      if (!resource || typeof resource !== "object" || Array.isArray(resource)) {
        return null;
      }
      const plaintext = decryptResource(
        config.apiV3Key,
        resource as Record<string, unknown>
      );
      if (!plaintext) return null;

      const id = typeof envelope.id === "string" ? envelope.id : "";
      const eventType =
        typeof envelope.event_type === "string" ? envelope.event_type : "";
      if (eventType !== "TRANSACTION.SUCCESS") {
        // Signed non-payment events are acknowledged without touching orders.
        return {
          id,
          eventType,
          appId: "",
          mchId: "",
          outTradeNo: "",
          transactionId: "",
          tradeState: "",
          amountCents: 0,
          currency: "",
        };
      }

      const notification = readNotification(plaintext);
      if (!notification) return null;

      return {
        id,
        eventType,
        ...notification,
      };
    },
  };
}
