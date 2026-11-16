FROM node:22-alpine
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm --filter china-store build
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "apps/china-store/dist/index.js"]