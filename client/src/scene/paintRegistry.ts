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

/**
 * ⚠️ BẢN ĐỒ VÙNG CƠ THỂ (region mask) — sửa bug "tô 1 chỗ, chỗ khác cũng đổi
 * màu theo". Nguyên nhân thật: UV của `mannequin.glb` không có khoảng đệm
 * giữa các bộ phận KHÔNG liên quan nhau (đo trực tiếp: mọi cặp bộ phận
 * không liền kề thật trên cơ thể đều cách nhau chỉ ~0.001-0.004 đơn vị UV
 * trên toàn bộ texture — vd ngực và đùi nằm cạnh nhau trong UV dù không hề
 * tiếp giáp ngoài thực tế). Giảm bán kính cọ KHÔNG giải quyết được (gap nhỏ
 * hơn cả bán kính tối thiểu còn dùng được). Không sửa được UV gốc bằng code
 * (cần làm lại unwrap bằng Blender — việc của 3D artist).
 *
 * Giải pháp ở TẦNG VẼ: ảnh `paint_region_mask.png` (tạo offline từ chính dữ
 * liệu mesh thật — rasterize từng tam giác UV theo xương chủ đạo) cho biết
 * MỖI PIXEL trên texture thuộc xương nào trong 22 xương — KHÔNG gộp nhóm
 * (lần đầu gộp 6 vùng macro làm Hông+Ngực chung 1 vùng, gây lan màu ngực
 * <-> háng — người dùng yêu cầu tự do hoàn toàn, không tự động gộp gì cả).
 * Khi vẽ, chỉ tô pixel CÙNG XƯƠNG CHỦ ĐẠO với điểm bấm — chặn lan màu sang
 * bất kỳ xương khác, kể cả 2 xương nối khớp tự nhiên (vd khuỷu tay).
 */
const REGION_MASK_URL = "/textures/paint_region_mask.png";
let regionMaskData: ImageData | null = null;
let regionMaskLoadStarted = false;

function ensureRegionMaskLoading() {
  if (regionMaskLoadStarted) return;
  regionMaskLoadStarted = true;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement("canvas");
    c.width = CANVAS_SIZE;
    c.height = CANVAS_SIZE;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(img, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
    regionMaskData = ctx.getImageData(0, 0, CANVAS_SIZE, CANVAS_SIZE);
  };
  img.onerror = () => {
    // Tải lỗi -> regionMaskData giữ null, paintDab tự fallback về vẽ không
    // giới hạn (an toàn, không crash, chỉ mất tác dụng chống lan màu).
    console.warn("[paintRegistry] Không tải được region mask, tắt chống lan màu.");
  };
  img.src = REGION_MASK_URL;
}
ensureRegionMaskLoading();

/** Đọc region (0-21, ứng đúng 1 trong 22 xương) tại 1 pixel, -1 nếu mask
 * chưa tải xong. Giá trị lưu RAW trong ảnh (không nhân hệ số gì). */
function regionAt(px: number, py: number): number {
  if (!regionMaskData) return -1;
  const x = Math.max(0, Math.min(CANVAS_SIZE - 1, Math.floor(px)));
  const y = Math.max(0, Math.min(CANVAS_SIZE - 1, Math.floor(py)));
  const idx = (y * CANVAS_SIZE + x) * 4;
  return regionMaskData.data[idx];
}

/** Convert bất kỳ chuỗi màu CSS hợp lệ (hex/rgb/named) sang [r,g,b] 0-255 —
 * dùng canvas 1x1 để trình duyệt tự parse, không tự viết parser hex/rgb. */
const colorRgbCache = new Map<string, [number, number, number]>();
function colorStringToRgb(color: string): [number, number, number] {
  const cached = colorRgbCache.get(color);
  if (cached) return cached;
  const tmp = document.createElement("canvas");
  tmp.width = 1;
  tmp.height = 1;
  const tctx = tmp.getContext("2d")!;
  tctx.fillStyle = color;
  tctx.fillRect(0, 0, 1, 1);
  const d = tctx.getImageData(0, 0, 1, 1).data;
  const rgb: [number, number, number] = [d[0], d[1], d[2]];
  colorRgbCache.set(color, rgb);
  return rgb;
}

function createPlayerCanvas(): PlayerCanvas {
  const canvas = document.createElement("canvas");
  canvas.width = CANVAS_SIZE;
  canvas.height = CANVAS_SIZE;
  // willReadFrequently: canvas này bị paintDab (và paintDab3D trong
  // paint3dClient.ts) gọi getImageData/putImageData liên tục mỗi nét cọ —
  // đúng loại "multiple readback operations" browser cảnh báo. Phải set ở
  // đây, lần getContext("2d") ĐẦU TIÊN — không sửa được ở nơi khác sau này.
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
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

/** Vẽ 1 chấm màu (nét cọ) lên canvas của 1 player, tại toạ độ UV. Chỉ tô
 * pixel CÙNG VÙNG cơ thể với điểm bấm (xem regionAt) — chặn lan màu sang
 * vùng không liên quan dù UV nằm sát nhau trong texture gốc. */
export function paintDab(sessionId: string, u: number, v: number, color: string, radius: number) {
  const pc = getOrCreatePlayerCanvas(sessionId);
  const cx = u * CANVAS_SIZE;
  const cy = (1 - v) * CANVAS_SIZE; // v=0 ở đáy — khớp quy ước trong colorSampling.ts
  const r = radius * CANVAS_SIZE;

  const targetRegion = regionAt(cx, cy);
  if (targetRegion < 0) {
    // Mask chưa tải xong (hiếm, chỉ vài frame đầu) -> vẽ không giới hạn,
    // an toàn hơn là chặn vẽ hoàn toàn.
    pc.ctx.fillStyle = color;
    pc.ctx.beginPath();
    pc.ctx.arc(cx, cy, r, 0, Math.PI * 2);
    pc.ctx.fill();
    pc.texture.needsUpdate = true;
    return;
  }

  const xMin = Math.max(0, Math.floor(cx - r));
  const xMax = Math.min(CANVAS_SIZE - 1, Math.ceil(cx + r));
  const yMin = Math.max(0, Math.floor(cy - r));
  const yMax = Math.min(CANVAS_SIZE - 1, Math.ceil(cy + r));
  const w = xMax - xMin + 1;
  const h = yMax - yMin + 1;
  if (w <= 0 || h <= 0) return;

  const imgData = pc.ctx.getImageData(xMin, yMin, w, h);
  const [cr, cg, cb] = colorStringToRgb(color);
  const rSq = r * r;
  for (let yy = 0; yy < h; yy++) {
    for (let xx = 0; xx < w; xx++) {
      const px = xMin + xx;
      const py = yMin + yy;
      const dx = px + 0.5 - cx;
      const dy = py + 0.5 - cy;
      if (dx * dx + dy * dy > rSq) continue;
      if (regionAt(px, py) !== targetRegion) continue; // CHẶN lan vùng khác
      const idx = (yy * w + xx) * 4;
      imgData.data[idx] = cr;
      imgData.data[idx + 1] = cg;
      imgData.data[idx + 2] = cb;
      imgData.data[idx + 3] = 255;
    }
  }
  pc.ctx.putImageData(imgData, xMin, yMin);
  pc.texture.needsUpdate = true;
}

export function replayStrokes(sessionId: string, strokes: Stroke[]) {
  for (const s of strokes) paintDab(sessionId, s.u, s.v, s.color, s.radius);
}
