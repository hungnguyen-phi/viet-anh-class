'use client';

// Nút submit có hộp xác nhận (cho thao tác nguy hiểm như xoá).
// Mặc định kiểu "danger" đỏ nhạt của v3; caller vẫn có thể truyền className riêng.
export function ConfirmButton({
  message,
  className = 'cursor-pointer rounded-[10px] border-[1.5px] border-[rgba(192,57,43,0.3)] bg-[rgba(192,57,43,0.12)] px-3 py-1.5 text-sm font-bold text-status-bad transition-all hover:bg-[rgba(192,57,43,0.2)] active:translate-y-px',
  children,
}: {
  message: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
