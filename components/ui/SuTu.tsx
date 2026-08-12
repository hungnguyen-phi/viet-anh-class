// ĐẦU SƯ TỬ — mascot của trường (PRD §Thương hiệu: "Mascot: đầu sư tử (Lion — từ Lion Camps)
// vẽ dạng icon SVG, bờm vàng gold, mặt nâu, mắt/mũi navy").
//
// Vì sao là component chứ không phải file .svg trong /public: chỗ dùng chính là nhãn "Buddy của
// em" đứng cạnh chữ, cần đổi cỡ theo cỡ chữ và không được thêm một vòng tải ảnh chỉ để hiện một
// hình 15px. Màu lấy thẳng từ biến CSS của hệ màu sẵn có, không đặt mã màu mới.
export function SuTu({size = 16, className}: {size?: number; className?: string}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {/* Bờm: 8 túm quanh mặt, vẽ bằng một vòng tròn nét đứt dày cho nhẹ hình */}
      <circle
        cx="12"
        cy="12"
        r="9"
        stroke="var(--color-gold)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray="3 3.2"
      />
      {/* Mặt */}
      <circle cx="12" cy="12" r="6.2" fill="var(--color-gold-deep, #b8860b)" opacity="0.22" />
      <circle cx="12" cy="12" r="6.2" stroke="var(--color-gold-deep, #b8860b)" strokeWidth="1.2" />
      {/* Mắt */}
      <circle cx="9.9" cy="11" r="0.95" fill="var(--color-navy)" />
      <circle cx="14.1" cy="11" r="0.95" fill="var(--color-navy)" />
      {/* Mũi + miệng */}
      <path
        d="M10.9 14.1h2.2L12 15.3z"
        fill="var(--color-navy)"
      />
      <path
        d="M12 15.3v1.1M12 16.4c-.7.7-1.9.7-2.5 0M12 16.4c.7.7 1.9.7 2.5 0"
        stroke="var(--color-navy)"
        strokeWidth="1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
