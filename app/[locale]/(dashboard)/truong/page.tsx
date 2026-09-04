import {redirect} from 'next/navigation';

// 04/09: trang /truong riêng đã gỡ — khu mục tiêu trường sống trong popup "Mục tiêu của lớp và
// trường" trên /wig (components/wig/KhuMucTieuTruong.tsx). Giữ route để link cũ khỏi 404.
export default function TruongPage() {
  redirect('/wig?bang=lop');
}
