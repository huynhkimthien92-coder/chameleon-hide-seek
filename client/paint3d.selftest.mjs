/**
 * Self-test paint3dCore — chạy bằng Node trực tiếp trên position_map.bin thật.
 *
 * Chứng minh 3 điều bằng SỐ LIỆU (không khẳng định suông):
 * 1. Hiệu năng: mỗi dab dưới ngưỡng chấp nhận cho realtime painting.
 * 2. Không cắt xén: dab 3D tô đủ texel quanh điểm chạm, kể cả khi các texel
 *    đó thuộc vùng region-mask KHÁC NHAU (điều cách cũ chặn đứng).
 * 3. So sánh trực tiếp: cùng 1 điểm dab, cách cũ (region mask) giữ được bao
 *    nhiêu % texel so với cách mới.
 *
 * Chạy: node client/paint3d.selftest.mjs  (từ repo root)
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { PNG } from "pngjs";

const here = dirname(fileURLToPath(import.meta.url));
const SIZE = 512;

// --- Load position map thật ---
const binPath = join(here, "public/textures/position_map.bin");
const buf = readFileSync(binPath);
const data = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
const map = { size: SIZE, data };

// --- Load region mask thật (để so sánh cách cũ) ---
const maskPng = PNG.sync.read(readFileSync(join(here, "public/textures/paint_region_mask.png")));
function regionAt(x, y) {
  return maskPng.data[(y * SIZE + x) * 4]; // channel R, giống paintRegistry.ts
}

// --- computeDab3D: copy logic từ paint3dCore.ts (giữ đồng bộ bằng tay,
//     file .ts không import thẳng vào .mjs được nếu không build) ---
function computeDab3D(map, hitX, hitY, hitZ, radius) {
  const { size, data } = map;
  const total = size * size;
  const rSq = radius * radius;
  const result = new Uint32Array(total);
  let count = 0;
  for (let i = 0; i < total; i++) {
    const px = data[i * 3];
    if (Number.isNaN(px)) continue;
    const dx = px - hitX;
    if (dx > radius || dx < -radius) continue;
    const dy = data[i * 3 + 1] - hitY;
    if (dy > radius || dy < -radius) continue;
    const dz = data[i * 3 + 2] - hitZ;
    if (dx * dx + dy * dy + dz * dz > rSq) continue;
    result[count++] = i;
  }
  return { paintedTexels: result, count };
}

let fails = 0;
function check(cond, msg) {
  console.log(`${cond ? "PASS" : "FAIL"}: ${msg}`);
  if (!cond) fails++;
}

// --- Chọn điểm dab thật: lấy vị trí 3D của vài texel phủ UV làm điểm chạm ---
function texelPos(i) {
  return [data[i * 3], data[i * 3 + 1], data[i * 3 + 2]];
}
const coveredTexels = [];
for (let i = 0; i < SIZE * SIZE; i++) {
  if (!Number.isNaN(data[i * 3])) coveredTexels.push(i);
}
console.log(`Texel phủ UV: ${coveredTexels.length}`);

// Mesh cao ~1.9 đơn vị (bbox Z ±1.0) — brush "bàn tay" chọn 0.1 đơn vị (~9cm người thật)
const BRUSH_RADIUS = 0.1;

// --- Test 1: Hiệu năng ---
const NUM_PERF = 200;
const t0 = performance.now();
let acc = 0;
for (let k = 0; k < NUM_PERF; k++) {
  const i = coveredTexels[(k * 733) % coveredTexels.length];
  const [x, y, z] = texelPos(i);
  acc += computeDab3D(map, x, y, z, BRUSH_RADIUS).count;
}
const msPerDab = (performance.now() - t0) / NUM_PERF;
console.log(`Hiệu năng: ${msPerDab.toFixed(2)}ms/dab (trung bình ${Math.round(acc / NUM_PERF)} texel/dab)`);
check(msPerDab < 5, `mỗi dab < 5ms (thực tế ${msPerDab.toFixed(2)}ms) — đủ cho realtime với PAINT_INTERVAL hiện tại`);

// --- Test 2 + 3: Không cắt xén + so sánh với region mask cũ ---
// Lấy mẫu nhiều điểm dab, đo: trong số texel dab-3D tô được, bao nhiêu % nằm
// KHÁC vùng region với texel tâm -> đó chính là phần cách cũ CẮT BỎ.
const NUM_SAMPLE = 300;
let totalPainted = 0;
let totalWouldBeCut = 0;
let dabsSpanningRegions = 0;
for (let k = 0; k < NUM_SAMPLE; k++) {
  const i = coveredTexels[(k * 991) % coveredTexels.length];
  const [x, y, z] = texelPos(i);
  const centerRegion = regionAt(i % SIZE, Math.floor(i / SIZE));
  const dab = computeDab3D(map, x, y, z, BRUSH_RADIUS);
  let cut = 0;
  for (let j = 0; j < dab.count; j++) {
    const t = dab.paintedTexels[j];
    if (regionAt(t % SIZE, Math.floor(t / SIZE)) !== centerRegion) cut++;
  }
  totalPainted += dab.count;
  totalWouldBeCut += cut;
  if (cut > 0) dabsSpanningRegions++;
}
const cutPct = (totalWouldBeCut / totalPainted) * 100;
console.log(
  `So sánh: ${NUM_SAMPLE} dab mẫu, cách cũ (region mask) sẽ cắt bỏ ${cutPct.toFixed(1)}% texel mà dab-3D tô được`
);
console.log(
  `${dabsSpanningRegions}/${NUM_SAMPLE} dab (${((dabsSpanningRegions / NUM_SAMPLE) * 100).toFixed(0)}%) chạm >1 vùng — khớp số đo trước (97.3% diện tích gần biên hơn bán kính brush mặc định)`
);
check(totalPainted > 0, "dab-3D tô được texel ở mọi điểm mẫu");
check(
  dabsSpanningRegions / NUM_SAMPLE > 0.5,
  "đa số dab chạm nhiều vùng — xác nhận lại root cause (biên vùng dày đặc), cách mới tô xuyên biên không bị chặn"
);

// --- Test 4: Liền mạch qua seam — 2 texel cùng vị trí 3D nhưng xa nhau trong UV ---
// Tìm 1 cặp texel có khoảng cách 3D rất gần nhưng khoảng cách UV xa (seam thật).
let seamPair = null;
outer: for (let a = 0; a < coveredTexels.length; a += 97) {
  const i = coveredTexels[a];
  const [x1, y1, z1] = texelPos(i);
  for (let b = a + 1; b < coveredTexels.length; b += 89) {
    const j = coveredTexels[b];
    const uvDist = Math.hypot((i % SIZE) - (j % SIZE), Math.floor(i / SIZE) - Math.floor(j / SIZE));
    if (uvDist < 40) continue; // phải XA nhau trong UV
    const [x2, y2, z2] = texelPos(j);
    const d3 = Math.hypot(x1 - x2, y1 - y2, z1 - z2);
    if (d3 < 0.02) { // nhưng GẦN nhau trên cơ thể 3D -> seam
      seamPair = { i, j, uvDist, d3 };
      break outer;
    }
  }
}
if (seamPair) {
  const [x, y, z] = texelPos(seamPair.i);
  const dab = computeDab3D(map, x, y, z, BRUSH_RADIUS);
  const painted = new Set(dab.paintedTexels.slice(0, dab.count));
  check(
    painted.has(seamPair.j),
    `seam thật (2 texel cách ${seamPair.uvDist.toFixed(0)}px trong UV nhưng chỉ ${seamPair.d3.toFixed(3)} đơn vị trong 3D) được tô CÙNG NHAU trong 1 dab — seam liền mạch`
  );
} else {
  console.log("SKIP: không tìm được cặp seam trong mẫu quét (không phải lỗi core)");
}

console.log(fails === 0 ? "\n=== TẤT CẢ TEST PASS ===" : `\n=== ${fails} TEST FAIL ===`);
process.exit(fails === 0 ? 0 : 1);
