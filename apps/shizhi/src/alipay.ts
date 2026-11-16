type AlipayParams = Record<string, string>;

export type AlipayConfig = {
  appId: string;
  privateKey: string;
  publicKey: string;
  sellerId: string;
  appUrl: string;
  gatewayUrl?: string;
  now?: () => Date;
};

function normalizePem(value: string): string {
  return value.replace(/\\n/g, "\n").trim();
}

function buildSignString(
  params: AlipayParams,
  excludeSignType: boolean
): string {
  return Object.keys(params)
    .filter(
      (key) =>
        key !== "sign" &&
        (!excludeSignType || key !== "sign_type") &&
        params[key] !== ""
    )
    .sort()
    .map((key) => `${key}=${params[key]}`)
    .join("&");
}

/** Notify verification content: Alipay excludes `sign` and `sign_type`. */
export function signString(params: AlipayParams): string {
  return buildSignString(params, true);
}

/** Request signing content: Alipay includes `sign_type`. */
export function requestSignString(params: AlipayParams): string {
  return buildSignString(params, false);
}

/** Alipay timestamps use Beijing time (UTC+8), formatted `yyyy-MM-dd HH:mm:ss`. */
export function alipayTimestamp(date: Date = new Date()): string {
  const beijing = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  return beijing.toISOString().replace("T", " ").slice(0, 19);
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const base64 = normalizePem(pem)
    .replace(/-----BEGIN [^-]+-----/, "")
    .replace(/-----END [^-]+-----/, "")
    .replace(/\s+/g, "");
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

export async function rsaSign(
  privateKeyPem: string,
  data: string
): Promise<string> {
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToArrayBuffer(privateKeyPem),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(data)
  );
  return btoa(String.fromCharCode(...new Uint8Array(signature)));
}

export async function rsaVerify(
  publicKeyPem: string,
  data: string,
  signatureB64: string
): Promise<boolean> {
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "spki",
      pemToArrayBuffer(publicKeyPem),
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
      false,
      ["verify"]
    );
  } catch {
    return false;
  }
  let signature: Uint8Array;
  try {
    signature = Uint8Array.from(atob(signatureB64), (char) =>
      char.charCodeAt(0)
    );
  } catch {
    return false;
  }
  try {
    return await crypto.subtle.verify(
      "RSASSA-PKCS1-v1_5",
      key,
      signature as BufferSource,
      new TextEncoder().encode(data)
    );
  } catch {
    return false;
  }
}

export function createAlipayGateway(config: AlipayConfig) {
  return {
    async createPayment(input: {
      orderId: string;
      product: { title: string; priceCents: number };
      returnUrl: string;
    }): Promise<{ url: string }> {
      const params: AlipayParams = {
        app_id: config.appId,
        method: "alipay.trade.page.pay",
        format: "JSON",
        charset: "utf-8",
        sign_type: "RSA2",
        timestamp: alipayTimestamp(config.now?.() ?? new Date()),
        version: "1.0",
        notify_url: `${config.appUrl.replace(/\/+$/, "")}/api/webhook/alipay`,
        return_url: input.returnUrl,
        biz_content: JSON.stringify({
          out_trade_no: input.orderId,
          product_code: "FAST_INSTANT_TRADE_PAY",
          total_amount: (input.product.priceCents / 100).toFixed(2),
          subject: input.product.title.slice(0, 256),
        }),
      };
      params.sign = await rsaSign(
        config.privateKey,
        requestSignString(params)
      );
      const gateway =
        config.gatewayUrl?.trim() ||
        "https://openapi.alipay.com/gateway.do";
      return { url: `${gateway}?${new URLSearchParams(params).toString()}` };
    },

    async verifyNotification(
      rawBody: string
    ): Promise<URLSearchParams | null> {
      const params = new URLSearchParams(rawBody);
      const sign = params.get("sign");
      const signType = params.get("sign_type");
      if (!sign || signType !== "RSA2") return null;
      const data = signString(Object.fromEntries(params.entries()));
      const ok = await rsaVerify(config.publicKey, data, sign);
      return ok ? params : null;
    },
  };
}
