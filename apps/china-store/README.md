# China storefront

Separate mainland-China storefront for CNY offers. It reads the shared catalog
from `@repo/catalog` and does not import Cloudflare Worker code.

## What it does

- Lists free assets and live CNY offers.
- Creates pending Alipay orders and WeChat Pay API v3 Native orders in CNY.
- Shows WeChat Pay only for mainland traffic, opted-in SKUs and a configured
  merchant. Every other combination is hidden and rejected server-side.
- Verifies Alipay RSA2 notifications, app id, seller id, amount, currency and
  trade status.
- Verifies WeChat Pay API v3 signatures, decrypts AES-256-GCM resources and
  validates app id, merchant id, amount, currency and trade state.
- Handles duplicate notifications without issuing another token or email.
- Stores files privately in Tencent COS and proxies tokenized downloads.
- Enforces 30-day expiry and 5 downloads per token by default.
- Sends delivery email through Tencent Cloud SES.
- Serves receipt, terms, privacy and refund pages.

## Local development

```bash
cp apps/china-store/.env.example apps/china-store/.env
# fill in PostgreSQL, Alipay, COS and SES values
set -a; . apps/china-store/.env; set +a
bun run --filter china-store db:migrate
bun run --filter china-store dev
```

Run the tests without live providers:

```bash
bun run --filter china-store test
bun run --filter china-store typecheck
```

Preview the storefront with in-memory adapters (no PostgreSQL, Alipay, COS or
SES). Checkout redirects to the receipt page and delivery emails print to the
console:

```bash
bun run --filter china-store preview
# open http://localhost:3000
```

## Database

Apply `migrations/0001_init.sql` before the first deployment. The schema keeps
orders and hashed download tokens. It never stores a plaintext download token.

Download tokens are 32 random bytes. Only the SHA-256 hash is persisted. The
browser receives the token in the email link.

## Deployment

The app is a Hono server. It listens on `PORT` and is intended for a
Tencent CloudBase CloudRun container or an equivalent Tencent serverless
container runtime.

1. Create a TencentDB for PostgreSQL instance and run the migration.
2. Create a private COS bucket and upload the catalog file keys.
3. Verify an SES sending domain and create a sending address.
4. Create an Alipay merchant app. Set the async notification URL to
   `https://<china-host>/api/webhook/alipay`.
5. Optional: create a WeChat Pay merchant app with Native payment enabled. Set
   the notification URL to `https://<china-host>/api/webhook/wechat`, upload the
   merchant private key and API v3 key, and add the platform public keys.
6. Keep `WECHAT_PAY_ENABLED=false` to run Alipay-only. WeChat stays hidden until
   the merchant, `STORE_REGION=mainland` and a `wechatPayEnabled` SKU all match.
7. Set the variables in `.env.example` as deployment secrets.
8. Build and deploy:

```bash
bun run --filter china-store build
docker build -f apps/china-store/Dockerfile -t china-store .
```

The ADR for this stack is `docs/adr/0001-china-storefront-tencent-native.md`.

## Alipay sandbox checklist

Run this manually before pointing the store at production credentials.

1. Set `APP_URL` to the sandbox host, fill Alipay sandbox app id, seller id,
   keys and `ALIPAY_GATEWAY_URL`.
2. Run `bun run --filter china-store db:migrate` and start the app.
3. Open `/store`, choose `book-guide-ebook-cny`, and submit a valid email.
4. Pay in the Alipay sandbox. Confirm the return to `/thanks?order=...` shows
   the pending or paid receipt.
5. Confirm the order row is `paid` in PostgreSQL and exactly one SES email
   arrives with a `/download/<token>` link.
6. Download the file. Confirm private/no-store headers and the file name.
7. Replay the Alipay notification. Confirm `success`, no second token and no
   second email.
8. Replay with a wrong `total_amount` or `currency`. Confirm `fail`, no token
   and no email.
9. Exhaust the download limit. Confirm `429`. Use an expired or unknown token.
   Confirm `410` or `404`.

## WeChat Pay sandbox checklist

Run this with a WeChat Pay merchant sandbox or a low-value production test. A
live merchant is required for a real proof of delivery.

1. Set `STORE_REGION=mainland`, `WECHAT_PAY_ENABLED=true`, the merchant app id,
   merchant id, certificate serial, private key, 32-byte API v3 key and the
   platform public key serial/PEM.
2. Restart the app. Open `/product/book-guide-ebook-cny` and confirm both Alipay
   and WeChat buttons appear. Confirm `book-guide-tripwire-cny` shows Alipay only.
3. Submit WeChat checkout. Confirm the QR page renders the returned `code_url`.
4. Scan and pay. Confirm `/api/webhook/wechat` returns `{"code":"SUCCESS"}` and
   the order row changes from `pending` to `paid` with the WeChat transaction id.
5. Confirm exactly one SES email and one `/download/<token>` link. Download the
   file and check private/no-store headers.
6. Replay the same notification. Confirm `SUCCESS`, no second token and no
   second email.
7. Replay with a wrong amount or currency. Confirm HTTP 400, no delivery and the
   order remains pending.
8. Replay with a tampered signature or body. Confirm HTTP 400 and no delivery.
9. Set `WECHAT_PAY_ENABLED=false`. Confirm WeChat disappears, Alipay still
   works and `/api/checkout/wechat` returns HTTP 400.

