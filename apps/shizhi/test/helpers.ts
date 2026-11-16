import type {
  AlipayGateway,
  CreateDownloadTokenInput,
  CreateOrderInput,
  DownloadToken,
  EmailSender,
  FileStorage,
  MarkPaidInput,
  Order,
  OrderStore,
  StorageResult,
  WechatNotification,
  WechatPayGateway,
} from "../src/domain";
import { createChinaStoreApp } from "../src/app";

export class MemoryStore implements OrderStore {
  readonly orders = new Map<string, Order>();
  readonly tokens = new Map<string, DownloadToken>();
  markPaidCalls = 0;

  async createOrder(input: CreateOrderInput): Promise<void> {
    this.orders.set(input.id, {
      id: input.id,
      provider: input.provider,
      providerOrderId: null,
      productId: input.productId,
      email: input.email,
      amountCents: input.amountCents,
      currency: "CNY",
      status: "pending",
      createdAt: input.createdAt,
      updatedAt: input.createdAt,
    });
  }

  async getOrder(id: string): Promise<Order | null> {
    return this.orders.get(id) ?? null;
  }

  async markPaid(input: MarkPaidInput): Promise<boolean> {
    this.markPaidCalls += 1;
    const order = this.orders.get(input.orderId);
    if (
      !order ||
      order.status !== "pending" ||
      order.provider !== input.provider
    ) {
      return false;
    }
    this.orders.set(input.orderId, {
      ...order,
      status: "paid",
      providerOrderId: input.providerOrderId,
      updatedAt: input.updatedAt,
    });
    return true;
  }

  async createDownloadToken(
    input: CreateDownloadTokenInput
  ): Promise<void> {
    this.tokens.set(input.tokenHash, {
      tokenHash: input.tokenHash,
      orderId: input.orderId,
      productId: input.productId,
      expiresAt: input.expiresAt,
      maxDownloads: input.maxDownloads,
      downloads: 0,
    });
  }

  async getDownloadToken(tokenHash: string): Promise<DownloadToken | null> {
    return this.tokens.get(tokenHash) ?? null;
  }

  async getDownloadTokenForOrder(
    orderId: string
  ): Promise<DownloadToken | null> {
    for (const token of this.tokens.values()) {
      if (token.orderId === orderId) return token;
    }
    return null;
  }

  async deleteDownloadToken(tokenHash: string): Promise<void> {
    this.tokens.delete(tokenHash);
  }

  async consumeDownload(tokenHash: string, now: number): Promise<boolean> {
    const token = this.tokens.get(tokenHash);
    if (!token) return false;
    if (now >= token.expiresAt || token.downloads >= token.maxDownloads) {
      return false;
    }
    this.tokens.set(tokenHash, {
      ...token,
      downloads: token.downloads + 1,
    });
    return true;
  }
}

export class MemoryStorage implements FileStorage {
  readonly requestedKeys: string[] = [];
  unavailable = false;
  missing = false;

  async get(fileKey: string): Promise<StorageResult> {
    this.requestedKeys.push(fileKey);
    if (this.missing) return { kind: "missing" };
    if (this.unavailable) return { kind: "unavailable" };
    const body = new TextEncoder().encode(`file:${fileKey}`);
    return {
      kind: "ok",
      object: {
        body,
        contentType: "application/pdf",
        contentLength: body.byteLength,
      },
    };
  }
}

export type SentEmail = {
  kind: "download" | "access";
  to: string;
  title: string;
  url?: string;
};

export function createMemoryEmail(): EmailSender & {
  sent: SentEmail[];
  failNext: boolean;
} {
  const sent: SentEmail[] = [];
  return {
    sent,
    failNext: false,
    async sendDownload({ to, title, url }) {
      if (this.failNext) {
        this.failNext = false;
        throw new Error("simulated email failure");
      }
      sent.push({ kind: "download", to, title, url });
    },
    async sendAccess({ to, title, url }) {
      if (this.failNext) {
        this.failNext = false;
        throw new Error("simulated email failure");
      }
      sent.push({ kind: "access", to, title, url });
    },
  };
}

export type MemoryWechatPay = WechatPayGateway & {
  payments: Array<{
    orderId: string;
    title: string;
    priceCents: number;
  }>;
  failVerification: "signature" | "decrypt" | null;
};

export function createMemoryWechatPay(): MemoryWechatPay {
  const payments: MemoryWechatPay["payments"] = [];
  const gateway = {
    appId: "wx_test_app",
    mchId: "1900000109",
    payments,
    failVerification: null as "signature" | "decrypt" | null,
    async createPayment(input: {
      orderId: string;
      product: { title: string; priceCents: number };
    }) {
      payments.push({
        orderId: input.orderId,
        title: input.product.title,
        priceCents: input.product.priceCents,
      });
      return {
        codeUrl: `weixin://wxpay/bizpayurl?pr=${input.orderId}`,
      };
    },
    async verifyNotification(
      _headers: Headers | Record<string, string | undefined>,
      rawBody: string
    ): Promise<WechatNotification | null> {
      if (gateway.failVerification) return null;
      const parsed: unknown = JSON.parse(rawBody);
      if (!parsed || typeof parsed !== "object") return null;
      return parsed as WechatNotification;
    },
  };
  return gateway;
}

export function createHarness(options?: {
  now?: number;
  maxDownloads?: number;
  tokenTtlSeconds?: number;
  region?: "mainland" | "international";
  wechatPay?: boolean;
}) {
  const store = new MemoryStore();
  const storage = new MemoryStorage();
  const email = createMemoryEmail();
  const wechat = options?.wechatPay ? createMemoryWechatPay() : undefined;
  const payments: Array<{
    orderId: string;
    title: string;
    priceCents: number;
    returnUrl: string;
  }> = [];
  let orderCounter = 0;
  let tokenCounter = 0;
  let now = options?.now ?? 1_800_000_000;

  const alipay: AlipayGateway = {
    async createPayment(input) {
      payments.push({
        orderId: input.orderId,
        title: input.product.title,
        priceCents: input.product.priceCents,
        returnUrl: input.returnUrl,
      });
      return { url: `https://alipay.test/pay?order=${input.orderId}` };
    },
    async verifyNotification(rawBody) {
      return new URLSearchParams(rawBody);
    },
  };

  const app = createChinaStoreApp({
    store,
    storage,
    email,
    alipay,
    wechatPay: wechat,
    region: options?.region ?? "mainland",
    appUrl: "https://cn.example.test",
    appId: "2021000000000000",
    sellerId: "2088000000000000",
    now: () => now,
    newOrderId: () => `cn_test_${++orderCounter}`,
    newToken: () => `${(++tokenCounter).toString(16)}`.padStart(64, "a"),
    tokenTtlSeconds: options?.tokenTtlSeconds ?? 30 * 24 * 60 * 60,
    maxDownloads: options?.maxDownloads ?? 5,
  });

  return {
    app,
    store,
    storage,
    email,
    payments,
    wechat,
    get now() {
      return now;
    },
    setNow(value: number) {
      now = value;
    },
  };
}

export function notifyBody(
  input: Partial<{
    orderId: string;
    tradeNo: string;
    amount: string;
    currency: string;
    status: string;
    appId: string;
    sellerId: string;
    notifyType: string;
  }> = {}
): string {
  return new URLSearchParams({
    app_id: input.appId ?? "2021000000000000",
    seller_id: input.sellerId ?? "2088000000000000",
    notify_type: input.notifyType ?? "trade_status_sync",
    out_trade_no: input.orderId ?? "cn_test_1",
    trade_no: input.tradeNo ?? "2026110922000000000001",
    total_amount: input.amount ?? "29.00",
    trade_status: input.status ?? "TRADE_SUCCESS",
    currency: input.currency ?? "CNY",
    sign_type: "RSA2",
    sign: "test",
  }).toString();
}

export async function startCheckout(
  app: ReturnType<typeof createHarness>["app"],
  productId = "book-guide-ebook-cny",
  email = "buyer@example.com"
) {
  return app.request("/api/checkout/alipay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productId, email }),
  });
}

export async function startWechatCheckout(
  app: ReturnType<typeof createHarness>["app"],
  productId = "book-guide-ebook-cny",
  email = "buyer@example.com"
) {
  return app.request("/api/checkout/wechat", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ productId, email }),
  });
}

export function wechatNotificationBody(
  input: Partial<{
    orderId: string;
    transactionId: string;
    amountCents: number;
    currency: string;
    appId: string;
    mchId: string;
    eventType: string;
    tradeState: string;
  }> = {}
): string {
  return JSON.stringify({
    id: "evt_1",
    eventType: input.eventType ?? "TRANSACTION.SUCCESS",
    appId: input.appId ?? "wx_test_app",
    mchId: input.mchId ?? "1900000109",
    outTradeNo: input.orderId ?? "cn_test_1",
    transactionId: input.transactionId ?? "4200000000000000001",
    tradeState: input.tradeState ?? "SUCCESS",
    amountCents: input.amountCents ?? 2900,
    currency: input.currency ?? "CNY",
  });
}
