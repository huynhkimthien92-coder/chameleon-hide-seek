import { useEffect, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { X } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import { Mannequin } from "../scene/Mannequin";
import { paintDab, type BodyPart } from "../scene/paintRegistry";
import { sendPaintStroke } from "../net/colyseus";
import { sfx } from "../audio/sounds";

const BRUSH_RADIUS = 0.05; // bán kính nét cọ, đơn vị UV (0..1)

/** Mannequin vẽ được — chuột trái kéo để vẽ trực tiếp lên người, không qua ô vuông nào. */
function PaintableMannequin({ sessionId, heldColor }: { sessionId: string; heldColor: string | null }) {
  const isDrawing = useRef(false);

  // An toàn: nếu thả chuột ngoài model (không trúng mesh nào), onPartPointerUp
  // của R3F sẽ không bắn — bắt thêm ở window để chắc chắn isDrawing reset.
  useEffect(() => {
    const onWindowPointerUp = () => {
      isDrawing.current = false;
    };
    window.addEventListener("pointerup", onWindowPointerUp);
    return () => window.removeEventListener("pointerup", onWindowPointerUp);
  }, []);

  const paintAt = (part: BodyPart, uv?: THREE.Vector2) => {
    if (!heldColor || !uv) return;
    paintDab(sessionId, part, uv.x, uv.y, heldColor, BRUSH_RADIUS); // optimistic cục bộ + cập nhật texture
    sendPaintStroke(part, uv.x, uv.y, heldColor, BRUSH_RADIUS); // đồng bộ cho người khác
  };

  return (
    <Mannequin
      sessionId={sessionId}
      onPartPointerDown={(part, e) => {
        if (e.button !== 0) return; // chỉ chuột trái vẽ — chuột phải dành để OrbitControls xoay
        isDrawing.current = true;
        paintAt(part, e.uv);
      }}
      onPartPointerMove={(part, e) => {
        if (!isDrawing.current) return;
        paintAt(part, e.uv);
      }}
      onPartPointerUp={() => {
        isDrawing.current = false;
      }}
    />
  );
}

/**
 * Bảng vẽ — khung xem 3D RIÊNG, TÁCH HẲN khỏi camera chơi game. Vẽ trực
 * tiếp lên người (chuột trái kéo), xoay xem các mặt bằng chuột phải (không
 * dùng chuột trái để xoay — tránh xung đột với việc vẽ). Vì camera này độc
 * lập hoàn toàn với gameplay, không còn vướng vấn đề "người xoay theo camera"
 * hay "khó nhắm trúng" như cách làm trong không gian chơi game trước đây
 * (xem README mục bug fix — đã thử nhiều cách vá camera gameplay nhưng vẫn
 * không ổn, nên tách hẳn ra theo hướng này).
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
      <div className="bg-surface rounded-panel shadow-hard-surface p-4 w-[440px]">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-display font-extrabold text-xl text-ink">Bảng vẽ</h2>
          <button
            onClick={close}
            className="w-8 h-8 rounded-full bg-base flex items-center justify-center
                       active:translate-y-[1px] active:shadow-none"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mb-3 flex items-center gap-2 bg-base rounded-panel px-3 py-2">
          <div
            className="w-6 h-6 rounded-full border-2 border-ink/20 shrink-0"
            style={{ backgroundColor: heldColor ?? "#e5e5e5" }}
          />
          <span className="text-sm text-ink/70">
            {heldColor
              ? "Chuột trái kéo: vẽ · Chuột phải kéo: xoay xem các mặt"
              : "Đóng bảng, click vào môi trường để hút màu trước"}
          </span>
        </div>

        <div
          className="rounded-panel overflow-hidden border-2 border-ink/10"
          style={{ height: 380 }}
          onContextMenu={(e) => e.preventDefault()} // chặn menu chuột phải của trình duyệt (dùng để xoay)
        >
          <Canvas camera={{ position: [0, 1, 2.6], fov: 35 }}>
            <ambientLight intensity={0.7} />
            <directionalLight position={[2, 3, 2]} intensity={1.2} />
            <directionalLight position={[-2, 1, -2]} intensity={0.4} />

            <PaintableMannequin sessionId={sessionId} heldColor={heldColor} />

            <OrbitControls
              target={[0, 0.9, 0]}
              enablePan={false}
              enableDamping
              minDistance={1.3}
              maxDistance={4}
              mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
            />
          </Canvas>
        </div>
      </div>
    </div>
  );
}
