import COS from "cos-nodejs-sdk-v5";
import type { FileStorage, StorageResult } from "./domain";

export type CosStorageConfig = {
  bucket: string;
  region: string;
  secretId: string;
  secretKey: string;
  client?: Pick<COS, "getObject">;
};

function validFileKey(fileKey: string): boolean {
  const segments = fileKey.split("/");
  return (
    fileKey.length > 0 &&
    !fileKey.startsWith("/") &&
    segments.every(
      (segment) => segment.length > 0 && segment !== "." && segment !== ".."
    )
  );
}

/**
 * Files stay private in Tencent COS. The storefront proxies each download
 * after its own token, order, expiry and download-count checks.
 */
export function createCosStorage(config: CosStorageConfig): FileStorage {
  const client =
    config.client ??
    new COS({ SecretId: config.secretId, SecretKey: config.secretKey });

  return {
    async get(fileKey: string): Promise<StorageResult> {
      if (!validFileKey(fileKey)) return { kind: "missing" };
      try {
        const result = await client.getObject({
          Bucket: config.bucket,
          Region: config.region,
          Key: fileKey,
        });
        const body = new Uint8Array(result.Body);
        const contentType =
          typeof result.headers?.["content-type"] === "string"
            ? result.headers["content-type"]
            : "application/octet-stream";
        return {
          kind: "ok",
          object: {
            body,
            contentType,
            contentLength: body.byteLength,
          },
        };
      } catch (error) {
        const statusCode =
          typeof error === "object" && error != null && "statusCode" in error
            ? Number(error.statusCode)
            : 0;
        const code =
          typeof error === "object" && error != null && "code" in error
            ? String(error.code)
            : "";
        if (statusCode === 404 || code === "NoSuchKey") {
          return { kind: "missing" };
        }
        console.error("cos getObject failed", fileKey, statusCode, code);
        return { kind: "unavailable" };
      }
    },
  };
}
