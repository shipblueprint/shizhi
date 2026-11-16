# China Store

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

- Node 22+
- pnpm 12
- A PostgreSQL database (TencentDB for PostgreSQL in production)

## Quick start

```bash
pnpm install
cp apps/china-store/.env.example apps/china-store/.env
# fill in PostgreSQL, Alipay, COS and SES values

set -a; . apps/china-store/.env; set +a
pnpm --filter china-store db:migrate
pnpm dev
```

See [`apps/china-store/README.md`](apps/china-store/README.md) for the full
feature list, environment variables, and deployment notes.

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Run the storefront with `tsx watch` |
| `pnpm build` | Bundle with `tsup` |
| `pnpm test` | Vitest |
| `pnpm typecheck` | `tsc --noEmit` |
| `pnpm db:migrate` | Apply SQL migrations |
| `pnpm deploy` | Deploy to Tencent CloudBase CloudRun |

## Deploy

Build and run with Docker:

```bash
docker build -t china-store .
docker run -p 3000:3000 --env-file apps/china-store/.env china-store
```

Tencent CloudBase CloudRun:

```bash
pnpm deploy
```

## License

MIT. See [LICENSE](LICENSE).
