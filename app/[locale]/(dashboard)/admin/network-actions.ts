'use server';

import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {headers} from 'next/headers';
import {createClient} from '@/lib/supabase/server';
import {requireRole} from '@/lib/auth';
import {friendlyError} from '@/lib/errors';
import {clientIp} from '@/lib/ip';

function flash(msg: string): never {
  redirect(`/admin?flash=${encodeURIComponent(msg)}`);
}

// Chuẩn hoá CIDR: nếu người dùng nhập IP đơn (không có "/") → coi là /32 (IPv4) hoặc /128 (IPv6).
function toCidr(raw: string): string | null {
  const s = raw.trim();
  if (!s) return null;
  if (s.includes('/')) return s;
  return s.includes(':') ? `${s}/128` : `${s}/32`;
}

// Thêm dải/IP trường thủ công.
export async function addSchoolNetwork(formData: FormData) {
  await requireRole(['admin']);
  const label = String(formData.get('label') ?? '').trim();
  const cidr = toCidr(String(formData.get('cidr') ?? ''));
  const campus_id = String(formData.get('campus_id') ?? '') || null;
  if (!label || !cidr) flash('Thiếu nhãn hoặc IP/dải IP');
  const supabase = await createClient();
  // upsert theo (campus_id, cidr): bấm lại cùng một dải thì CẬP NHẬT chứ không đẻ thêm dòng.
  // Bảng thật đang có 21 dòng mà chỉ là 3 dải khác nhau — mỗi lần bấm lại là một bản sao,
  // khiến danh sách không đọc được và không biết cái nào đang có hiệu lực.
  const {error} = await supabase
    .from('school_networks')
    .upsert({label, cidr, campus_id, is_active: true}, {onConflict: 'campus_id,cidr'});
  if (!error) await supabase.rpc('log_audit', {p_action: 'add_school_network', p_detail: {label, cidr}});
  revalidatePath('/admin');
  flash(error ? friendlyError(error) : `Đã thêm mạng "${label}"`);
}

// Thêm nhanh IP HIỆN TẠI của admin (đứng ở trường bấm 1 nút) — server đọc IP thật từ header.
export async function addCurrentSchoolIp(formData: FormData) {
  await requireRole(['admin']);
  const label = String(formData.get('label') ?? '').trim() || 'IP hiện tại';
  const campus_id = String(formData.get('campus_id') ?? '') || null;
  const ip = clientIp(await headers());
  if (!ip) flash('Không đọc được IP hiện tại (thử lại hoặc nhập tay).');
  const cidr = ip.includes(':') ? `${ip}/128` : `${ip}/32`;
  const supabase = await createClient();
  const {error} = await supabase
    .from('school_networks')
    .upsert({label, cidr, campus_id, is_active: true}, {onConflict: 'campus_id,cidr'});
  if (!error) await supabase.rpc('log_audit', {p_action: 'add_current_ip', p_detail: {cidr}});
  revalidatePath('/admin');
  flash(error ? friendlyError(error) : `Đã thêm IP hiện tại: ${ip}`);
}

export async function setSchoolNetworkActive(formData: FormData) {
  await requireRole(['admin']);
  const id = String(formData.get('id') ?? '');
  const active = String(formData.get('active') ?? '') === 'true';
  if (!id) flash('Thiếu mạng');
  const supabase = await createClient();
  const {error} = await supabase.from('school_networks').update({is_active: active}).eq('id', id);
  revalidatePath('/admin');
  flash(error ? friendlyError(error) : active ? 'Đã bật mạng' : 'Đã tắt mạng');
}

export async function deleteSchoolNetwork(formData: FormData) {
  await requireRole(['admin']);
  const id = String(formData.get('id') ?? '');
  if (!id) flash('Thiếu mạng');
  const supabase = await createClient();
  const {error} = await supabase.from('school_networks').delete().eq('id', id);
  revalidatePath('/admin');
  flash(error ? friendlyError(error) : 'Đã xoá mạng');
}
