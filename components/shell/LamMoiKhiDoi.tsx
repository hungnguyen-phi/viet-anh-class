'use client';

// LÀM MỚI KHI DỮ LIỆU ĐỔI — realtime cho trang server-render (05/09/2026).
//
// Vấn đề: em gửi mục tiêu chờ duyệt → giáo viên đang mở /wig phải F5. Ở đây nghe postgres_changes
// (RLS áp y hệt truy vấn thường — 0192 đưa muc_tieu/cam_ket/thuoc vào publication) rồi
// router.refresh(): server component dựng lại, client state (ô đang gõ, popup đang mở) giữ nguyên.
//
// Chống ồn: gộp nhiều sự kiện trong 800 ms thành một refresh; bỏ qua sự kiện do CHÍNH tab này
// vừa ghi (action đã revalidate rồi) trong 2 s; tab ẩn thì gom, hiện lại thì refresh một lần.
import {useEffect, useRef} from 'react';
import {useRouter} from 'next/navigation';
import {createClient} from '@/lib/supabase/client';

export type NguonDoi = {table: string; filter?: string};

declare global {
  interface Window {
    /** Đặt bởi FormTaiCho/action client ngay sau khi gửi thành công — mốc để bỏ qua echo. */
    __vaVuaGhi?: number;
  }
}

export function danhDauVuaGhi() {
  if (typeof window !== 'undefined') window.__vaVuaGhi = Date.now();
}

export function LamMoiKhiDoi({kenh, nguon, onDoi}: {kenh: string; nguon: NguonDoi[]; onDoi?: (bang: string, kieu: string, moi: unknown) => void}) {
  const router = useRouter();
  const hen = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cho = useRef(false);
  const onDoiRef = useRef(onDoi);
  onDoiRef.current = onDoi;

  useEffect(() => {
    const supabase = createClient();
    const lamMoi = () => {
      if (document.visibilityState === 'hidden') {
        cho.current = true;
        return;
      }
      if (hen.current) clearTimeout(hen.current);
      hen.current = setTimeout(() => {
        hen.current = null;
        router.refresh();
      }, 800);
    };
    let ch = supabase.channel(`lam-moi-${kenh}`);
    for (const n of nguon) {
      ch = ch.on(
        'postgres_changes',
        {event: '*', schema: 'public', table: n.table, ...(n.filter ? {filter: n.filter} : {})},
        (payload) => {
          // Echo của chính tab này (action vừa ghi + revalidate) → không refresh lần hai.
          if (window.__vaVuaGhi && Date.now() - window.__vaVuaGhi < 2000) return;
          onDoiRef.current?.(n.table, payload.eventType, payload.new);
          lamMoi();
        },
      );
    }
    ch.subscribe();
    const onHien = () => {
      if (document.visibilityState === 'visible' && cho.current) {
        cho.current = false;
        lamMoi();
      }
    };
    document.addEventListener('visibilitychange', onHien);
    return () => {
      document.removeEventListener('visibilitychange', onHien);
      if (hen.current) clearTimeout(hen.current);
      void supabase.removeChannel(ch);
    };
    // nguon là literal ở nơi gọi; kenh đổi (đổi lớp) → subscribe lại.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kenh, router]);

  return null;
}
