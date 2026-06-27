import { Pipette, Palette, X } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import { sfx } from "../audio/sounds";

/**
 * Nút "Tô màu" — bấm vào sẽ CỐ ĐỊNH nhân vật + camera (đứng yên hẳn, không
 * xoay theo chuột nữa), nhả pointer-lock để chuột thật điều khiển con trỏ.
 * Trong chế độ này, GỘP CHUNG cả 2 việc — không cần thoát/vào lại giữa 2
 * bước:
 *   - Nhắm vào MÔI TRƯỜNG (tường, sàn...) -> hút màu (click để cầm màu đó).
 *   - Nhắm vào NGƯỜI MÌNH -> vẽ (giữ chuột trái để tô liên tục).
 * Vì camera đứng yên và KHÔNG tách scene riêng, môi trường xung quanh vẫn
 * còn nguyên trong tầm nhìn suốt — so màu vừa hút với người mình ngay tại
 * chỗ, không cần xoay qua xoay lại.
 *
 * Bấm lại (hoặc Escape) để thoát, quay lại điều khiển bình thường.
 * Muốn tô mặt khác của người (lưng, hông...): thoát, tự xoay người cho mặt
 * cần tô hướng ra camera, vào lại.
 */
export function ColorPickerUI() {
  const heldColor = useGameStore((s) => s.heldColor);
  const isPainting = useGameStore((s) => s.isPainting);
  const setIsPainting = useGameStore((s) => s.setIsPainting);

  const togglePaint = () => {
    setIsPainting(!isPainting);
    sfx.uiClick();
  };

  return (
    <div
      className="pointer-events-auto fixed bottom-4 left-1/2 -translate-x-1/2
                 bg-surface rounded-panel shadow-hard-surface px-4 py-3
                 flex items-center gap-3 font-body select-none"
    >
      <div
        className="relative w-9 h-9 rounded-full border-2 border-ink/20 shrink-0
                   flex items-center justify-center"
        style={{ backgroundColor: heldColor ?? "#e5e5e5" }}
        title={heldColor ?? "Chưa cầm màu"}
      >
        <Pipette
          size={14}
          className={heldColor ? "text-white/80" : "text-ink/40"}
          strokeWidth={2.5}
        />
      </div>

      <div className="text-sm text-ink/70 max-w-[220px]">
        {isPainting
          ? "Nhắm vào tường để hút màu · Nhắm vào người để tô"
          : heldColor
          ? "Đang cầm màu này"
          : "Bấm \"Tô màu\" để bắt đầu"}
      </div>

      <button
        onClick={togglePaint}
        className={`flex items-center gap-1.5 font-display font-bold text-sm px-4 py-2 rounded-pill transition
          active:translate-y-[2px] active:shadow-none
          ${isPainting ? "bg-primary text-white shadow-hard-primary" : "bg-accent text-white shadow-hard-accent"}`}
      >
        {isPainting ? <X size={16} /> : <Palette size={16} />}
        {isPainting ? "Xong" : "Tô màu"}
      </button>
    </div>
  );
}
