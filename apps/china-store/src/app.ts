import { Hono } from "hono";
import type { Context } from "hono";
import QRCode from "qrcode";
import { CATALOG, type CatalogSku } from "@repo/catalog";
import {
  getChinaCatalog,
  isAlipayEnabled,
  isChinaPaidSku,
  isFreeCatalogSku,
  isWechatEnabled,
  resolveChinaSku,
} from "./catalog";
import type { ChinaPaymentMethod } from "./catalog";
import type { ChinaStoreDeps, Order, OrderProvider } from "./domain";
import { buildReceiptState } from "./receipt";
import {
  renderHome,
  renderLegal,
  renderNotFound,
  renderProduct,
  renderReceipt,
  renderStore,
  renderFamily,
  renderWechatPay,
} from "./views";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ORDER_REFERENCE_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/;
const DEFAULT_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
const DEFAULT_MAX_DOWNLOADS = 5;

function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  return email.length <= 254 && EMAIL_PATTERN.test(email) ? email : null;
}

function normalizeOrderId(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return ORDER_REFERENCE_PATTERN.test(id) ? id : null;
}

function parseCnyToCents(value: string | null): number | null {
  if (value == null) return null;
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(value.trim());
  if (!match) return null;
  const yuan = Number(match[1]);
  const fraction = Number((match[2] ?? "").padEnd(2, "0"));
  const cents = yuan * 100 + fraction;
  return Number.isSafeInteger(cents) ? cents : null;
}

export function randomHex(bytes: number): string {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return [...buffer].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function hashToken(token: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(token)
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function deliveryUrl(appUrl: string, token: string): string {
  return `${appUrl.replace(/\/+$/, "")}/download/${token}`;
}

function contentDisposition(filename: string | undefined): string {
  const safe = (filename ?? "download").replace(/[^A-Za-z0-9._-]/g, "_");
  return `attachment; filename="${safe || "download"}"`;
}

async function readStringBody(
  c: Context
): Promise<Record<string, unknown>> {
  const contentType = c.req.header("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const value: unknown = await c.req.json();
      return value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : {};
    } catch {
      return {};
    }
  }
  const form = await c.req.parseBody();
  return form as Record<string, unknown>;
}

export function createChinaStoreApp(deps: ChinaStoreDeps) {
  const app = new Hono();
  const now = deps.now ?? (() => Math.floor(Date.now() / 1000));
  const newOrderId = deps.newOrderId ?? (() => `cn_${randomHex(12)}`);
  const newToken = deps.newToken ?? (() => randomHex(32));
  const tokenTtl = deps.tokenTtlSeconds ?? DEFAULT_TOKEN_TTL_SECONDS;
  const maxDownloads = deps.maxDownloads ?? DEFAULT_MAX_DOWNLOADS;

  async function deliver(order: Order, sku: CatalogSku): Promise<void> {
    if (sku.fulfillment === "file_download") {
      if (!sku.fileKey) throw new Error("Catalog file key missing");
      const token = newToken();
      const tokenHash = await hashToken(token);
      await deps.store.createDownloadToken({
        tokenHash,
        orderId: order.id,
        productId: order.productId,
        expiresAt: now() + tokenTtl,
        maxDownloads,
        createdAt: now(),
      });
      try {
        await deps.email.sendDownload({
          to: order.email,
          title: sku.title,
          url: deliveryUrl(deps.appUrl, token),
        });
      } catch (error) {
        // Keep retries clean: a token without an email is unreachable, so
        // remove it before the payment provider retries the notification.
        await deps.store.deleteDownloadToken(tokenHash).catch((cleanupError) => {
          console.error("failed to remove undelivered token", cleanupError);
        });
        throw error;
      }
      return;
    }

    if (
      sku.fulfillment === "external_access" ||
      sku.fulfillment === "email_delivery"
    ) {
      await deps.email.sendAccess({
        to: order.email,
        title: sku.title,
        url: sku.externalUrl,
      });
      return;
    }

    throw new Error("Product has no delivery target");
  }

  async function ensureDelivery(order: Order): Promise<void> {
    const sku = resolveChinaSku(order.productId);
    if (!sku || !isChinaPaidSku(sku)) return;
    if (sku.fulfillment !== "file_download") return;
    const existing = await deps.store.getDownloadTokenForOrder(order.id);
    if (!existing) await deliver(order, sku);
  }

  function paymentMethods(
    sku: CatalogSku
  ): Record<ChinaPaymentMethod, boolean> {
    const paid = isChinaPaidSku(sku);
    return {
      alipay: paid && isAlipayEnabled(sku),
      wechat:
        paid &&
        deps.region === "mainland" &&
        Boolean(deps.wechatPay) &&
        isWechatEnabled(sku),
    };
  }

  function catalogOptions() {
    return {
      wechatAvailable:
        deps.region === "mainland" && Boolean(deps.wechatPay),
    };
  }

  async function beginCheckout(input: {
    productId: unknown;
    email: unknown;
    provider?: unknown;
  }): Promise<
    | { ok: true; provider: "alipay"; redirectUrl: string }
    | {
        ok: true;
        provider: "wechat";
        orderId: string;
        codeUrl: string;
        qrSvg: string;
      }
    | { ok: false; message: string; sku?: CatalogSku }
  > {
    const productId =
      typeof input.productId === "string" ? input.productId.trim() : "";
    const sku = resolveChinaSku(productId);
    if (!sku || isFreeCatalogSku(sku)) {
      return { ok: false, message: "商品不存在或暂不可购买。" };
    }
    const requestedProvider =
      input.provider == null || input.provider === ""
        ? "alipay"
        : input.provider;
    if (requestedProvider !== "alipay" && requestedProvider !== "wechat") {
      return { ok: false, message: "不支持的付款方式。", sku };
    }
    const provider: OrderProvider = requestedProvider;
    const email = normalizeEmail(input.email);
    if (!email) {
      return { ok: false, message: "请输入有效的邮箱地址。", sku };
    }
    if (!isChinaPaidSku(sku)) {
      return { ok: false, message: "该商品暂不可购买。", sku };
    }
    if (provider === "alipay" && !isAlipayEnabled(sku)) {
      return { ok: false, message: "该商品暂不支持支付宝付款。", sku };
    }
    if (provider === "wechat" && !paymentMethods(sku).wechat) {
      return { ok: false, message: "该商品暂不支持微信支付。", sku };
    }

    const orderId = newOrderId();
    if (!normalizeOrderId(orderId)) {
      return { ok: false, message: "无法创建订单，请稍后重试。", sku };
    }

    await deps.store.createOrder({
      id: orderId,
      provider,
      productId: sku.id,
      email,
      amountCents: sku.priceCents,
      createdAt: now(),
    });

    if (provider === "wechat") {
      const gateway = deps.wechatPay;
      if (!gateway) {
        return { ok: false, message: "微信支付暂时不可用，请稍后重试。", sku };
      }
      try {
        const payment = await gateway.createPayment({
          orderId,
          product: { title: sku.title, priceCents: sku.priceCents },
        });
        const qrSvg = await QRCode.toString(payment.codeUrl, {
          type: "svg",
          margin: 1,
          width: 240,
        });
        return {
          ok: true,
          provider: "wechat",
          orderId,
          codeUrl: payment.codeUrl,
          qrSvg,
        };
      } catch (error) {
        console.error("wechat pay checkout failed", error);
        return { ok: false, message: "微信支付暂时不可用，请稍后重试。", sku };
      }
    }

    try {
      const payment = await deps.alipay.createPayment({
        orderId,
        product: { title: sku.title, priceCents: sku.priceCents },
        returnUrl: `${deps.appUrl.replace(/\/+$/, "")}/thanks?order=${encodeURIComponent(orderId)}`,
      });
      return { ok: true, provider: "alipay", redirectUrl: payment.url };
    } catch (error) {
      console.error("alipay checkout failed", error);
      return { ok: false, message: "支付宝暂时不可用，请稍后重试。", sku };
    }
  }

  app.get("/", (c) =>
    c.html(renderHome(getChinaCatalog(CATALOG, catalogOptions())))
  );
  app.get("/store", (c) =>
    c.html(renderStore(getChinaCatalog(CATALOG, catalogOptions())))
  );
  app.get("/courses", (c) =>
    c.html(renderFamily("course", getChinaCatalog(CATALOG, catalogOptions())))
  );
  app.get("/books", (c) =>
    c.html(renderFamily("book", getChinaCatalog(CATALOG, catalogOptions())))
  );
  app.get("/templates", (c) =>
    c.html(renderFamily("template", getChinaCatalog(CATALOG, catalogOptions())))
  );

  app.get("/product/:id", (c) => {
    const sku = resolveChinaSku(c.req.param("id"));
    if (!sku) return c.html(renderNotFound("商品不存在或已下架。"), 404);
    const payments = paymentMethods(sku);
    if (!isFreeCatalogSku(sku) && !payments.alipay && !payments.wechat) {
      return c.html(renderNotFound("商品不存在或已下架。"), 404);
    }
    return c.html(renderProduct({ sku, payments }));
  });

  app.post("/checkout", async (c) => {
    const body = await readStringBody(c);
    const result = await beginCheckout({
      productId: body.productId,
      email: body.email,
      provider: body.provider,
    });
    if (!result.ok) {
      if (result.sku) {
        return c.html(
          renderProduct({
            sku: result.sku,
            error: result.message,
            payments: paymentMethods(result.sku),
          }),
          400
        );
      }
      return c.html(renderNotFound(result.message), 404);
    }
    if (result.provider === "wechat") {
      return c.html(
        renderWechatPay({
          orderId: result.orderId,
          codeUrl: result.codeUrl,
          qrSvg: result.qrSvg,
        })
      );
    }
    return c.redirect(result.redirectUrl, 303);
  });

  app.post("/api/checkout/alipay", async (c) => {
    const body = await readStringBody(c);
    const result = await beginCheckout({
      productId: body.productId,
      email: body.email,
      provider: "alipay",
    });
    if (!result.ok) {
      return c.json(
        { error: result.message },
        result.sku ? 400 : 404
      );
    }
    if (result.provider !== "alipay") {
      return c.json({ error: "不支持的付款方式。" }, 400);
    }
    return c.json({ url: result.redirectUrl });
  });

  app.post("/api/checkout/wechat", async (c) => {
    const body = await readStringBody(c);
    const result = await beginCheckout({
      productId: body.productId,
      email: body.email,
      provider: "wechat",
    });
    if (!result.ok) {
      return c.json(
        { error: result.message },
        result.sku ? 400 : 404
      );
    }
    if (result.provider !== "wechat") {
      return c.json({ error: "不支持的付款方式。" }, 400);
    }
    return c.json({
      orderId: result.orderId,
      codeUrl: result.codeUrl,
      qrSvg: result.qrSvg,
    });
  });

  app.post("/api/webhook/alipay", async (c) => {
    let params: URLSearchParams | null;
    try {
      params = await deps.alipay.verifyNotification(await c.req.text());
    } catch (error) {
      console.error("alipay notification verification failed", error);
      return c.text("fail", 400);
    }
    if (!params) return c.text("fail", 400);

    const pick = (key: string) => params?.get(key)?.trim() ?? "";
    if (
      pick("app_id") !== deps.appId ||
      pick("seller_id") !== deps.sellerId ||
      pick("notify_type") !== "trade_status_sync"
    ) {
      return c.text("fail", 400);
    }

    const status = pick("trade_status");
    if (status !== "TRADE_SUCCESS" && status !== "TRADE_FINISHED") {
      return c.text("success", 200);
    }

    const orderId = normalizeOrderId(pick("out_trade_no"));
    const providerOrderId = pick("trade_no");
    if (!orderId || !providerOrderId) return c.text("fail", 400);

    const order = await deps.store.getOrder(orderId);
    if (!order || order.provider !== "alipay") {
      return c.text("fail", 400);
    }
    if (order.currency !== "CNY") return c.text("fail", 400);

    const notifiedCurrency = pick("currency");
    if (notifiedCurrency && notifiedCurrency.toUpperCase() !== "CNY") {
      return c.text("fail", 400);
    }

    const paidCents = parseCnyToCents(params.get("total_amount"));
    if (paidCents == null || paidCents !== order.amountCents) {
      return c.text("fail", 400);
    }

    // Alipay retries notifications. A paid order is acknowledged without
    // issuing a second download token or sending a second email. If the first
    // delivery never completed, finish it now.
    if (order.status === "paid") {
      try {
        await ensureDelivery(order);
        return c.text("success", 200);
      } catch (error) {
        console.error("alipay retry delivery failed", error);
        return c.text("fail", 500);
      }
    }

    const sku = resolveChinaSku(order.productId);
    if (
      !sku ||
      !isChinaPaidSku(sku) ||
      !isAlipayEnabled(sku) ||
      sku.fulfillment === "none"
    ) {
      return c.text("fail", 400);
    }

    try {
      const marked = await deps.store.markPaid({
        orderId: order.id,
        provider: "alipay",
        providerOrderId,
        updatedAt: now(),
      });
      if (!marked) return c.text("success", 200);

      const paidOrder: Order = {
        ...order,
        status: "paid",
        providerOrderId,
        updatedAt: now(),
      };
      await deliver(paidOrder, sku);
      return c.text("success", 200);
    } catch (error) {
      console.error("alipay delivery failed", error);
      return c.text("fail", 500);
    }
  });

  app.post("/api/webhook/wechat", async (c) => {
    const gateway = deps.wechatPay;
    if (!gateway) {
      return c.json({ code: "FAIL", message: "not configured" }, 404);
    }

    let notification;
    try {
      notification = await gateway.verifyNotification(
        c.req.raw.headers,
        await c.req.text()
      );
    } catch (error) {
      console.error("wechat notification verification failed", error);
      return c.json({ code: "FAIL", message: "invalid notification" }, 400);
    }
    if (!notification) {
      return c.json({ code: "FAIL", message: "invalid notification" }, 400);
    }

    if (notification.eventType !== "TRANSACTION.SUCCESS") {
      return c.json({ code: "SUCCESS", message: "成功" }, 200);
    }

    if (
      notification.appId !== gateway.appId ||
      notification.mchId !== gateway.mchId
    ) {
      return c.json({ code: "FAIL", message: "invalid merchant" }, 400);
    }
    if (notification.tradeState !== "SUCCESS") {
      return c.json({ code: "SUCCESS", message: "成功" }, 200);
    }

    const orderId = normalizeOrderId(notification.outTradeNo);
    if (!orderId || !notification.transactionId) {
      return c.json({ code: "FAIL", message: "invalid transaction" }, 400);
    }

    const order = await deps.store.getOrder(orderId);
    if (!order || order.provider !== "wechat") {
      return c.json({ code: "FAIL", message: "unknown order" }, 400);
    }
    if (order.currency !== "CNY") {
      return c.json({ code: "FAIL", message: "invalid currency" }, 400);
    }
    if (
      notification.currency.toUpperCase() !== "CNY" ||
      notification.amountCents !== order.amountCents
    ) {
      return c.json({ code: "FAIL", message: "amount mismatch" }, 400);
    }

    // WeChat retries notifications. A paid order is acknowledged without
    // issuing a second download token or sending a second email. If the first
    // delivery never completed, finish it now.
    if (order.status === "paid") {
      if (
        order.providerOrderId &&
        order.providerOrderId !== notification.transactionId
      ) {
        console.error("wechat duplicate payment for order", order.id);
        return c.json({ code: "FAIL", message: "transaction mismatch" }, 400);
      }
      try {
        await ensureDelivery(order);
        return c.json({ code: "SUCCESS", message: "成功" }, 200);
      } catch (error) {
        console.error("wechat retry delivery failed", error);
        return c.json({ code: "FAIL", message: "delivery failed" }, 500);
      }
    }

    const sku = resolveChinaSku(order.productId);
    if (
      !sku ||
      !isChinaPaidSku(sku) ||
      !isWechatEnabled(sku) ||
      deps.region !== "mainland" ||
      sku.fulfillment === "none"
    ) {
      return c.json({ code: "FAIL", message: "sku unavailable" }, 400);
    }

    try {
      const marked = await deps.store.markPaid({
        orderId: order.id,
        provider: "wechat",
        providerOrderId: notification.transactionId,
        updatedAt: now(),
      });
      if (!marked) {
        return c.json({ code: "SUCCESS", message: "成功" }, 200);
      }

      const paidOrder: Order = {
        ...order,
        status: "paid",
        providerOrderId: notification.transactionId,
        updatedAt: now(),
      };
      await deliver(paidOrder, sku);
      return c.json({ code: "SUCCESS", message: "成功" }, 200);
    } catch (error) {
      console.error("wechat delivery failed", error);
      return c.json({ code: "FAIL", message: "delivery failed" }, 500);
    }
  });

  app.get("/download/:token", async (c) => {
    const token = c.req.param("token");
    if (!TOKEN_PATTERN.test(token)) {
      return c.text("Download link not found", 404);
    }

    const tokenHash = await hashToken(token);
    const record = await deps.store.getDownloadToken(tokenHash);
    if (!record) return c.text("Download link not found", 404);

    const order = await deps.store.getOrder(record.orderId);
    if (
      !order ||
      order.status !== "paid" ||
      order.productId !== record.productId
    ) {
      return c.text("Download link not found", 404);
    }

    const currentTime = now();
    if (currentTime >= record.expiresAt) {
      return c.text("Download link expired", 410);
    }
    if (record.downloads >= record.maxDownloads) {
      return c.text("Download limit reached", 429);
    }

    const sku = resolveChinaSku(record.productId);
    if (!sku || !sku.fileKey) {
      return c.text("Download link not found", 404);
    }

    const stored = await deps.storage.get(sku.fileKey);
    if (stored.kind === "missing") {
      return c.text("File not found", 404);
    }
    if (stored.kind === "unavailable") {
      return c.text("File temporarily unavailable", 502);
    }

    const consumed = await deps.store.consumeDownload(tokenHash, currentTime);
    if (!consumed) return c.text("Download limit reached", 429);

    return new Response(stored.object.body as BodyInit, {
      status: 200,
      headers: {
        "content-type": stored.object.contentType,
        "content-length": String(
          stored.object.contentLength ?? stored.object.body.byteLength
        ),
        "content-disposition": contentDisposition(sku.filename),
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  });

  app.get("/thanks", async (c) => {
    const orderId = normalizeOrderId(c.req.query("order"));
    const order = orderId ? await deps.store.getOrder(orderId) : null;
    return c.html(
      renderReceipt(buildReceiptState(order), orderId ?? "未提供")
    );
  });

  app.post("/api/delivery/resend", async (c) => {
    const body = await readStringBody(c);
    const orderId = normalizeOrderId(body.orderId);
    const email = normalizeEmail(body.email);
    if (!orderId || !email) {
      return c.json({ error: "订单号和邮箱不能为空。" }, 400);
    }
    const order = await deps.store.getOrder(orderId);
    if (!order || order.email !== email) {
      return c.json({ error: "订单号和邮箱不匹配。" }, 404);
    }
    if (order.status !== "paid") {
      return c.json({ error: "订单尚未付款。" }, 409);
    }
    const sku = resolveChinaSku(order.productId);
    if (!sku || sku.fulfillment === "none") {
      return c.json({ error: "商品已下架，无法补发。" }, 404);
    }
    try {
      await deliver(order, sku);
      return c.json({ ok: true });
    } catch (error) {
      console.error("delivery resend failed", error);
      return c.json({ error: "补发失败，请稍后重试。" }, 500);
    }
  });

  app.get("/terms", (c) => c.html(renderLegal("terms")));
  app.get("/privacy", (c) => c.html(renderLegal("privacy")));
  app.get("/refund", (c) => c.html(renderLegal("refund")));
  app.get("/healthz", (c) => c.json({ ok: true }));

  app.get("*", (c) => c.html(renderNotFound(), 404));

  app.onError((error, c) => {
    console.error("china store request failed", error);
    return c.text("Internal error", 500);
  });

  return app;
}
