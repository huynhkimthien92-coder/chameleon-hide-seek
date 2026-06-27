import { Pipette, Palette } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import { sfx } from "../audio/sounds";

/**
 * Hiện màu đang "cầm" (đã hút từ môi trường) + nút mở Bảng vẽ (PaintBoard.tsx)
 * để vẽ lên người — vẽ không còn làm trực tiếp trong không gian 3D nữa (đã
 * bỏ vì luôn vướng camera/góc nhìn, xem README mục bug fix).
 */
export function ColorPickerUI() {
  const heldColor = useGameStore((s) => s.heldColor);
  const setIsPaintBoardOpen = useGameStore((s) => s.setIsPaintBoardOpen);

  const openBoard = () => {
    setIsPaintBoardOpen(true);
    document.exitPointerLock();
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

      <div className="text-sm text-ink/70 max-w-[180px]">
        {heldColor ? "Đang cầm màu này" : "Click vào môi trường để hút màu"}
      </div>

      <button
        onClick={openBoard}
        className="flex items-center gap-1.5 font-display font-bold text-sm px-4 py-2 rounded-pill
                   bg-accent text-white shadow-hard-accent cursor-pointer transition
                   active:translate-y-[2px] active:shadow-none"
      >
        <Palette size={16} />
        Bảng vẽ
      </button>
    </div>
  );
}
