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
#    NEXT_PUBLIC_GOOGLE_SSO_ENABLED: hiện nút "Đăng nhập với Google" — chỉ bật (=1) SAU KHI đã
#    cắm xong OAuth Client + Supabase Dashboard (xem docs/google-sso-setup.md).
#    NEXT_PUBLIC_GIT_SHA: mã commit build ra ảnh này, /api/health trả về để biết production
#    ĐANG chạy bản nào. Cần vì job build và job deploy tách rời — deploy hỏng mà build thành
#    công thì ảnh mới nằm trên GHCR còn production vẫn chạy bản cũ, nhìn ngoài không phân biệt được.
#    NEXT_PUBLIC_HUB_ORIGIN: địa chỉ Hub (https://hub.truongvietanh.com) — cần lộ ra trình duyệt
#    vì đây là targetOrigin của postMessage lúc bắt tay nhúng (components/hub/HubEmbedGate.tsx)
#    và tham số frame-ancestors trong CSP (next.config.ts). Không phải bí mật — địa chỉ Hub vốn
#    công khai, giống NEXT_PUBLIC_SUPABASE_URL.
#    NEXT_PUBLIC_SITE_URL: tên miền công khai của app (https://class.truongvietanh.com). Có mặc
#    định trong lib/site.ts nên KHÔNG bắt buộc; để sẵn ở đây để lần đổi tên miền sau — hoặc lúc
#    phải lùi gấp về tên miền cũ — chỉ cần đổi một GitHub Variable rồi build lại, không sửa code.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_GOOGLE_SSO_ENABLED
ARG NEXT_PUBLIC_GIT_SHA
ARG NEXT_PUBLIC_HUB_ORIGIN
ARG NEXT_PUBLIC_SITE_URL
ENV NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL} \
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY} \
    NEXT_PUBLIC_GOOGLE_SSO_ENABLED=${NEXT_PUBLIC_GOOGLE_SSO_ENABLED} \
    NEXT_PUBLIC_GIT_SHA=${NEXT_PUBLIC_GIT_SHA} \
    NEXT_PUBLIC_HUB_ORIGIN=${NEXT_PUBLIC_HUB_ORIGIN} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
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
