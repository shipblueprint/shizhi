import type { Pool } from "pg";
import type {
  CreateDownloadTokenInput,
  CreateOrderInput,
  DownloadToken,
  MarkPaidInput,
  Order,
  OrderProvider,
  OrderStatus,
  OrderStore,
} from "./domain";

type OrderRow = {
  id: string;
  provider: OrderProvider;
  provider_order_id: string | null;
  product_id: string;
  email: string;
  amount_cents: number;
  status: OrderStatus;
  created_at: string | number;
  updated_at: string | number;
};

type TokenRow = {
  token_hash: string;
  order_id: string;
  product_id: string;
  expires_at: string | number;
  max_downloads: number;
  downloads: number;
};

function toNumber(value: string | number): number {
  return typeof value === "number" ? value : Number(value);
}

function mapOrder(row: OrderRow): Order {
  return {
    id: row.id,
    provider: row.provider,
    providerOrderId: row.provider_order_id,
    productId: row.product_id,
    email: row.email,
    amountCents: row.amount_cents,
    currency: "CNY",
    status: row.status,
    createdAt: toNumber(row.created_at),
    updatedAt: toNumber(row.updated_at),
  };
}

function mapToken(row: TokenRow): DownloadToken {
  return {
    tokenHash: row.token_hash,
    orderId: row.order_id,
    productId: row.product_id,
    expiresAt: toNumber(row.expires_at),
    maxDownloads: row.max_downloads,
    downloads: row.downloads,
  };
}

export function createPostgresStore(pool: Pick<Pool, "query">): OrderStore {
  return {
    async createOrder(input: CreateOrderInput): Promise<void> {
      await pool.query(
        `INSERT INTO orders
          (id, provider, provider_order_id, product_id, email, amount_cents,
           currency, status, created_at, updated_at)
         VALUES ($1, $2, NULL, $3, $4, $5, 'CNY', 'pending', $6, $6)`,
        [
          input.id,
          input.provider,
          input.productId,
          input.email,
          input.amountCents,
          input.createdAt,
        ]
      );
    },

    async getOrder(id: string): Promise<Order | null> {
      const result = await pool.query<OrderRow>(
        `SELECT id, provider, provider_order_id, product_id, email, amount_cents,
                status, created_at, updated_at
           FROM orders
          WHERE id = $1
          LIMIT 1`,
        [id]
      );
      const row = result.rows[0];
      return row ? mapOrder(row) : null;
    },

    async markPaid(input: MarkPaidInput): Promise<boolean> {
      const result = await pool.query(
        `UPDATE orders
            SET status = 'paid', provider_order_id = $3, updated_at = $4
          WHERE id = $1 AND provider = $2 AND status = 'pending'`,
        [
          input.orderId,
          input.provider,
          input.providerOrderId,
          input.updatedAt,
        ]
      );
      return (result.rowCount ?? 0) === 1;
    },

    async createDownloadToken(
      input: CreateDownloadTokenInput
    ): Promise<void> {
      await pool.query(
        `INSERT INTO download_tokens
          (token_hash, order_id, product_id, expires_at, max_downloads,
           downloads, created_at)
         VALUES ($1, $2, $3, $4, $5, 0, $6)`,
        [
          input.tokenHash,
          input.orderId,
          input.productId,
          input.expiresAt,
          input.maxDownloads,
          input.createdAt,
        ]
      );
    },

    async getDownloadToken(tokenHash: string): Promise<DownloadToken | null> {
      const result = await pool.query<TokenRow>(
        `SELECT token_hash, order_id, product_id, expires_at, max_downloads,
                downloads
           FROM download_tokens
          WHERE token_hash = $1
          LIMIT 1`,
        [tokenHash]
      );
      const row = result.rows[0];
      return row ? mapToken(row) : null;
    },

    async getDownloadTokenForOrder(
      orderId: string
    ): Promise<DownloadToken | null> {
      const result = await pool.query<TokenRow>(
        `SELECT token_hash, order_id, product_id, expires_at, max_downloads,
                downloads
           FROM download_tokens
          WHERE order_id = $1
          ORDER BY created_at DESC
          LIMIT 1`,
        [orderId]
      );
      const row = result.rows[0];
      return row ? mapToken(row) : null;
    },

    async deleteDownloadToken(tokenHash: string): Promise<void> {
      await pool.query(`DELETE FROM download_tokens WHERE token_hash = $1`, [
        tokenHash,
      ]);
    },

    async consumeDownload(tokenHash: string, now: number): Promise<boolean> {
      const result = await pool.query(
        `UPDATE download_tokens
            SET downloads = downloads + 1
          WHERE token_hash = $1
            AND downloads < max_downloads
            AND expires_at > $2`,
        [tokenHash, now]
      );
      return (result.rowCount ?? 0) === 1;
    },
  };
}
