import {getTranslations, setRequestLocale} from 'next-intl/server';
import {Link} from '@/i18n/navigation';
import {Images} from 'lucide-react';
import {requireRole} from '@/lib/auth';
import {createClient} from '@/lib/supabase/server';
import {KhongCoLop} from '@/components/ui/KhongCoLop';
import {getClassContext} from '@/lib/queries';
import {ClassPicker} from '@/components/shell/ClassPicker';
import {ClassOwnerNote} from '@/components/shell/ClassOwnerNote';
import {ClassCoverUpload} from '@/components/shell/ClassCoverUpload';
import {ConfirmButton} from '@/components/ui/ConfirmButton';
import {AttendanceLeaderPicker} from '@/components/roster/AttendanceLeaderPicker';
import {EnrollForm} from './EnrollForm';
import {SuaHocSinh} from './SuaHocSinh';
import {removeStudent, cancelStudentInvite} from './actions';
import {IncomingTransfers, type DeNghiDen} from './IncomingTransfers';
import {KhuBuddyPdr} from '@/components/roster/KhuBuddyPdr';
import {TransferControl, type LopDich} from './TransferControl';
import {Flash} from '@/components/ui/Flash';

type EnrRow = {
  student_id: string;
  is_attendance_leader: boolean;
  profiles: {full_name: string | null; email: string} | null;
};

// Một dòng trong danh sách lớp — gộp hai nguồn:
//  - em ĐÃ có tài khoản (bảng enrollments)
//  - em MỚI được mời, chưa đăng nhập lần nào (bảng pending_user_grants)
// Trước đây chỉ đọc enrollments, nên mời 30 em vẫn thấy danh sách trống — giáo viên không biết
// đã mời ai, đúng như ban giám hiệu phản ánh.
type Row = {
  key: string;
  studentId: string | null; // null = chưa có tài khoản
  name: string;
  email: string;
  isLeader: boolean;
  code: string | null;
  dob: string | null;
  phone: string | null;
  note: string | null;
  // Họ tên ĐÚNG NHƯ TRONG student_details, không phải tên hiển thị.
  //
  // `name` ở trên đã ưu tiên tên trong hồ sơ Google của em; đổ nó vào ô sửa là lần lưu nào cũng
  // âm thầm chép tên Google đè lên tên giáo viên đã điền. Ô sửa phải bày đúng thứ nó sắp ghi.
  tenDaDien: string | null;
};

export default async function RosterPage({
  params,
  searchParams,
}: {
  params: Promise<{locale: string}>;
  searchParams: Promise<{class?: string; flash?: string}>;
}) {
  const {locale} = await params;
  const {class: classParam} = await searchParams;
  setRequestLocale(locale);
  const profile = await requireRole(['teacher', 'admin', 'principal']);
  // BGH chỉ XEM (danh sách + mở từng em); GVCN/Admin mới quản lý (ghi danh, tổ trưởng, xoá).
  // Ai được DỰNG danh sách lớp: GVCN của lớp, quản trị viên, và từ 0094 là cả ban giám hiệu
  // trong cơ sở mình — chủ dự án chốt "BGH phải tạo được khối, lớp, học sinh".
  const canManage =
    profile.role === 'teacher' || profile.role === 'admin' || profile.role === 'principal';
  // Trưởng điểm danh là vai TRONG LỚP, do người dạy lớp ấy chọn — luật dưới CSDL cũng chỉ cho
  // GVCN ghi vào cột ấy. Bày nút cho BGH thì họ bấm xong nhận đúng một câu "không có quyền".
  const chonToTruong = profile.role === 'teacher' || profile.role === 'admin';
  // BỐN CỘT CHI TIẾT CHỈ HIỆN VỚI NGƯỜI ĐỌC ĐƯỢC CHÚNG.
  //
  // student_details bị RLS giới hạn cho GVCN của chính lớp đó + quản trị viên (0058). Hiệu trưởng
  // gọi vẫn hợp lệ nhưng nhận về RỖNG — nên với họ, bốn cột "Mã HS · Ngày sinh · SĐT phụ huynh ·
  // Ghi chú" là bốn cột vĩnh viễn toàn dấu "—", trên một bảng phải cuộn ngang 900px. Đọc thành
  // "trường chưa nhập dữ liệu", trong khi dữ liệu có đủ, chỉ là không dành cho họ.
  //
  // Giấu cột thì bảng vừa màn hình, và không nói dối điều gì.
  const xemChiTiet = canManage;
  const t = await getTranslations('roster');
  const supabase = await createClient();
  const {myClass, classes: accessible} = await getClassContext(supabase, profile, classParam);

  if (!myClass) {
    return (
      <KhongCoLop role={profile.role} />
    );
  }

  // Hai nguồn của danh sách lớp — độc lập, chạy song song.
  const [{data: enrolls}, {data: invited}, {data: transfers}, {data: lopDich}] = await Promise.all([
    supabase
      .from('enrollments')
      .select('student_id, is_attendance_leader, profiles!enrollments_student_id_fkey(full_name, email)')
      .eq('class_id', myClass.id)
      .eq('is_active', true),
    supabase.from('pending_user_grants').select('email').eq('class_id', myClass.id).eq('role', 'student'),
    // Đề nghị dời lớp — CẢ HAI CHIỀU, trong cùng một truy vấn.
    // Chiều ĐI (from = lớp này) để hiện "đang chờ lớp X duyệt" trên đúng dòng em ấy; chiều ĐẾN
    // (to = lớp này) để chủ nhiệm lớp này còn biết có việc phải quyết. Hỏi một lượt thay vì hai:
    // mỗi vòng ra Supabase từ VPS này tốn hơn một phần mười giây.
    supabase
      .from('class_transfer_requests')
      .select(
        'id, student_id, from_class_id, to_class_id, note, created_at, ' +
          'hs:profiles!class_transfer_requests_student_id_fkey(full_name, email), ' +
          'lop_di:classes!class_transfer_requests_from_class_id_fkey(name), ' +
          'lop_den:classes!class_transfer_requests_to_class_id_fkey(name)',
      )
      .eq('status', 'pending')
      .or(`from_class_id.eq.${myClass.id},to_class_id.eq.${myClass.id}`),
    // Danh sách lớp có thể dời tới. GVCN chỉ đọc được lớp của mình (RLS bảng classes) nên phải đi
    // qua RPC mở đúng một khe hẹp: tên lớp, năm học, cơ sở, chủ nhiệm — không gì khác.
    canManage ? supabase.rpc('transfer_target_classes') : Promise.resolve({data: []}),
  ]);

  // Thông tin nhận diện: hỏi ĐÚNG các email của lớp này, không quét cả bảng.
  // Phải chờ hai truy vấn trên xong mới biết hỏi email nào (thêm một chặng mạng) — đổi lại,
  // quản trị viên không tải về ngày sinh + số điện thoại của TOÀN TRƯỜNG mỗi lần mở một lớp.
  // Chuẩn "tối thiểu hoá" trong docs/DATA_GOVERNANCE.md, và cũng nhẹ hơn hẳn khi trường đông.
  //
  // student_details chỉ GVCN của lớp + quản trị viên đọc được (RLS, migration 0058); hiệu trưởng
  // gọi vẫn hợp lệ nhưng nhận về rỗng — nên các cột thông tin thêm tự động trống với họ.
  const wanted = [
    ...((enrolls ?? []) as unknown as EnrRow[]).map((r) => r.profiles?.email),
    ...(invited ?? []).map((g) => g.email),
  ]
    .filter((e): e is string => !!e)
    .map((e) => e.toLowerCase());

  // Lớp trống thì bỏ hẳn truy vấn — `.in('email', [])` vẫn là một chặng mạng vô ích.
  const enrolledIds = ((enrolls ?? []) as unknown as EnrRow[]).map((r) => r.student_id);
  const [{data: details}, {data: yeuCauCho}] = await Promise.all([
    wanted.length
      ? supabase
          .from('student_details')
          .select('email, full_name, student_code, date_of_birth, parent_phone, note')
          .in('email', [...new Set(wanted)])
      : Promise.resolve({data: []}),
    // Yêu cầu sửa của học sinh đang chờ duyệt. Chỗ duyệt duy nhất là trang cá nhân từng em
    // (RequestInbox), và nó TỰ ẨN khi trống — nên không có gì ở cấp lớp báo "đang có việc chờ".
    // Người thử 08/2026 tìm không ra: "Không thấy trang của em". Sổ lớp là đường vào tự nhiên
    // (bấm tên em → trang em) nên đếm và báo ở đây.
    canManage && enrolledIds.length
      ? supabase.from('edit_requests').select('student_id').eq('status', 'pending').in('student_id', enrolledIds)
      : Promise.resolve({data: []}),
  ]);

  const choDuyet = new Map<string, number>();
  for (const r of yeuCauCho ?? []) choDuyet.set(r.student_id, (choDuyet.get(r.student_id) ?? 0) + 1);
  const tongChoDuyet = [...choDuyet.values()].reduce((a, b) => a + b, 0);

  const byEmail = new Map(
    (details ?? []).map((d) => [d.email.toLowerCase(), d] as const),
  );
  const detailOf = (email: string) => byEmail.get(email.toLowerCase());

  const enrolled: Row[] = ((enrolls ?? []) as unknown as EnrRow[]).map((r) => {
    const email = r.profiles?.email ?? '';
    const d = detailOf(email);
    return {
      key: r.student_id,
      studentId: r.student_id,
      // Tên hiển thị: ưu tiên tên trong hồ sơ, thiếu thì lấy tên GVCN đã điền lúc ghi danh.
      name: r.profiles?.full_name ?? d?.full_name ?? email ?? r.student_id,
      email,
      isLeader: r.is_attendance_leader,
      code: d?.student_code ?? null,
      dob: d?.date_of_birth ?? null,
      phone: d?.parent_phone ?? null,
      note: d?.note ?? null,
      tenDaDien: d?.full_name ?? null,
    };
  });

  // Em đã có tài khoản thì bỏ khỏi nhóm "chưa đăng nhập" (lời mời có thể còn sót lại sau khi
  // em đã vào lớp — handle_new_user không luôn dọn hàng grant).
  const enrolledEmails = new Set(enrolled.map((r) => r.email.toLowerCase()));
  const pending: Row[] = (invited ?? [])
    .filter((g) => !enrolledEmails.has(g.email.toLowerCase()))
    .map((g) => {
      const d = detailOf(g.email);
      return {
        key: 'invited:' + g.email,
        studentId: null,
        name: d?.full_name ?? g.email,
        email: g.email,
        isLeader: false,
        code: d?.student_code ?? null,
        dob: d?.date_of_birth ?? null,
        phone: d?.parent_phone ?? null,
        note: d?.note ?? null,
        tenDaDien: d?.full_name ?? null,
      };
    });

  // Postgres trả yyyy-mm-dd; trường học Việt Nam đọc ngày/tháng/năm — hiện đúng cách người dùng
  // vừa gõ vào ba ô ở form trên, để họ soát lại được.
  const ngayVN = (iso: string | null) => {
    if (!iso) return '—';
    const [y, m, d] = iso.split('-');
    return d && m && y ? `${d}/${m}/${y}` : iso;
  };

  const byName = (a: Row, b: Row) => a.name.localeCompare(b.name, 'vi');
  // Em đang học lên trước, em chưa đăng nhập xuống dưới — đọc danh sách lớp thật là phần trên.
  const rows = [...enrolled.sort(byName), ...pending.sort(byName)];
  const leaderId = enrolled.find((r) => r.isLeader)?.studentId ?? null;
  // Chỉ em ĐÃ có tài khoản mới làm tổ trưởng điểm danh được (cần đăng nhập để ghi).
  const candidates = enrolled.map((r) => ({id: r.studentId!, name: r.name, email: r.email || null}));

  // Tách hai chiều từ một mẻ dữ liệu.
  type TR = {
    id: string;
    student_id: string;
    from_class_id: string;
    to_class_id: string;
    note: string | null;
    created_at: string;
    hs: {full_name: string | null; email: string} | null;
    lop_di: {name: string} | null;
    lop_den: {name: string} | null;
  };
  const dsDoiLop = (transfers ?? []) as unknown as TR[];
  // Chiều ĐI: khoá theo học sinh để dòng của em ấy hiện "đang chờ lớp X duyệt".
  const dangChoTheoEm = new Map(
    dsDoiLop
      .filter((r) => r.from_class_id === myClass.id)
      .map((r) => [r.student_id, {id: r.id, toClassName: r.lop_den?.name ?? ''}]),
  );
  // Chiều ĐẾN: việc lớp này phải quyết.
  const deNghiDen: DeNghiDen[] = dsDoiLop
    .filter((r) => r.to_class_id === myClass.id)
    .map((r) => ({
      id: r.id,
      studentName: r.hs?.full_name ?? r.hs?.email ?? '',
      fromClassName: r.lop_di?.name ?? '',
      note: r.note,
      createdAt: String(r.created_at),
    }));
  const lopDichList = (lopDich ?? []) as unknown as LopDich[];
  const laAdmin = profile.role === 'admin';

  // CÁC CỘT KHAI MỘT LẦN, HÀNG TIÊU ĐỀ VÀ MỌI DÒNG DÙNG CHUNG.
  //
  // Bản cũ dựng bằng flex, và dòng của em ĐÃ CÓ TÀI KHOẢN có thêm một ô "Dời lớp" mà hàng tiêu
  // đề không có. Ô thừa ấy ăn mất một phần bề rộng, nên đúng những dòng đó bị kéo lệch khỏi các
  // dòng còn lại — chủ dự án thấy email và ngày sinh của hai em đầu không thẳng hàng với các em
  // bên dưới. Nay nút dời lớp nằm gọn trong ô thao tác cuối dòng, và bề rộng cột do lưới quyết
  // định chứ không do nội dung từng dòng.
  const cot = {
    gridTemplateColumns: [
      '22px', // #
      'minmax(0,1.4fr)', // họ tên
      ...(xemChiTiet ? ['110px'] : []), // mã HS
      'minmax(0,1.4fr)', // email
      ...(xemChiTiet ? ['100px', '110px', 'minmax(0,1fr)'] : []), // ngày sinh · sđt · ghi chú
      canManage ? '208px' : '104px', // dời lớp + sửa + xoá
    ].join(' '),
  } as const;
  const hang = `grid ${xemChiTiet ? 'min-w-[900px]' : 'min-w-[420px]'} items-center gap-2 px-[18px]`;

  return (
    <div className="space-y-4">
      {/* ẢNH BÌA LỚP.
          Trước đây cột classes.cover_image_url được GHI ở đúng một chỗ (nút tải ảnh lên) và
          KHÔNG ĐƯỢC ĐỌC RA Ở BẤT KỲ ĐÂU — grep cả repo chỉ thấy định nghĩa cột, kiểu TS, và chỗ
          ghi. Nên kể cả khi upload chạy được thì người dùng vẫn thấy "chưa được", vì chẳng có gì
          hiện ra. Đây là nửa thứ hai của lỗi chủ trường báo (nửa đầu ở migration 0071).

          Dùng <img> chứ không next/image: đây là ảnh từ Supabase Storage với URL đã có sẵn kích
          thước cố định, và bản thân ảnh ĐÃ được thu nhỏ về 1600px + nén webp ngay trên máy người
          gửi trước khi tải lên (xem ClassCoverUpload). Cho next/image tối ưu lại lần nữa chỉ thêm
          một chặng qua /_next/image mà không giảm được bao nhiêu. */}
      {/* Đề nghị chuyển ĐẾN lớp này — đặt trên cùng vì có một em đang treo giữa hai lớp chờ
          quyết định ở đây. */}
      <IncomingTransfers classId={myClass.id} requests={deNghiDen} />

      {myClass.cover_image_url && (
        <div className="overflow-hidden rounded-[20px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={myClass.cover_image_url}
            alt={t('coverAlt', {cls: myClass.name})}
            className="h-[160px] w-full object-cover sm:h-[200px]"
          />
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-[22px] font-bold text-navy">
          {t('title')} · {myClass.name}
        </h1>
        <div className="flex flex-wrap items-center gap-2">
          {/* Album ảnh lớp vào đây thay vì thành một tab riêng: thanh menu chỉ còn chỗ cho khoảng
              hai tab nữa (docs/NAV_IA.md), mà xem ảnh là việc thỉnh thoảng. Đặt cạnh "Ảnh bìa
              lớp" vì cùng là việc với hình ảnh của lớp này. */}
          <Link
            href={`/gallery?class=${myClass.id}`}
            className="inline-flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-[10px] border-[1.5px] border-navy/20 bg-white px-3 text-[12.5px] font-extrabold text-navy transition-all hover:border-navy"
          >
            <Images size={14} strokeWidth={2.2} />{t('images')}</Link>
          {canManage && <ClassCoverUpload classId={myClass.id} />}
          {/* Quản trị/BGH thấy bộ chọn KỂ CẢ khi chỉ có một lớp: nó là chỗ duy nhất trên màn hình
            nói rõ mình đang đứng ở lớp nào. Giáo viên chỉ có lớp mình thì giấu đi cho gọn. */}
        {(accessible.length > 1 || profile.role === 'admin' || profile.role === 'principal') && (
          <ClassPicker classes={accessible} current={myClass.id} />
        )}
        <ClassOwnerNote classId={myClass.id} viewerId={profile.id} viewerRole={profile.role} />
        </div>
      </div>

      <Flash />

      {tongChoDuyet > 0 && (
        <p className="rounded-[12px] border-[1.5px] border-gold-deep/30 bg-gold/[0.12] px-3.5 py-2.5 text-[12.5px] font-bold text-navy">
          {t('pendingBanner', {n: tongChoDuyet})}
        </p>
      )}

      {/* Ghi danh / chuyển lớp: nhập email học sinh (đã có tài khoản) — chỉ GVCN/Admin */}
      {canManage && <EnrollForm classId={myClass.id} />}
      {/* Tổ trưởng điểm danh gom về MỘT chỗ (trước đây mỗi dòng một nút) */}
      {chonToTruong && (
        <AttendanceLeaderPicker
          classId={myClass.id}
          students={candidates}
          currentLeaderId={leaderId}
        />
      )}

      <div className="glass overflow-x-auto rounded-[20px]">
        {/* Header */}
        <div className={`${hang} bg-navy/[0.03] py-[10px]`} style={cot}>
          <span className="text-[11px] font-extrabold text-grey-mid">#</span>
          <span className="min-w-0 truncate text-[11px] font-extrabold uppercase text-grey-mid">
            {t('name')}
          </span>
          {xemChiTiet && (
            <span className="min-w-0 truncate text-[11px] font-extrabold uppercase text-grey-mid">{t('colCode')}</span>
          )}
          <span className="min-w-0 truncate text-[11px] font-extrabold uppercase text-grey-mid">
            {t('email')}
          </span>
          {xemChiTiet && (
            <>
              <span className="min-w-0 truncate text-[11px] font-extrabold uppercase text-grey-mid">{t('colDob')}</span>
              <span className="min-w-0 truncate text-[11px] font-extrabold uppercase text-grey-mid">{t('colParentPhone')}</span>
              <span className="min-w-0 truncate text-[11px] font-extrabold uppercase text-grey-mid">{t('colNote')}</span>
            </>
          )}
          <span />
        </div>

        {/* Rows */}
        {rows.map((r, i) => (
          <div
            key={r.key}
            className={`${hang} border-t border-navy/[0.08] py-2 transition-colors hover:bg-navy/[0.03]`}
            style={cot}
          >
            <span className="text-[12px] font-bold text-grey-mid">{i + 1}</span>
            {/* flex-wrap + tên được ưu tiên chỗ.
                Audit mobile 2026-08-06, màn 360px: nhãn "○ chưa đăng nhập" (shrink-0, ~100px)
                không bao giờ nhường chỗ, nên TÊN HỌC SINH lãnh trọn phần thiếu và bị cắt còn ba
                ký tự — "chi…", "hie…", "phu…". Cả màn danh sách lớp trở thành một cột vô nghĩa,
                đúng thứ giáo viên mở ra để đọc. Nay nhãn xuống dòng khi chật, tên giữ nguyên. */}
            <span className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
              {/* Em đã có tài khoản → mở được trang cá nhân. Em chưa đăng nhập thì chưa có trang. */}
              {r.studentId ? (
                <Link
                  href={`/student/${r.studentId}`}
                  className="block min-w-[88px] flex-1 truncate py-1 text-[13.5px] font-bold text-navy underline-offset-2 transition-colors hover:underline"
                >
                  {r.name}
                </Link>
              ) : (
                // min-w-[88px] flex-1 y như nhánh có tài khoản ở trên: thiếu nó thì ô tên co lại
                // theo nội dung và nhường hết chỗ cho nhãn shrink-0 bên cạnh — mà đây đúng là
                // nhánh của những em CHƯA đăng nhập, tức là những dòng luôn có nhãn ấy.
                <span className="block min-w-[88px] flex-1 truncate py-1 text-[13.5px] font-bold text-navy/70">
                  {r.name}
                </span>
              )}
              {/* Chỉ là nhãn: đổi tổ trưởng làm ở khối phía trên, không còn nút trên từng dòng */}
              {r.isLeader && (
                <span
                  title={t('attendanceLeader')}
                  className="inline-flex min-w-0 shrink items-center gap-1 truncate rounded-full bg-gold/20 px-2 py-0.5 text-[10.5px] font-extrabold text-navy"
                >
                  ★ {t('attendanceLeader')}
                </span>
              )}
              {r.studentId && (choDuyet.get(r.studentId) ?? 0) > 0 && (
                <span
                  title={t('pendingTitle')}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-gold/25 px-2 py-0.5 text-[10.5px] font-extrabold text-gold-text"
                >
                  {t('pendingChip', {n: choDuyet.get(r.studentId) ?? 0})}
                </span>
              )}
              {!r.studentId && (
                <span
                  title={t('notSignedInTitle')}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-navy/[0.07] px-2 py-0.5 text-[10.5px] font-extrabold text-navy/70"
                >
                  ○ {t('notSignedIn')}
                </span>
              )}
            </span>
            {xemChiTiet && (
              <span className="min-w-0 truncate text-[12.5px] font-bold text-navy/70">
                {r.code ?? '—'}
              </span>
            )}
            <span className="min-w-0 truncate text-[12.5px] font-semibold text-grey-mid">
              {r.email}
            </span>
            {xemChiTiet && (
              <>
                <span className="min-w-0 truncate text-[12.5px] font-semibold text-grey-mid">
                  {ngayVN(r.dob)}
                </span>
                <span className="min-w-0 truncate text-[12.5px] font-semibold text-grey-mid">
                  {r.phone ?? '—'}
                </span>
                <span
                  className="min-w-0 truncate text-[12.5px] font-semibold text-grey-mid"
                  title={r.note ?? ''}
                >
                  {r.note ?? '—'}
                </span>
              </>
            )}
            {/* Ô THAO TÁC — dời lớp, sửa, xoá. Nút dời lớp nay nằm trong đây thay vì chiếm một ô
                riêng chỉ có ở vài dòng (xem ghi chú ở phần khai cột). */}
            <span className="flex min-w-0 items-center justify-end gap-1.5">
              {/* Dời sang lớp khác. Chỉ cho em ĐÃ có tài khoản: em chưa đăng nhập lần nào thì
                  chưa có hàng ghi danh nào để dời — sửa lời mời là xong. */}
              {canManage && r.studentId && (
                <TransferControl
                  classId={myClass.id}
                  studentId={r.studentId}
                  studentName={r.name}
                  targets={lopDichList}
                  pending={dangChoTheoEm.get(r.studentId)}
                  laAdmin={laAdmin}
                />
              )}
              {/* Sửa thông tin ngay trên dòng. Chỉ hiện với người quản lý được lớp — và cũng chỉ
                  họ đọc được student_details (RLS 0058), nên với hiệu trưởng nút này vô nghĩa. */}
              {canManage && (
                <SuaHocSinh
                  classId={myClass.id}
                  email={r.email}
                  ten={r.name}
                  chiTiet={{
                    full_name: r.tenDaDien,
                    student_code: r.code,
                    date_of_birth: r.dob,
                    parent_phone: r.phone,
                    note: r.note,
                  }}
                />
              )}
              {canManage && r.studentId && (
                <form action={removeStudent}>
                  <input type="hidden" name="classId" value={myClass.id} />
                  <input type="hidden" name="studentId" value={r.studentId} />
                  <ConfirmButton
                    message={t('confirmRemove', {name: r.name})}
                    className="grid h-8 w-8 cursor-pointer place-items-center rounded-[9px] border-[1.5px] border-status-bad/30 bg-status-bad/[0.08] text-status-bad transition-all hover:bg-status-bad/[0.16]"
                  >
                    ✕
                  </ConfirmButton>
                </form>
              )}
              {canManage && !r.studentId && (
                <form action={cancelStudentInvite}>
                  <input type="hidden" name="classId" value={myClass.id} />
                  <input type="hidden" name="email" value={r.email} />
                  <ConfirmButton
                    message={t('cancelInviteConfirm', {email: r.email})}
                    className="grid h-8 w-8 cursor-pointer place-items-center rounded-[9px] border-[1.5px] border-navy/20 bg-white text-navy/70 transition-all hover:border-navy"
                  >
                    ✕
                  </ConfirmButton>
                </form>
              )}
            </span>
          </div>
        ))}
        {rows.length === 0 && (
          <div className="border-t border-navy/[0.08] px-[18px] py-8 text-center text-sm text-grey-mid">
            {t('noStudents')}
          </div>
        )}
      </div>

      {/* Bảng cảm xúc 7 ngày ĐÃ DỜI sang trang Điểm danh: check-in cảm xúc CHÍNH LÀ điểm danh
          (student_checkin ghi cả mood_checkins lẫn attendance_records), nên đặt cạnh nhau mới
          đọc được cùng lúc. */}

      {/* BUDDY & LỊCH PDR (PRD v3, 0146) — chỉ người quản lớp; học sinh xem trên màn của mình. */}
      {canManage && (
        <KhuBuddyPdr
          classId={myClass.id}
          hocSinh={candidates.map((c) => ({id: c.id, name: c.name}))}
        />
      )}
    </div>
  );
}
