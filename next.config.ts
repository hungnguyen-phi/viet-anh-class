import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // Gói build tự chứa (server.js + deps đã tree-shake) cho deploy container — image gọn ~1/5.
  // An toàn vì app KHÔNG đọc file runtime qua process.cwd()/fs; message next-intl nạp bằng
  // dynamic import nên được Next tracer gói sẵn vào standalone.
  output: 'standalone',
  images: {
    // Cho phép ảnh từ Supabase Storage (ảnh bìa lớp, avatar). Host sẽ thêm sau khi tạo project.
    remotePatterns: [{protocol: 'https', hostname: '*.supabase.co'}],
  },
};

export default withNextIntl(nextConfig);
