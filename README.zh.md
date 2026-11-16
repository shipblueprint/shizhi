# 中国店（China Store）

中文 | [English](README.md)

面向中国大陆的「示例商店」数字商品店铺。人民币标价，支持支付宝，可选微信支付；
文件私有存放在腾讯云 COS，通过腾讯云 SES 发送邮件；服务端使用 Hono 渲染 HTML，
数据存于 PostgreSQL，部署到腾讯云 CloudBase CloudRun。

本仓库是从原 monorepo 中裁剪出来的独立仓库，只保留中国店需要的部分：

```
apps/china-store/    Hono 应用、支付、存储、数据库迁移、测试
packages/catalog/    与框架无关的商品目录，供各店铺共用
```

## 环境要求

- Bun 1.4+
- Node 22+（Vitest 运行在 Node 上）
- 一个 PostgreSQL 数据库（生产环境使用腾讯云 TencentDB for PostgreSQL）

## 快速开始

```bash
bun install
cp apps/china-store/.env.example apps/china-store/.env
# 填入 PostgreSQL、支付宝、COS 和 SES 的配置

set -a; . apps/china-store/.env; set +a
bun run --filter china-store db:migrate
bun run dev
```

完整的功能列表、环境变量和部署说明见
[`apps/china-store/README.md`](apps/china-store/README.md)。

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `bun run dev` | 以 `tsx watch` 启动店铺 |
| `bun run preview` | 内存预览：不需要数据库或任何第三方服务 |
| `bun run build` | 用 `tsup` 打包 |
| `bun run test` | 运行 Vitest |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run db:migrate` | 执行 SQL 迁移 |
| `bun run deploy` | 部署到腾讯云 CloudBase CloudRun |

请使用 `bun run <script>` 的形式：`bun build` 和 `bun test` 是 Bun 的内置命令，
不会执行这里的脚本。

## 本地预览

不需要数据库，也不需要任何第三方凭据，即可查看店铺界面：

```bash
bun run preview
# 打开 http://localhost:3000
```

预览用内存适配器运行真实应用。下单后会直接跳转到订单回执页，交付邮件会打印到
控制台。整个过程不会访问数据库、支付宝、COS 或 SES。

## 部署

用 Docker 构建并运行：

```bash
docker build -t china-store .
docker run -p 3000:3000 --env-file apps/china-store/.env china-store
```

部署到腾讯云 CloudBase CloudRun：

```bash
bun run deploy
```

## 许可证

MIT，详见 [LICENSE](LICENSE)。
