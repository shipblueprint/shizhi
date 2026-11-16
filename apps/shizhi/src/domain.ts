export type OrderStatus = "pending" | "paid" | "refunded" | "failed";
export type OrderProvider = "alipay" | "wechat";
export type StoreRegion = "mainland" | "international";

export type Order = {
  id: string;
  provider: OrderProvider;
  providerOrderId: string | null;
  productId: string;
  email: string;
  amountCents: number;
  currency: "CNY";
  status: OrderStatus;
  createdAt: number;
  updatedAt: number;
};

export type DownloadToken = {
  tokenHash: string;
  orderId: string;
  productId: string;
  expiresAt: number;
  maxDownloads: number;
  downloads: number;
};

export type CreateOrderInput = {
  id: string;
  provider: OrderProvider;
  productId: string;
  email: string;
  amountCents: number;
  createdAt: number;
};

export type MarkPaidInput = {
  orderId: string;
  provider: OrderProvider;
  providerOrderId: string;
  updatedAt: number;
};

export type CreateDownloadTokenInput = {
  tokenHash: string;
  orderId: string;
  productId: string;
  expiresAt: number;
  maxDownloads: number;
  createdAt: number;
};

export interface OrderStore {
  createOrder(input: CreateOrderInput): Promise<void>;
  getOrder(id: string): Promise<Order | null>;
  markPaid(input: MarkPaidInput): Promise<boolean>;
  createDownloadToken(input: CreateDownloadTokenInput): Promise<void>;
  getDownloadToken(tokenHash: string): Promise<DownloadToken | null>;
  getDownloadTokenForOrder(orderId: string): Promise<DownloadToken | null>;
  deleteDownloadToken(tokenHash: string): Promise<void>;
  consumeDownload(tokenHash: string, now: number): Promise<boolean>;
}

export type StorageObject = {
  body: Uint8Array;
  contentType: string;
  contentLength?: number;
};

export type StorageResult =
  | { kind: "ok"; object: StorageObject }
  | { kind: "missing" }
  | { kind: "unavailable" };

export interface FileStorage {
  get(fileKey: string): Promise<StorageResult>;
}

export type DeliveryLink = {
  to: string;
  title: string;
  url: string;
};

export interface EmailSender {
  sendDownload(link: DeliveryLink): Promise<void>;
  sendAccess(link: Omit<DeliveryLink, "url"> & { url?: string }): Promise<void>;
}

export type AlipayPaymentInput = {
  orderId: string;
  product: { title: string; priceCents: number };
  returnUrl: string;
};

export interface AlipayGateway {
  createPayment(input: AlipayPaymentInput): Promise<{ url: string }>;
  verifyNotification(rawBody: string): Promise<URLSearchParams | null>;
}

export type WechatPaymentInput = {
  orderId: string;
  product: { title: string; priceCents: number };
};

export type WechatNotification = {
  id: string;
  eventType: string;
  appId: string;
  mchId: string;
  outTradeNo: string;
  transactionId: string;
  tradeState: string;
  amountCents: number;
  currency: string;
};

export interface WechatPayGateway {
  readonly appId: string;
  readonly mchId: string;
  createPayment(input: WechatPaymentInput): Promise<{ codeUrl: string }>;
  verifyNotification(
    headers: Headers | Record<string, string | undefined>,
    rawBody: string
  ): Promise<WechatNotification | null>;
}

export type ChinaStoreDeps = {
  store: OrderStore;
  storage: FileStorage;
  email: EmailSender;
  alipay: AlipayGateway;
  wechatPay?: WechatPayGateway;
  region: StoreRegion;
  appUrl: string;
  appId: string;
  sellerId: string;
  now?: () => number;
  newOrderId?: () => string;
  newToken?: () => string;
  tokenTtlSeconds?: number;
  maxDownloads?: number;
};
