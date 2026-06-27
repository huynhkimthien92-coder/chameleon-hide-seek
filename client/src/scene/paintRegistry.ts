import * as THREE from "three";

export type Stroke = {
  u: number;
  v: number;
  color: string;
  radius: number;
};

type PlayerCanvas = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
};

export const CANVAS_SIZE = 512; // tăng từ 256 (bản 4-phần) vì giờ 1 texture phủ NGUYÊN người
const BASE_COLOR = "#ffffff";

// Registry sống ở module-scope (ngoài React) — vì network handler (net/colyseus.ts)
// cần vẽ lên canvas của BẤT KỲ player nào (không chỉ player đang render ở component
// hiện tại), không tiện truyền ref xuyên suốt React tree cho việc này.
const registry = new Map<string, PlayerCanvas>();

function createPlayerCanvas(): PlayerCanvas {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = BASE_COLOR;
  ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { canvas, ctx, texture };
}

/** Lấy (hoặc tạo mới nếu chưa có) canvas vẽ của 1 player — 1 texture DUY NHẤT
 * phủ toàn thân (mesh v3 là 1 khối liền có UV thật, không còn chia 4 phần
 * head/torso/arms/legs như bản trước — xem README mục Mannequin v3). */
export function getOrCreatePlayerCanvas(sessionId: string): PlayerCanvas {
  let existing = registry.get(sessionId);
  if (!existing) {
    existing = createPlayerCanvas();
    registry.set(sessionId, existing);
  }
  return existing;
}

/** Gọi khi player rời phòng — giải phóng canvas/texture không còn cần. */
export function releasePlayerCanvas(sessionId: string) {
  registry.delete(sessionId);
}

/** Vẽ 1 chấm màu (nét cọ) lên canvas của 1 player, tại toạ độ UV. */
export function paintDab(sessionId: string, u: number, v: number, color: string, radius: number) {
  const pc = getOrCreatePlayerCanvas(sessionId);
  const x = u * CANVAS_SIZE;
  const y = (1 - v) * CANVAS_SIZE; // v=0 ở đáy — khớp quy ước trong colorSampling.ts

  pc.ctx.fillStyle = color;
  pc.ctx.beginPath();
  pc.ctx.arc(x, y, radius * CANVAS_SIZE, 0, Math.PI * 2);
  pc.ctx.fill();
  pc.texture.needsUpdate = true;
}

export function replayStrokes(sessionId: string, strokes: Stroke[]) {
  for (const s of strokes) paintDab(sessionId, s.u, s.v, s.color, s.radius);
}
