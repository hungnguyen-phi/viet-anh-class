'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError, loi, tachLoi} from '@/lib/errors';

// ════════════════════════════════════════════════════════════════════════════
// BUDDY & LỊCH PDR — GVCN thao tác trên /roster (PRD v3: "lịch buddy được học sinh đăng ký
// với GVCN và DO GVCN TẠO trên hệ thống")
//
// NHÓM 2 HOẶC 3, không còn ghép từng cặp rời (chốt 19/08/2026 — lớp lẻ thì một nhóm 3).
// Dưới CSDL một nhóm vẫn là các dòng buddy_pairs đôi một (nhóm 3 = 3 cặp, xem 0153); giao
// diện chỉ nói chuyện bằng NHÓM: tạo nguyên nhóm qua RPC tao_buddy_nhom (một giao dịch),
// gỡ/đặt lịch thì nhận danh sách pair_id của cả nhóm từ màn roster.
// ════════════════════════════════════════════════════════════════════════════

function flash(classId: string, msg: string): never {
  const g = tachLoi(msg);
  redirect(`/roster?class=${encodeURIComponent(classId)}&${g.laLoi ? 'flash_err' : 'flash'}=${encodeURIComponent(g.msg)}`);
}

// Dạng "id1,id2,id3" từ input hidden — chỉ nhận uuid, thứ lạ rơi ra ngoài.
const tachIds = (raw: string) =>
  raw.split(',').map((s) => s.trim()).filter((s) => /^[0-9a-f-]{36}$/i.test(s));

export async function taoBuddyNhom(formData: FormData) {
  await requireRole(['teacher', 'admin', 'principal']);
  const class_id = String(formData.get('class_id') ?? '');
  // Em thứ ba là TUỲ CHỌN — bỏ trống là nhóm 2.
  const thanhVien = ['em_a', 'em_b', 'em_c']
    .map((k) => String(formData.get(k) ?? '').trim())
    .filter(Boolean);
  if (!class_id || thanhVien.length < 2) flash(class_id, loi('Chọn ít nhất hai học sinh.'));
  if (new Set(thanhVien).size !== thanhVien.length)
    flash(class_id, loi('Các em trong nhóm phải là những người khác nhau.'));

  const supabase = await createClient();
  const {error} = await supabase.rpc('tao_buddy_nhom', {p_class: class_id, p_members: thanhVien});
  revalidatePath('/[locale]/roster', 'page');
  if (error) {
    if (/gỡ nhóm cũ/.test(error.message))
      flash(class_id, loi('Có em đã ở một nhóm buddy khác — gỡ nhóm cũ trước.'));
    if (/cùng lớp/.test(error.message))
      flash(class_id, loi('Các em trong nhóm phải đang học cùng lớp này.'));
    flash(class_id, loi(friendlyError(error)));
  }
  flash(class_id, thanhVien.length === 3 ? 'Đã tạo nhóm buddy 3 em' : 'Đã tạo nhóm buddy');
}

// CHIA NGẪU NHIÊN — cho các em CHƯA có nhóm (19/08/2026: "random tự chọn nhóm, hoặc thủ công").
//
// Chỉ đụng em còn trống, không phá nhóm đã ghép tay: cô ghép tay vài nhóm đặc biệt trước rồi
// bấm random phần còn lại là cách dùng thật. Lẻ thì nhóm CUỐI là nhóm 3 — đúng luật "tất cả
// đều 2 thì 1 nhóm 3". Còn đúng 1 em trơ trọi (ví dụ lớp chẵn nhưng đã ghép tay hết trừ 1 em)
// thì không tự tiện phá nhóm nào — báo để cô tự xếp em ấy vào một nhóm 2 thành nhóm 3.
export async function chiaNhomNgauNhien(formData: FormData) {
  await requireRole(['teacher', 'admin', 'principal']);
  const class_id = String(formData.get('class_id') ?? '');
  if (!class_id) flash(class_id, loi('Không rõ lớp nào.'));

  const supabase = await createClient();
  const [{data: emLop}, {data: capCo}] = await Promise.all([
    supabase
      .from('enrollments')
      .select('student_id, profiles!enrollments_student_id_fkey(role)')
      .eq('class_id', class_id)
      .eq('is_active', true),
    supabase.from('buddy_pairs').select('student_id, buddy_id').eq('class_id', class_id).eq('is_active', true),
  ]);
  const daCoNhom = new Set((capCo ?? []).flatMap((c) => [c.student_id, c.buddy_id]));
  const conTrong = (emLop ?? [])
    .filter((e) => (e.profiles as unknown as {role: string} | null)?.role === 'student')
    .map((e) => e.student_id)
    .filter((id) => !daCoNhom.has(id));

  if (conTrong.length === 0) flash(class_id, loi('Cả lớp đã có nhóm hết rồi.'));
  if (conTrong.length === 1)
    flash(class_id, loi('Chỉ còn 1 em chưa có nhóm — gỡ một nhóm 2 rồi ghép tay em ấy vào thành nhóm 3.'));

  // Fisher–Yates: mỗi hoán vị cùng xác suất — sort(random) thì không.
  for (let i = conTrong.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [conTrong[i], conTrong[j]] = [conTrong[j], conTrong[i]];
  }
  // Toàn nhóm 2; lẻ thì 3 em cuối thành một nhóm 3.
  const nhom: string[][] = [];
  const chan = conTrong.length % 2 === 0 ? conTrong.length : conTrong.length - 3;
  for (let i = 0; i < chan; i += 2) nhom.push([conTrong[i], conTrong[i + 1]]);
  if (chan < conTrong.length) nhom.push(conTrong.slice(chan));

  // Mỗi nhóm một giao dịch (RPC 0153): đứt giữa chừng thì nhóm nào xong vẫn nguyên vẹn,
  // bấm lại chỉ chia tiếp phần còn trống — không bao giờ ra nửa nhóm.
  for (const members of nhom) {
    const {error} = await supabase.rpc('tao_buddy_nhom', {p_class: class_id, p_members: members});
    if (error) {
      revalidatePath('/[locale]/roster', 'page');
      flash(class_id, loi(friendlyError(error)));
    }
  }
  revalidatePath('/[locale]/roster', 'page');
  flash(
    class_id,
    `Đã chia ngẫu nhiên ${nhom.length} nhóm` + (chan < conTrong.length ? ' (nhóm cuối 3 em)' : ''),
  );
}

// GỠ CẢ NHÓM = tắt is_active mọi cặp của nhóm, không xoá dòng: lịch sử họp PDR vẫn cần đối
// chiếu được (quyết định 18/08/2026: cho đổi buddy giữa năm, giữ lịch sử). Lịch tắt theo.
export async function goBuddyNhom(formData: FormData) {
  await requireRole(['teacher', 'admin', 'principal']);
  const class_id = String(formData.get('class_id') ?? '');
  const ids = tachIds(String(formData.get('pair_ids') ?? ''));
  if (ids.length === 0) flash(class_id, loi('Không rõ nhóm nào.'));
  const supabase = await createClient();
  const {error} = await supabase.from('buddy_pairs').update({is_active: false}).in('id', ids);
  if (!error)
    await supabase.from('pdr_schedules').update({is_active: false}).in('buddy_pair_id', ids);
  revalidatePath('/[locale]/roster', 'page');
  flash(class_id, error ? loi(friendlyError(error)) : 'Đã gỡ nhóm buddy (lịch sử họp giữ nguyên)');
}

// Chỉ nhận đúng bốn giá trị CSDL cho phép (CHECK ở 0159). Giá trị lạ → 'sang_hom_do' thay vì
// để CSDL ném lỗi ràng buộc: người dùng không gõ ô này bằng tay, giá trị lạ nghĩa là form bị
// nghịch — và câu trả lời đúng cho chuyện đó là mặc định an toàn, không phải một màn lỗi.
function docNhac(formData: FormData): string {
  const v = String(formData.get('nhac_khi') ?? '');
  return ['khong', 'toi_hom_truoc', 'sang_hom_do', 'mot_gio_truoc'].includes(v) ? v : 'sang_hom_do';
}

export async function luuLichBuddy(formData: FormData) {
  const me = await requireRole(['teacher', 'admin', 'principal']);
  const class_id = String(formData.get('class_id') ?? '');
  // Lịch là CỦA CẢ NHÓM nhưng bảng treo lịch vào từng cặp (0146) — nên ghi CÙNG một thứ+giờ
  // lên mọi cặp của nhóm. Phải đủ cả 3 cặp thì em nào trong nhóm 3 cũng tra ra lịch: màn học
  // sinh tìm lịch qua "một cặp bất kỳ có mặt em" (StudentScoreboard), mà mỗi em chỉ đứng trong
  // 2/3 số cặp — ghi thiếu cặp nào là em thứ ba nhìn lịch trống.
  const pairIds = tachIds(String(formData.get('pair_ids') ?? ''));
  const weekday = Number(formData.get('weekday') ?? 0);
  const time_slot = String(formData.get('time_slot') ?? '').trim() || null;
  const nhac_khi = docNhac(formData);
  if (pairIds.length === 0 || weekday < 2 || weekday > 8) flash(class_id, loi('Chọn thứ trong tuần.'));

  const supabase = await createClient();
  // Mỗi cặp một lịch active (pdr_schedules_buddy_uidx): có rồi thì SỬA, chưa có thì thêm.
  const {data: daCo} = await supabase
    .from('pdr_schedules')
    .select('id, buddy_pair_id')
    .in('buddy_pair_id', pairIds)
    .eq('is_active', true);
  const coRoi = new Map((daCo ?? []).map((l) => [l.buddy_pair_id, l.id]));
  const ketQua = await Promise.all(
    pairIds.map((pid) => {
      const idCu = coRoi.get(pid);
      return idCu
        ? supabase.from('pdr_schedules').update({weekday, time_slot, nhac_khi}).eq('id', idCu)
        : supabase.from('pdr_schedules').insert({
            class_id,
            buddy_pair_id: pid,
            type: 'buddy',
            weekday,
            time_slot,
            nhac_khi,
            created_by: me.id,
          });
    }),
  );
  const error = ketQua.find((r) => r.error)?.error ?? null;
  revalidatePath('/[locale]/roster', 'page');
  flash(class_id, error ? loi(friendlyError(error)) : 'Đã lưu lịch họp buddy');
}

export async function luuLichCoach(formData: FormData) {
  const me = await requireRole(['teacher', 'admin', 'principal']);
  const class_id = String(formData.get('class_id') ?? '');
  const student_id = String(formData.get('student_id') ?? '');
  const monthly_day = Number(formData.get('monthly_day') ?? 0);
  const nhac_khi = docNhac(formData);
  // 1–28 để lịch không tự trượt ở tháng thiếu ngày (CHECK ở 0146 cũng chặn).
  if (!student_id || monthly_day < 1 || monthly_day > 28)
    flash(class_id, loi('Chọn học sinh và một ngày từ 1 đến 28.'));

  const supabase = await createClient();
  const {data: daCo} = await supabase
    .from('pdr_schedules')
    .select('id')
    .eq('student_id', student_id)
    .eq('type', 'coach')
    .eq('is_active', true)
    .maybeSingle();
  const {error} = daCo
    ? await supabase.from('pdr_schedules').update({monthly_day, nhac_khi}).eq('id', daCo.id)
    : await supabase.from('pdr_schedules').insert({
        class_id,
        student_id,
        type: 'coach',
        monthly_day,
        nhac_khi,
        created_by: me.id,
      });
  revalidatePath('/[locale]/roster', 'page');
  flash(class_id, error ? loi(friendlyError(error)) : 'Đã lưu lịch PDR với giáo viên');
}
