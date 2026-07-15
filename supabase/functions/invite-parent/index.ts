// Edge Function: mời phụ huynh.
// - Xác minh người gọi là admin (qua JWT).
// - Đảm bảo có dòng parent_invitations (service-role).
// - Gửi email mời (auth.admin.inviteUserByEmail) → tạo user → trigger gán role parent + parent_link.
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY do Supabase tự inject.
import {createClient} from 'jsr:@supabase/supabase-js@2';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {'Content-Type': 'application/json'},
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({error: 'method_not_allowed'}, 405);

  try {
    const {email, student_id} = await req.json();
    if (!email || !student_id) return json({error: 'email_and_student_id_required'}, 400);

    const url = Deno.env.get('SUPABASE_URL')!;
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const authHeader = req.headers.get('Authorization') ?? '';

    // 1) Xác minh người gọi là admin
    const caller = createClient(url, anonKey, {
      global: {headers: {Authorization: authHeader}},
    });
    const {
      data: {user},
    } = await caller.auth.getUser();
    if (!user) return json({error: 'unauthorized'}, 401);
    const {data: prof} = await caller
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (prof?.role !== 'admin') return json({error: 'forbidden'}, 403);

    // 2) Đảm bảo lời mời tồn tại + 3) gửi email mời
    const admin = createClient(url, serviceKey);
    await admin
      .from('parent_invitations')
      .upsert(
        {email: String(email).toLowerCase(), student_id, status: 'pending'},
        {onConflict: 'email,student_id'},
      );

    const {error} = await admin.auth.admin.inviteUserByEmail(String(email));
    if (error) return json({error: error.message, invitation: 'created'}, 207);

    return json({ok: true});
  } catch (e) {
    return json({error: String(e)}, 500);
  }
});
