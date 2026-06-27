import * as THREE from "three";

export type BodyPart = "head" | "torso" | "arms" | "legs";
export const BODY_PARTS: BodyPart[] = ["head", "torso", "arms", "legs"];

export type Stroke = {
  part: BodyPart;
  u: number;
  v: number;
  color: string;
  radius: number;
};

type PartCanvas = {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  texture: THREE.CanvasTexture;
};

type PlayerCanvases = Record<BodyPart, PartCanvas>;

export const CANVAS_SIZE = 256;
const BASE_COLOR = "#ffffff";

// Registry sống ở module-scope (ngoài React) — vì network handler (net/colyseus.ts)
// cần vẽ lên canvas của BẤT KỲ player nào (không chỉ player đang render ở component
// hiện tại), không tiện truyền ref xuyên suốt React tree cho việc này.
const registry = new Map<string, PlayerCanvases>();

function createPartCanvas(): PartCanvas {
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

/** Lấy (hoặc tạo mới nếu chưa có) bộ 4 canvas của 1 player. */
export function getOrCreatePlayerCanvases(sessionId: string): PlayerCanvases {
  let existing = registry.get(sessionId);
  if (!existing) {
    existing = {
      head: createPartCanvas(),
      torso: createPartCanvas(),
      arms: createPartCanvas(),
      legs: createPartCanvas(),
    };
    registry.set(sessionId, existing);
  }
  return existing;
}

/** Gọi khi player rời phòng — giải phóng canvas/texture không còn cần. */
export function releasePlayerCanvases(sessionId: string) {
  registry.delete(sessionId);
}

/** Vẽ 1 chấm màu (nét cọ) lên đúng phần cơ thể của 1 player, tại toạ độ UV. */
export function paintDab(
  sessionId: string,
  part: BodyPart,
  u: number,
  v: number,
  color: string,
  radius: number
) {
  const canvases = getOrCreatePlayerCanvases(sessionId);
  const pc = canvases[part];
  const x = u * CANVAS_SIZE;
  const y = (1 - v) * CANVAS_SIZE; // v=0 ở đáy — khớp quy ước trong colorSampling.ts
  const r = radius * CANVAS_SIZE;

  pc.ctx.fillStyle = color;
  pc.ctx.beginPath();
  pc.ctx.arc(x, y, r, 0, Math.PI * 2);
  pc.ctx.fill();
  pc.texture.needsUpdate = true;
}

export function replayStrokes(sessionId: string, strokes: Stroke[]) {
  for (const s of strokes) paintDab(sessionId, s.part, s.u, s.v, s.color, s.radius);
}
