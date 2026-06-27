const SAMPLE_RATE = 44100;

/** Sóng sine với tần số biến đổi theo thời gian (sweep) + envelope biên độ tuỳ ý. */
function tone(
  durationSec: number,
  freqAt: (t: number) => number,
  ampAt: (t: number) => number
): Float32Array {
  const n = Math.floor(SAMPLE_RATE * durationSec);
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    const freq = freqAt(t);
    phase += (2 * Math.PI * freq) / SAMPLE_RATE;
    out[i] = Math.sin(phase) * ampAt(t);
  }
  return out;
}

/** Tiếng ồn trắng + envelope — dùng cho tiếng click/tạch percussive. */
function noiseBurst(durationSec: number, ampAt: (t: number) => number): Float32Array {
  const n = Math.floor(SAMPLE_RATE * durationSec);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SAMPLE_RATE;
    out[i] = (Math.random() * 2 - 1) * ampAt(t);
  }
  return out;
}

function concat(...buffers: Float32Array[]): Float32Array {
  const total = buffers.reduce((sum, b) => sum + b.length, 0);
  const out = new Float32Array(total);
  let offset = 0;
  for (const b of buffers) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
}

function mix(a: Float32Array, b: Float32Array): Float32Array {
  const n = Math.max(a.length, b.length);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = (a[i] ?? 0) + (b[i] ?? 0);
  return out;
}

const decay = (rate: number) => (t: number) => Math.exp(-rate * t);

/** "Blop" vui tai khi tô màu lên mannequin. */
export function synthPaintPop(): Float32Array {
  return tone(
    0.12,
    (t) => 500 + 500 * t,
    decay(28)
  );
}

/** Tiếng súng đồ chơi — sweep tần số xuống nhanh, không phải súng thật. */
export function synthGunshot(): Float32Array {
  // Giảm scale từng phần vì mix() là cộng trực tiếp — nếu để biên độ đỉnh
  // mỗi phần ở 1.0 thì lúc t=0 tổng 2 sóng sẽ vượt [-1,1] (đã bắt bằng
  // audio-check.mjs, xem ghi chú trong README).
  const sweep = tone(0.14, (t) => 900 - 4000 * t, (t) => 0.65 * decay(18)(t));
  const click = noiseBurst(0.02, (t) => 0.3 * decay(120)(t));
  return mix(sweep, click);
}

/** Click rỗng khi hết đạn mà vẫn bấm bắn. */
export function synthEmptyClick(): Float32Array {
  return noiseBurst(0.03, decay(160));
}

/** "Ding" 2 nốt lên — bắn trúng Hider. */
export function synthHitDing(): Float32Array {
  const a = tone(0.09, () => 880, decay(14));
  const b = tone(0.14, () => 1320, decay(10));
  return concat(a, b);
}

/** Tiếng "thua" hài hước khi local player bị loại (3 nốt đi xuống). */
export function synthEliminated(): Float32Array {
  const a = tone(0.14, () => 392, decay(10));
  const b = tone(0.14, () => 330, decay(10));
  const c = tone(0.22, () => 262, decay(7));
  return concat(a, b, c);
}

/** Fanfare ngắn khi thắng — hợp âm đi lên. */
export function synthVictory(): Float32Array {
  const notes = [523, 659, 784, 1046];
  return concat(...notes.map((f) => tone(0.13, () => f, decay(9))));
}

/** Jingle ngắn khi thua — đi xuống, chậm hơn victory. */
export function synthDefeat(): Float32Array {
  const notes = [440, 392, 349, 293];
  return concat(...notes.map((f) => tone(0.18, () => f, decay(8))));
}

/** Click UI rất ngắn — phản hồi khi nhấn nút nhựa (active:translate-y). */
export function synthUiClick(): Float32Array {
  return tone(0.04, () => 1200, decay(60));
}
