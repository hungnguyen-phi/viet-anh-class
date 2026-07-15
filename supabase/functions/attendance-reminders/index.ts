// Nhắc điểm danh: dò lớp CHƯA điểm danh hôm nay → email GVCN + trưởng điểm danh.
// Gọi bởi pg_cron lúc 09:00/12:00/16:00 (VN). Bảo vệ bằng header x-cron-secret.
// Secrets (Dashboard → Edge Functions → Secrets): CRON_SECRET, SMTP_HOST, SMTP_PORT,
// SMTP_USER, SMTP_PASS, SMTP_FROM. (SUPABASE_URL / SERVICE_ROLE_KEY do Supabase tự inject.)
import {createClient} from 'jsr:@supabase/supabase-js@2';
import {SMTPClient} from 'https://deno.land/x/denomailer@1.6.0/mod.ts';

const APP_URL = 'https://viet-anh-class.vercel.app';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {status, headers: {'Content-Type': 'application/json'}});
}

Deno.serve(async (req) => {
  if (req.headers.get('x-cron-secret') !== Deno.env.get('CRON_SECRET')) {
    return json({error: 'forbidden'}, 403);
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const {data: todayVal} = await admin.rpc('app_today');
  const today = String(todayVal);

  const {data: classes} = await admin.from('classes').select('id, name, homeroom_teacher_id');
  const unmarked: {id: string; name: string; emails: string[]}[] = [];
  for (const cls of classes ?? []) {
    const {count} = await admin
      .from('attendance_records')
      .select('id', {count: 'exact', head: true})
      .eq('class_id', cls.id)
      .eq('date', today);
    if ((count ?? 0) > 0) continue;
    const emails = new Set<string>();
    if (cls.homeroom_teacher_id) {
      const {data: tch} = await admin
        .from('profiles')
        .select('email')
        .eq('id', cls.homeroom_teacher_id)
        .maybeSingle();
      if (tch?.email) emails.add(tch.email);
    }
    const {data: leaders} = await admin
      .from('enrollments')
      .select('profiles!enrollments_student_id_fkey(email)')
      .eq('class_id', cls.id)
      .eq('is_attendance_leader', true);
    for (const l of leaders ?? []) {
      const e = (l as {profiles?: {email?: string}}).profiles?.email;
      if (e) emails.add(e);
    }
    if (emails.size > 0) unmarked.push({id: cls.id, name: cls.name, emails: [...emails]});
  }

  const host = Deno.env.get('SMTP_HOST');
  if (!host) return json({today, smtp: 'not_configured', unmarked_classes: unmarked.length});

  const client = new SMTPClient({
    connection: {
      hostname: host,
      port: Number(Deno.env.get('SMTP_PORT') ?? '465'),
      tls: true,
      auth: {username: Deno.env.get('SMTP_USER')!, password: Deno.env.get('SMTP_PASS')!},
    },
  });
  const from = Deno.env.get('SMTP_FROM') ?? Deno.env.get('SMTP_USER')!;

  let sent = 0;
  const errors: {class: string; error: string}[] = [];
  for (const c of unmarked) {
    try {
      await client.send({
        from,
        to: c.emails,
        subject: `[Viet Anh Class] Nhac diem danh lop ${c.name}`,
        content: `Lop ${c.name} chua duoc diem danh hom nay (${today}).\n\nVui long diem danh tai: ${APP_URL}/attendance\n\n(Email tu dong tu Viet Anh Class)`,
      });
      sent++;
    } catch (e) {
      errors.push({class: c.name, error: String(e)});
    }
  }
  await client.close();
  return json({today, smtp: 'done', unmarked_classes: unmarked.length, emails_sent: sent, errors});
});
