import * as THREE from "three";
import { computeDab3D, type PositionMap } from "./paint3dCore";
import { getOrCreatePlayerCanvas, CANVAS_SIZE } from "./paintRegistry";

/**
 * Adapter nối paint3dCore (thuần) vào pipeline canvas/texture hiện có.
 *
 * Thay thế paintDab (UV-2D + region mask) bằng paintDab3D (khoảng cách 3D
 * bind-pose) — lý do và bằng chứng: xem paint3d.selftest.mjs + ADR-001.
 * paintRegistry cũ vẫn giữ nguyên phần quản lý canvas/texture per-player
 * (đã chạy ổn, không viết lại) — chỉ logic CHỌN PIXEL là thay.
 *
 * Network: gửi (bindPoint, color, radius) thay vì (u, v, color, radius) —
 * cùng kích thước message (3 float thay 2), replay bên nhận cho kết quả
 * y hệt vì position map là tài nguyên tĩnh giống nhau ở mọi client.
 */

let positionMap: PositionMap | null = null;
let loadStarted = false;
// buffer tái dùng giữa các dab — tránh cấp phát 1MB mỗi nét cọ
let scratch: Uint32Array | null = null;

export function ensurePositionMapLoading() {
  if (loadStarted) return;
  loadStarted = true;
  fetch("/textures/position_map.bin")
    .then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      return r.arrayBuffer();
    })
    .then((buf) => {
      positionMap = { size: CANVAS_SIZE, data: new Float32Array(buf) };
      scratch = new Uint32Array(CANVAS_SIZE * CANVAS_SIZE);
      flushPendingReplays(); // replay các batch đến trước khi map sẵn sàng
    })
    .catch((e) => {
      console.warn("[paint3d] Không tải được position_map.bin — painting 3D tắt.", e);
    });
}
ensurePositionMapLoading();

export function isPaint3DReady(): boolean {
  return positionMap !== null;
}

/** Nét vẽ 3D — thay Stroke UV cũ. Cùng cỡ message (3 float thay 2). */
export type Stroke3D = {
  x: number;
  y: number;
  z: number;
  color: string;
  radius: number;
};

/**
 * Vẽ lại toàn bộ nét đã có của 1 player (catch-up lúc mới vào phòng).
 * Nếu position map CHƯA tải xong lúc này, giữ lại chờ rồi replay ngay khi
 * map sẵn sàng — không được lặng lẽ bỏ qua (người vào sau sẽ thấy Hider
 * trắng trơn dù đã tô, phá gameplay).
 */
const pendingReplays: Array<{ sessionId: string; strokes: Stroke3D[] }> = [];
export function replayStrokes3D(sessionId: string, strokes: Stroke3D[]) {
  if (!positionMap) {
    pendingReplays.push({ sessionId, strokes });
    return;
  }
  for (const s of strokes) {
    paintDab3D(sessionId, { x: s.x, y: s.y, z: s.z }, s.color, s.radius);
  }
}
function flushPendingReplays() {
  while (pendingReplays.length > 0) {
    const { sessionId, strokes } = pendingReplays.shift()!;
    for (const s of strokes) {
      paintDab3D(sessionId, { x: s.x, y: s.y, z: s.z }, s.color, s.radius);
    }
  }
}

const colorCache = new Map<string, [number, number, number]>();
function cssColorToRgb(color: string): [number, number, number] {
  const hit = colorCache.get(color);
  if (hit) return hit;
  const c = document.createElement("canvas");
  c.width = c.height = 1;
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, 1, 1);
  const d = ctx.getImageData(0, 0, 1, 1).data;
  const rgb: [number, number, number] = [d[0], d[1], d[2]];
  colorCache.set(color, rgb);
  return rgb;
}

/**
 * Tô 1 nét cọ theo khoảng cách 3D quanh điểm chạm (bind-pose space).
 * @param bindPoint điểm chạm đã quy về bind-pose (từ manualRaycastOwnBody)
 * @param radius bán kính 3D, đơn vị local của mesh (mesh cao ~1.9 đơn vị;
 *               brush "bàn tay" hợp lý quanh 0.06–0.25 — tune qua slider)
 */
export function paintDab3D(
  sessionId: string,
  bindPoint: { x: number; y: number; z: number },
  color: string,
  radius: number
) {
  if (!positionMap || !scratch) return; // map chưa tải xong — bỏ qua an toàn

  const dab = computeDab3D(positionMap, bindPoint.x, bindPoint.y, bindPoint.z, radius, scratch);
  if (dab.count === 0) return;

  const pc = getOrCreatePlayerCanvas(sessionId);
  const img = pc.ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  const [r, g, b] = cssColorToRgb(color);
  for (let k = 0; k < dab.count; k++) {
    const i = dab.paintedTexels[k] * 4;
    img.data[i] = r;
    img.data[i + 1] = g;
    img.data[i + 2] = b;
    img.data[i + 3] = 255;
  }
  pc.ctx.putImageData(img, 0, 0);
  pc.texture.needsUpdate = true;
}

/**
 * Nội suy bind-pose position tại điểm trúng của tam giác — dùng trong
 * manualRaycastOwnBody. Tách hàm riêng để test được và để raycast giữ gọn.
 *
 * QUAN TRỌNG: đọc geometry.attributes.position GỐC (bind-pose, CHƯA skin) —
 * khác với mesh.getVertexPosition (đã áp skinning theo pose hiện tại).
 * Nhờ vậy KHÔNG cần inverse skin matrix: tam giác trúng cho ta thẳng
 * barycentric của điểm chạm, nội suy trên bind position là xong.
 */
export function interpolateBindPosition(
  geometry: THREE.BufferGeometry,
  a: number,
  b: number,
  c: number,
  skinnedA: THREE.Vector3,
  skinnedB: THREE.Vector3,
  skinnedC: THREE.Vector3,
  hitPointLocal: THREE.Vector3,
  target: THREE.Vector3
): THREE.Vector3 {
  const posAttr = geometry.attributes.position as THREE.BufferAttribute;
  const bindA = new THREE.Vector3().fromBufferAttribute(posAttr, a);
  const bindB = new THREE.Vector3().fromBufferAttribute(posAttr, b);
  const bindC = new THREE.Vector3().fromBufferAttribute(posAttr, c);
  // barycentric tính trên tam giác ĐÃ SKIN (nơi ray thật sự trúng),
  // rồi áp cùng trọng số lên 3 đỉnh bind — chuẩn kỹ thuật giống cách
  // THREE.Triangle.getInterpolation đang nội suy UV trong raycast hiện tại.
  return THREE.Triangle.getInterpolation(
    hitPointLocal, skinnedA, skinnedB, skinnedC, bindA, bindB, bindC, target
  ) as THREE.Vector3;
}
