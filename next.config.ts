import type {NextConfig} from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  images: {
    // Cho phép ảnh từ Supabase Storage (ảnh bìa lớp, avatar). Host sẽ thêm sau khi tạo project.
    remotePatterns: [{protocol: 'https', hostname: '*.supabase.co'}],
  },
};

export default withNextIntl(nextConfig);
