import type { StoreRegion } from "./domain";

export type ChinaStoreConfig = {
  appUrl: string;
  port: number;
  region: StoreRegion;
  databaseUrl: string;
  databaseSsl: boolean;
  alipay: {
    appId: string;
    sellerId: string;
    privateKey: string;
    publicKey: string;
    gatewayUrl?: string;
  };
  wechatPay?: {
    appId: string;
    mchId: string;
    serialNo: string;
    privateKey: string;
    apiV3Key: string;
    platformPublicKeys: Record<string, string>;
    gatewayUrl?: string;
  };
  cos: {
    bucket: string;
    region: string;
    secretId: string;
    secretKey: string;
  };
  email: {
    region: string;
    fromEmail: string;
    replyTo?: string;
    secretId: string;
    secretKey: string;
  };
};

function required(env: NodeJS.ProcessEnv, key: string): string {
  const value = env[key]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
}

function firstEnvValue(
  env: NodeJS.ProcessEnv,
  keys: string[]
): string | undefined {
  for (const key of keys) {
    const value = env[key]?.trim();
    if (value) return value;
  }
  return undefined;
}

function readPlatformPublicKeys(
  env: NodeJS.ProcessEnv
): Record<string, string> {
  const rawMap = env.WECHAT_PAY_PLATFORM_PUBLIC_KEYS?.trim();
  if (rawMap) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawMap);
    } catch {
      throw new Error(
        "WECHAT_PAY_PLATFORM_PUBLIC_KEYS must be a JSON object of serial to PEM"
      );
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error(
        "WECHAT_PAY_PLATFORM_PUBLIC_KEYS must be a JSON object of serial to PEM"
      );
    }
    const keys: Record<string, string> = {};
    for (const [serial, pem] of Object.entries(parsed)) {
      if (typeof pem === "string" && pem.trim()) {
        keys[serial.trim()] = pem.trim();
      }
    }
    if (Object.keys(keys).length === 0) {
      throw new Error("WECHAT_PAY_PLATFORM_PUBLIC_KEYS has no usable keys");
    }
    return keys;
  }

  const serial = required(env, "WECHAT_PAY_PLATFORM_SERIAL");
  const publicKey = required(env, "WECHAT_PAY_PLATFORM_PUBLIC_KEY");
  return { [serial]: publicKey };
}

/** Reads deployment configuration once. Secrets stay server-side. */
export function loadConfig(
  env: NodeJS.ProcessEnv = process.env
): ChinaStoreConfig {
  const appUrl = required(env, "APP_URL").replace(/\/+$/, "");
  const regionValue = env.STORE_REGION?.trim() || "mainland";
  if (regionValue !== "mainland" && regionValue !== "international") {
    throw new Error("STORE_REGION must be mainland or international");
  }
  const region: StoreRegion = regionValue;
  const secretId =
    firstEnvValue(env, [
      "TENCENT_SECRET_ID",
      "COS_SECRET_ID",
      "SES_SECRET_ID",
    ]) ?? "";
  const secretKey =
    firstEnvValue(env, [
      "TENCENT_SECRET_KEY",
      "COS_SECRET_KEY",
      "SES_SECRET_KEY",
    ]) ?? "";

  const config: ChinaStoreConfig = {
    appUrl,
    port: Number(env.PORT ?? 3000),
    region,
    databaseUrl: required(env, "DATABASE_URL"),
    databaseSsl: env.DATABASE_SSL === "true",
    alipay: {
      appId: required(env, "ALIPAY_APP_ID"),
      sellerId: required(env, "ALIPAY_SELLER_ID"),
      privateKey: required(env, "ALIPAY_PRIVATE_KEY"),
      publicKey: required(env, "ALIPAY_PUBLIC_KEY"),
      gatewayUrl: env.ALIPAY_GATEWAY_URL?.trim() || undefined,
    },
    wechatPay:
      env.WECHAT_PAY_ENABLED === "true"
        ? {
            appId: required(env, "WECHAT_PAY_APP_ID"),
            mchId: required(env, "WECHAT_PAY_MCH_ID"),
            serialNo: required(env, "WECHAT_PAY_SERIAL_NO"),
            privateKey: required(env, "WECHAT_PAY_PRIVATE_KEY"),
            apiV3Key: required(env, "WECHAT_PAY_API_V3_KEY"),
            platformPublicKeys: readPlatformPublicKeys(env),
            gatewayUrl: env.WECHAT_PAY_GATEWAY_URL?.trim() || undefined,
          }
        : undefined,
    cos: {
      bucket: required(env, "COS_BUCKET"),
      region: env.COS_REGION?.trim() || "ap-guangzhou",
      secretId: required(env, "COS_SECRET_ID"),
      secretKey: required(env, "COS_SECRET_KEY"),
    },
    email: {
      region: env.SES_REGION?.trim() || "ap-guangzhou",
      fromEmail: required(env, "SES_FROM_EMAIL"),
      replyTo: env.SES_REPLY_TO?.trim() || undefined,
      secretId: firstEnvValue(env, ["SES_SECRET_ID"]) ?? secretId,
      secretKey: firstEnvValue(env, ["SES_SECRET_KEY"]) ?? secretKey,
    },
  };

  if (!config.email.secretId || !config.email.secretKey) {
    throw new Error(
      "Missing Tencent Cloud credentials. Set TENCENT_SECRET_ID/TENCENT_SECRET_KEY or COS_/SES_ pairs."
    );
  }
  if (!Number.isInteger(config.port) || config.port <= 0) {
    throw new Error("PORT must be a positive integer");
  }
  return config;
}
