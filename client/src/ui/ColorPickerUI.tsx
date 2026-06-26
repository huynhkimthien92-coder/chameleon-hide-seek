import { Pipette } from "lucide-react";
import { useGameStore } from "../store/useGameStore";

/**
 * Chỉ còn hiện màu đang "cầm" (đã hút từ môi trường) — KHÔNG còn nút chọn
 * bộ phận/Áp dụng. Người chơi vẽ trực tiếp bằng cách nhắm + giữ chuột trái
 * lên đúng vị trí muốn trên người mình (xem useInteraction.ts), tự do chọn
 * vị trí, không bị ép vào 4 ô cố định.
 */
export function ColorPickerUI() {
  const heldColor = useGameStore((s) => s.heldColor);

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
      <div className="text-sm text-ink/70 max-w-[220px]">
        {heldColor
          ? "Đang cầm màu này — nhắm vào người mình, giữ chuột trái để vẽ"
          : "Click vào bề mặt môi trường để hút màu"}
      </div>
    </div>
  );
}
