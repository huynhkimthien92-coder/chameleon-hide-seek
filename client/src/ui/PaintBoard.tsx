import { useEffect, useRef } from "react";
import { X, Pipette } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import {
  getOrCreatePlayerCanvases,
  paintDab,
  BODY_PARTS,
  CANVAS_SIZE,
  type BodyPart,
} from "../scene/paintRegistry";
import { sendPaintStroke } from "../net/colyseus";
import { sfx } from "../audio/sounds";

const DISPLAY_SIZE = 180; // px hiển thị mỗi ô — canvas pixel thật vẫn là CANVAS_SIZE (256)
const BRUSH_RADIUS = 0.045; // bán kính nét cọ, đơn vị UV (0..1) — nhỏ hơn bản 3D cũ vì giờ điều khiển chính xác hơn nhiều

const PART_LABELS: Record<BodyPart, string> = {
  head: "Đầu",
  torso: "Thân",
  arms: "Tay",
  legs: "Chân",
};

function PartCanvas({ part, sessionId, heldColor }: { part: BodyPart; sessionId: string; heldColor: string | null }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  // Vẽ lại đúng hiện trạng từ canvas gốc (nguồn sự thật dùng cho texture 3D)
  // mỗi khi mở bảng vẽ — để không bị "trắng lại" nếu đã vẽ từ trước.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const source = getOrCreatePlayerCanvases(sessionId)[part].canvas;
    ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  }, [sessionId, part]);

  const paintAt = (clientX: number, clientY: number) => {
    if (!heldColor) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const u = (clientX - rect.left) / rect.width;
    const v = 1 - (clientY - rect.top) / rect.height; // v=0 ở đáy, khớp colorSampling.ts
    if (u < 0 || u > 1 || v < 0 || v > 1) return;

    paintDab(sessionId, part, u, v, heldColor, BRUSH_RADIUS); // optimistic cục bộ + cập nhật texture 3D
    sendPaintStroke(part, u, v, heldColor, BRUSH_RADIUS); // đồng bộ cho người khác

    // Vẽ trực tiếp lên canvas hiển thị cho mượt (không chờ vòng lặp khác)
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = heldColor;
    ctx.beginPath();
    ctx.arc(u * canvas.width, (1 - v) * canvas.height, BRUSH_RADIUS * canvas.width, 0, Math.PI * 2);
    ctx.fill();
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        style={{ width: DISPLAY_SIZE, height: DISPLAY_SIZE }}
        className={`rounded-panel border-2 border-ink/15 touch-none ${
          heldColor ? "cursor-crosshair" : "cursor-not-allowed"
        }`}
        onMouseDown={(e) => {
          isDrawing.current = true;
          paintAt(e.clientX, e.clientY);
        }}
        onMouseMove={(e) => {
          if (isDrawing.current) paintAt(e.clientX, e.clientY);
        }}
        onMouseUp={() => {
          isDrawing.current = false;
        }}
        onMouseLeave={() => {
          isDrawing.current = false;
        }}
      />
      <span className="text-xs font-display font-bold text-ink/70">{PART_LABELS[part]}</span>
    </div>
  );
}

/**
 * Bảng vẽ 2D — thay cho việc nhắm+vẽ trong không gian 3D (đã bỏ vì luôn
 * vướng camera/góc nhìn, không kiểm soát chính xác được, xem README mục bug
 * fix). Hút màu từ môi trường vẫn làm trong 3D như cũ (đóng bảng để hút);
 * vẽ thì mở bảng này, kéo chuột trực tiếp như Paint/Photoshop — không còn
 * camera, không còn nhắm trúng/hụt.
 */
export function PaintBoard() {
  const isOpen = useGameStore((s) => s.isPaintBoardOpen);
  const setIsOpen = useGameStore((s) => s.setIsPaintBoardOpen);
  const heldColor = useGameStore((s) => s.heldColor);
  const sessionId = useGameStore((s) => s.sessionId);

  if (!isOpen || !sessionId) return null;

  const close = () => {
    setIsOpen(false);
    sfx.uiClick();
  };

  return (
    <div className="pointer-events-auto fixed inset-0 bg-ink/40 flex items-center justify-center z-50 font-body">
      <div className="bg-surface rounded-panel shadow-hard-surface p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-extrabold text-xl text-ink">Bảng vẽ</h2>
          <button
            onClick={close}
            className="w-8 h-8 rounded-full bg-base flex items-center justify-center
                       active:translate-y-[1px] active:shadow-none"
          >
            <X size={16} />
          </button>
        </div>

        <div
          className="mb-4 flex items-center gap-2 bg-base rounded-panel px-3 py-2"
          title={heldColor ?? "Chưa cầm màu"}
        >
          <div
            className="w-7 h-7 rounded-full border-2 border-ink/20 flex items-center justify-center shrink-0"
            style={{ backgroundColor: heldColor ?? "#e5e5e5" }}
          >
            <Pipette size={12} className={heldColor ? "text-white/90" : "text-ink/40"} />
          </div>
          <span className="text-sm text-ink/70">
            {heldColor ? "Kéo chuột trên 4 ô dưới để vẽ" : "Đóng bảng, click vào môi trường để hút màu trước"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-4 justify-center">
          {BODY_PARTS.map((part) => (
            <PartCanvas key={part} part={part} sessionId={sessionId} heldColor={heldColor} />
          ))}
        </div>
      </div>
    </div>
  );
}
