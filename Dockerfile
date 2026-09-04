# ==================== 构建阶段 ====================
FROM node:22-alpine AS builder
WORKDIR /app

# 接收数据库连接地址
ARG DATABASE_URL
ENV DATABASE_URL=$DATABASE_URL

# 设置 npm 为淘宝镜像源
RUN npm config set registry https://registry.npmmirror.com

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .
RUN npm run build

# ==================== 生产运行阶段 ====================
FROM node:22-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]