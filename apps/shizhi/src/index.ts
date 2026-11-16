import { serve } from "@hono/node-server";
import { Pool } from "pg";
import { createAlipayGateway } from "./alipay";
import { createChinaStoreApp } from "./app";
import { loadConfig } from "./config";
import { createTencentEmail } from "./email";
import { createCosStorage } from "./storage";
import { createPostgresStore } from "./store";
import { createWechatPayGateway } from "./wechat";

const config = loadConfig();
const pool = new Pool({
  connectionString: config.databaseUrl,
  ssl: config.databaseSsl ? { rejectUnauthorized: false } : undefined,
  max: 10,
});

const app = createChinaStoreApp({
  store: createPostgresStore(pool),
  storage: createCosStorage(config.cos),
  email: createTencentEmail(config.email),
  alipay: createAlipayGateway({
    ...config.alipay,
    appUrl: config.appUrl,
  }),
  wechatPay: config.wechatPay
    ? createWechatPayGateway({
        ...config.wechatPay,
        appUrl: config.appUrl,
      })
    : undefined,
  region: config.region,
  appUrl: config.appUrl,
  appId: config.alipay.appId,
  sellerId: config.alipay.sellerId,
});

const server = serve(
  {
    fetch: app.fetch,
    port: config.port,
    hostname: "0.0.0.0",
  },
  (info) => {
    console.log(`shizhi listening on ${info.address}:${info.port}`);
  }
);

async function shutdown(signal: string): Promise<void> {
  console.log(`shizhi shutting down after ${signal}`);
  server.close(() => {
    void pool.end().then(() => process.exit(0));
  });
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
