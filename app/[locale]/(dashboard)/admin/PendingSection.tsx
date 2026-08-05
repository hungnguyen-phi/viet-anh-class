import {createClient} from '@/lib/supabase/server';
import {PendingApprovals} from './PendingApprovals';

// AI ĐANG CHỜ BẠN — mảnh riêng, MỘT truy vấn.
//
// Đặt trên cùng trang: đây là việc duy nhất ở màn Quản trị có người thật đang ngồi đợi ở đầu kia.
// Tách ra để nó không phải chờ cây cơ sở, wifi hay lĩnh vực — và ngược lại, để bảng người dùng
// không phải chờ nó.
//
// Không hiện gì khi không có ai chờ: một khối rỗng nằm mãi trên đầu là một khối người ta thôi nhìn.
export async function PendingSection() {
  const supabase = await createClient();
  const {data} = await supabase
    .from('profiles')
    .select('id, full_name, email, created_at')
    .eq('role', 'pending')
    .order('created_at')
    .limit(50);

  if (!data || data.length === 0) return null;
  return <PendingApprovals users={data} />;
}
