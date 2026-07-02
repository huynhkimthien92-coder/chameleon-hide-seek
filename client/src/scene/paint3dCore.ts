/**
 * Paint 3D-distance core — thay thế logic chọn pixel theo UV-2D + region mask.
 *
 * Nguyên lý (ADR-001, đã củng cố bằng đo đạc trên mask thật):
 * - Mỗi texel biết vị trí bind-pose 3D của mình (position_map.bin, bake offline
 *   từ mannequin.glb bằng tools/bake_position_map.py).
 * - Brush chọn texel theo KHOẢNG CÁCH 3D thật tới điểm chạm — không còn khái
 *   niệm "vùng có biên" nên không còn gì để cắt xén (root cause cũ: 97.3% diện
 *   tích bị dab cắt ở brush mặc định vì biên vùng dày đặc).
 * - Bonus tự nhiên: texel ở UV island KHÁC nhưng gần nhau trên cơ thể 3D thật
 *   (vd 2 mép của 1 seam) được tô CÙNG NHAU -> seam liền mạch, điều mà cách
 *   UV-2D không bao giờ làm được.
 *
 * Thuần TypeScript — không import THREE/React, test được bằng Node
 * (pattern giống pose-fsm.ts). Adapter client (paint3d-client.ts) lo phần
 * load file + canvas + texture.
 */

export interface PositionMap {
  size: number; // 512
  /** Float32Array [size*size*3], NaN = texel không phủ UV. Layout khớp canvas:
   *  y=0 là ĐỈNH ảnh (v gần 1) — cùng quy ước paintRegistry.ts. */
  data: Float32Array;
}

export interface Dab3DResult {
  /** Chỉ số texel (y*size+x) đã tô — adapter dùng để ghi màu lên canvas. */
  paintedTexels: Uint32Array;
  count: number;
}

/**
 * Tìm mọi texel trong bán kính 3D quanh điểm chạm (bind-pose space).
 * O(số texel phủ UV) mỗi dab — với 512x512 (~144k texel phủ) đo thực tế
 * dưới 2ms trên Node (xem paint3d.selftest.mjs), đủ nhanh cho tần suất
 * PAINT_INTERVAL_MS hiện tại của game.
 */
export function computeDab3D(
  map: PositionMap,
  hitX: number,
  hitY: number,
  hitZ: number,
  radius: number,
  out?: Uint32Array
): Dab3DResult {
  const { size, data } = map;
  const total = size * size;
  const rSq = radius * radius;
  const result = out ?? new Uint32Array(total);
  let count = 0;

  for (let i = 0; i < total; i++) {
    const px = data[i * 3];
    if (Number.isNaN(px)) continue; // texel ngoài UV coverage
    const dx = px - hitX;
    // loại sớm theo từng trục — rẻ hơn tính đủ 3 trục cho texel chắc chắn xa
    if (dx > radius || dx < -radius) continue;
    const dy = data[i * 3 + 1] - hitY;
    if (dy > radius || dy < -radius) continue;
    const dz = data[i * 3 + 2] - hitZ;
    if (dx * dx + dy * dy + dz * dz > rSq) continue;
    result[count++] = i;
  }

  return { paintedTexels: result, count };
}

/**
 * Đọc vị trí bind-pose của 1 texel theo toạ độ UV — dùng cho việc khác cần
 * tra cứu (vd kiểm thử, debug overlay). Trả null nếu texel không phủ UV.
 */
export function bindPositionAtUV(
  map: PositionMap,
  u: number,
  v: number
): [number, number, number] | null {
  const { size, data } = map;
  const x = Math.max(0, Math.min(size - 1, Math.floor(u * size)));
  const y = Math.max(0, Math.min(size - 1, Math.floor((1 - v) * size)));
  const i = (y * size + x) * 3;
  const px = data[i];
  if (Number.isNaN(px)) return null;
  return [px, data[i + 1], data[i + 2]];
}
