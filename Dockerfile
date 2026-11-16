FROM oven/bun:1.4.2-alpine
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run --filter shizhi build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "apps/shizhi/dist/index.js"]
