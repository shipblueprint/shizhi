# China Store

[中文](README.zh.md) | English

Mainland-China storefront for Example Store digital products. Alipay and
optional WeChat Pay in CNY, private Tencent COS delivery, Tencent Cloud SES
email. Hono server-rendered HTML on PostgreSQL, deployed to Tencent CloudBase
CloudRun.

This repository is a trimmed extraction of the original monorepo. It contains
only what the China storefront needs:

```
apps/china-store/    Hono app, payments, storage, migrations, tests
packages/catalog/    Framework-neutral product catalog shared by the storefronts
```

## Requirements

- Bun 1.4+
- Node 22+ (Vitest runs on Node)
- A PostgreSQL database (TencentDB for PostgreSQL in production)

## Quick start

```bash
bun install
cp apps/china-store/.env.example apps/china-store/.env
# fill in PostgreSQL, Alipay, COS and SES values

set -a; . apps/china-store/.env; set +a
bun run --filter china-store db:migrate
bun run dev
```

See [`apps/china-store/README.md`](apps/china-store/README.md) for the full
feature list, environment variables, and deployment notes.

## Scripts

| Command | Description |
| --- | --- |
| `bun run dev` | Run the storefront with `tsx watch` |
| `bun run preview` | In-memory preview: no database or providers |
| `bun run build` | Bundle with `tsup` |
| `bun run test` | Vitest |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run db:migrate` | Apply SQL migrations |
| `bun run deploy` | Deploy to Tencent CloudBase CloudRun |

Use `bun run <script>`: `bun build` and `bun test` are Bun built-ins, not
these scripts.

## Preview

See the storefront without a database or any provider credentials:

```bash
bun run preview
# open http://localhost:3000
```

It runs the real app on in-memory adapters. Checkout redirects straight to the
receipt page, and delivery emails are printed to the console. The database,
Alipay, COS and SES are never contacted.

## Deploy

Build and run with Docker:

```bash
docker build -t china-store .
docker run -p 3000:3000 --env-file apps/china-store/.env china-store
```

Tencent CloudBase CloudRun:

```bash
bun run deploy
```

## License

MIT. See [LICENSE](LICENSE).
