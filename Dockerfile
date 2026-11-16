FROM oven/bun:1.4.2-alpine
WORKDIR /app
COPY . .
RUN bun install --frozen-lockfile
RUN bun run --filter china-store build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["bun", "apps/china-store/dist/index.js"]
