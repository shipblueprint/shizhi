import { serve } from "@hono/node-server";
import { createChinaStoreApp } from "./app";
import type { AlipayGateway, DeliveryLink, EmailSender } from "./domain";
import {
  MemoryStorage,
  MemoryStore,
  createMemoryWechatPay,
} from "../test/helpers";

/**
 * Local preview with in-memory adapters: no PostgreSQL, no Alipay/COS/SES
 * credentials. Checkout redirects straight to the receipt page and delivery
 * emails are printed to the console.
 */
const port = Number(process.env.PORT ?? 3000);
const appUrl = process.env.APP_URL ?? `http://localhost:${port}`;

const email: EmailSender = {
  async sendDownload(link: DeliveryLink) {
    console.log(
      `[preview email] download -> ${link.to}\n  ${link.title}: ${link.url}`
    );
  },
  async sendAccess(link) {
    console.log(
      `[preview email] access -> ${link.to}\n  ${link.title}: ${link.url ?? ""}`
    );
  },
};

const alipay: AlipayGateway = {
  async createPayment(input) {
    return { url: `${appUrl}/thanks?order=${encodeURIComponent(input.orderId)}` };
  },
  async verifyNotification(rawBody) {
    return new URLSearchParams(rawBody);
  },
};

const app = createChinaStoreApp({
  store: new MemoryStore(),
  storage: new MemoryStorage(),
  email,
  alipay,
  wechatPay: createMemoryWechatPay(),
  region: "mainland",
  appUrl,
  appId: "2021000000000000",
  sellerId: "2088000000000000",
});

serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => {
  console.log(`preview: ${appUrl} (in-memory, no Postgres/providers)`);
  console.log(`open ${appUrl}/ and ${appUrl}/store`);
});
