import { Pipette, Paintbrush, X } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import { sfx } from "../audio/sounds";

/**
 * Hiện màu đang "cầm" (đã hút từ môi trường) + nút "Cọ vẽ" — bấm vào sẽ
 * CỐ ĐỊNH nhân vật + camera (đứng yên hẳn, không xoay theo chuột nữa), nhả
 * pointer-lock để chuột thật điều khiển con trỏ vẽ trực tiếp lên người NGAY
 * TRONG THẾ GIỚI GAME (xem useInteraction.ts) — giữ nguyên map/môi trường
 * xung quanh trong tầm nhìn để so màu cho khớp lúc vẽ. Bấm lại (hoặc Escape)
 * để thoát, quay lại điều khiển bình thường.
 *
 * Muốn vẽ mặt khác của người: thoát chế độ vẽ, tự xoay người (WASD/chuột)
 * cho mặt cần vẽ hướng ra camera, rồi vào vẽ lại — không xoay camera được
 * trong lúc vẽ (chủ ý, giống vẽ lên tranh, không phải xoay mô hình 3D).
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
        title={heldColor ?? "Chưa hút màu — click vào bề mặt môi trường để hút"}
      >
        <Pipette
          size={14}
          className={heldColor ? "text-white/80" : "text-ink/40"}
          strokeWidth={2.5}
        />
      </div>

      <div className="text-sm text-ink/70 max-w-[200px]">
        {isPainting
          ? "Đang vẽ — di chuột để rê cọ, giữ chuột trái để tô"
          : heldColor
          ? "Đang cầm màu này"
          : "Click vào môi trường để hút màu"}
      </div>

      <button
        onClick={togglePaint}
        className={`flex items-center gap-1.5 font-display font-bold text-sm px-4 py-2 rounded-pill transition
          active:translate-y-[2px] active:shadow-none
          ${isPainting ? "bg-primary text-white shadow-hard-primary" : "bg-accent text-white shadow-hard-accent"}`}
      >
        {isPainting ? <X size={16} /> : <Paintbrush size={16} />}
        {isPainting ? "Xong" : "Cọ vẽ"}
      </button>
    </div>
  );
}
