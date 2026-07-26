# syntax=docker/dockerfile:1
# Next.js 15 (standalone) + Supabase — build ở CI, VPS chỉ pull & chạy.
ARG NODE_IMAGE=node:22-bookworm-slim

# ── build ──
FROM ${NODE_IMAGE} AS builder
WORKDIR /app

# 1) deps: layer này chỉ chạy lại khi lockfile đổi → đổi-code không cài lại deps
COPY package.json package-lock.json ./
RUN npm ci

# 2) source
COPY . .

# 3) Biến NEXT_PUBLIC_* bị NỘI TUYẾN lúc `next build` (không phải runtime) → CI phải truyền vào
#    lúc build qua --build-arg. Đây là giá trị PUBLIC (URL + anon key, dữ liệu được RLS bảo vệ),
#    ship xuống trình duyệt là bình thường.
#    TUYỆT ĐỐI KHÔNG truyền SUPABASE_SERVICE_ROLE_KEY vào đây — nó server-only, đặt ở env runtime.
#    NEXT_PUBLIC_ENABLE_DEMO: toggle nút demo, điều khiển bằng GitHub Variable (rỗng/0 = ẩn, 1 = hiện).
#    ⚠️ Đặt về 0/xoá trước khi mở cho người dùng THẬT (image public + demo1234).
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_ENABLE_DEMO
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
    NEXT_PUBLIC_ENABLE_DEMO=${NEXT_PUBLIC_ENABLE_DEMO} \
    NEXT_TELEMETRY_DISABLED=1

RUN npm run build

# ── runtime ──
FROM ${NODE_IMAGE} AS runner
WORKDIR /app
ENV NODE_ENV=production \
    PORT=8080 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1

# Standalone: chỉ 3 cụm cần copy. node_modules đã được tree-shake gói trong /standalone.
# (message next-intl được bundle vào .next/server nên không cần copy thư mục messages/.)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Chạy dưới user thường, không phải root
RUN groupadd -r nodejs && useradd -r -g nodejs -m nextjs && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 8080
# /api/health nằm NGOÀI matcher middleware (matcher loại trừ /api) → không chạy i18n/refresh session
# Supabase, không bị redirect, không phụ thuộc DB. Healthcheck nhẹ và ổn định.
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
