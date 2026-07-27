import type {MetadataRoute} from 'next';
import {SITE_URL} from '@/lib/site';

// Sitemap CHỈ gồm trang công khai (đăng nhập). Mọi trang sau đăng nhập đã bị chặn ở robots.ts —
// đưa vào sitemap là tự phá chính việc chặn đó.
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    {
      url: `${SITE_URL}/vi/login`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 1,
      alternates: {languages: {vi: `${SITE_URL}/vi/login`, en: `${SITE_URL}/en/login`}},
    },
    {
      url: `${SITE_URL}/en/login`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
      alternates: {languages: {vi: `${SITE_URL}/vi/login`, en: `${SITE_URL}/en/login`}},
    },
  ];
}
