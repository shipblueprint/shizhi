CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'alipay',
  provider_order_id TEXT,
  product_id TEXT NOT NULL,
  email TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL CHECK (currency = 'CNY'),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'refunded', 'failed')),
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS orders_email_idx ON orders (email);
CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);

CREATE TABLE IF NOT EXISTS download_tokens (
  token_hash TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders (id) ON DELETE CASCADE,
  product_id TEXT NOT NULL,
  expires_at BIGINT NOT NULL,
  max_downloads INTEGER NOT NULL DEFAULT 5 CHECK (max_downloads > 0),
  downloads INTEGER NOT NULL DEFAULT 0 CHECK (downloads >= 0),
  created_at BIGINT NOT NULL
);

CREATE INDEX IF NOT EXISTS download_tokens_order_idx
  ON download_tokens (order_id);
