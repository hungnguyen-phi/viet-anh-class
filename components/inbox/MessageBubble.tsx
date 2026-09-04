import {getTranslations} from 'next-intl/server';
import {khiNao} from './format';

type Dich = (key: string, values?: Record<string, string | number>) => string;


export type MessageRow = {
  id: string;
  sender_id: string | null;
  sender_role: string;
  sender_side: string;
  body: string;
  created_at: string;
};

/**
 * Tên hiển thị của người gửi — suy từ VAI và PHÍA, KHÔNG tra bảng profiles.
 *
 * Vì sao không tra tên thật: RLS của profiles (0004) chỉ cho đọc hồ sơ của chính mình, của con
 * mình (phụ huynh) hoặc của học sinh lớp mình (GVCN). Phụ huynh KHÔNG đọc được hồ sơ giáo viên
 * và giáo viên KHÔNG đọc được hồ sơ phụ huynh — nên một phép join tên người gửi sẽ trả về NULL
 * cho đúng những dòng cần nhất, mà vẫn tốn thêm một lượt truy vấn. Nhãn theo vai vừa luôn có,
 * vừa không mở thêm đường rò danh tính.
 *
 * sender_role được chụp lại lúc gửi (xem comment cột trong 0065) nên tin cũ vẫn đọc đúng bối
 * cảnh: người từng là GVCN nay lên ban giám hiệu thì tin cũ vẫn ghi "Giáo viên chủ nhiệm".
 */
export function tenNguoiGui(m: MessageRow, toiLaAi: string, t: Dich): string {
  if (m.sender_id && m.sender_id === toiLaAi) return t('senderYou');
  if (m.sender_side === 'school') {
    return m.sender_role === 'teacher' ? t('senderTeacher') : t('senderSchool');
  }
  // Cùng phía phụ huynh nhưng không phải mình: bố/mẹ còn lại cũng nhắn trong cùng một cuộc.
  return t('senderParent');
}

export async function MessageBubble({m, toiLaAi}: {m: MessageRow; toiLaAi: string}) {
  const t = await getTranslations('inbox');
  const cuaToi = Boolean(m.sender_id) && m.sender_id === toiLaAi;

  return (
    <div className={`flex ${cuaToi ? 'justify-end' : 'justify-start'}`}>
      <div className={`min-w-0 max-w-[85%] ${cuaToi ? 'text-right' : 'text-left'}`}>
        <div className="mb-1 px-1 text-nhan font-extrabold uppercase tracking-wide text-grey-mid">
          {tenNguoiGui(m, toiLaAi, t)} · {khiNao(m.created_at, t)}
        </div>
        {/* whitespace-pre-line: giữ lại các dòng người ta cố ý xuống hàng (danh sách, ký tên).
            break-words: một đường link dài không được kéo giãn khung trên điện thoại. */}
        <div
          className={`whitespace-pre-line break-words rounded-[16px] px-3.5 py-2.5 text-noi-dung font-semibold leading-[1.55] ${
            cuaToi
              ? 'bg-navy text-white'
              : 'border-[1.5px] border-navy/15 bg-white text-navy'
          }`}
        >
          {m.body}
        </div>
      </div>
    </div>
  );
}
