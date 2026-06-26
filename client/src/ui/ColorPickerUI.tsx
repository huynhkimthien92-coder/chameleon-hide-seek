import { Pipette } from "lucide-react";
import { useGameStore, type BodyPart } from "../store/useGameStore";
import { sendPaint } from "../net/colyseus";
import { sfx } from "../audio/sounds";

const PARTS: { id: BodyPart; label: string }[] = [
  { id: "head", label: "Đầu" },
  { id: "torso", label: "Thân" },
  { id: "arms", label: "Tay" },
  { id: "legs", label: "Chân" },
];

export function ColorPickerUI() {
  const pickedColor = useGameStore((s) => s.pickedColor);
  const selectedPart = useGameStore((s) => s.selectedPart);
  const setSelectedPart = useGameStore((s) => s.setSelectedPart);
  const applyPickedColorToLocal = useGameStore((s) => s.applyPickedColorToLocal);
  const setPickedColor = useGameStore((s) => s.setPickedColor);

  const handleApply = () => {
    if (!pickedColor) return;
    sendPaint(selectedPart, pickedColor);
    applyPickedColorToLocal();
    setPickedColor(null); // tiêu thụ màu đã hút — phải hút lại cho lượt sau
    sfx.paintPop();
  };

  const handleSelectPart = (part: BodyPart) => {
    setSelectedPart(part);
    sfx.uiClick();
  };

  return (
    <div
      className="pointer-events-auto fixed bottom-4 left-1/2 -translate-x-1/2
                 bg-surface rounded-panel shadow-hard-surface px-4 py-3
                 flex items-center gap-3 font-body select-none"
    >
      {/* Swatch màu đã hút — kèm icon eyedropper theo design.md */}
      <div
        className="relative w-9 h-9 rounded-full border-2 border-ink/20 shrink-0
                   flex items-center justify-center"
        style={{ backgroundColor: pickedColor ?? "#e5e5e5" }}
        title={pickedColor ?? "Chưa hút màu — click vào bề mặt để hút"}
      >
        <Pipette
          size={14}
          className={pickedColor ? "text-white/80" : "text-ink/40"}
          strokeWidth={2.5}
        />
      </div>

      {/* Chọn bộ phận */}
      <div className="flex gap-1">
        {PARTS.map((part) => (
          <button
            key={part.id}
            onClick={() => handleSelectPart(part.id)}
            className={`text-xs font-display font-bold px-3 py-1.5 rounded-pill transition
              ${
                selectedPart === part.id
                  ? "bg-accent text-white shadow-hard-accent"
                  : "bg-base text-ink"
              }`}
          >
            {part.label}
          </button>
        ))}
      </div>

      {/* Áp dụng */}
      <button
        onClick={handleApply}
        disabled={!pickedColor}
        className={`font-display font-bold text-sm px-4 py-2 rounded-pill transition
          active:translate-y-[2px] active:shadow-none
          ${
            pickedColor
              ? "bg-accent text-white shadow-hard-accent cursor-pointer"
              : "bg-base text-ink/40 cursor-not-allowed"
          }`}
      >
        Áp dụng
      </button>
    </div>
  );
}
