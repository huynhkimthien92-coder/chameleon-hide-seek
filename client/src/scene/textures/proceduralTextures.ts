import * as THREE from "three";

export type PaintableTexture = {
  texture: THREE.Texture;
  canvas?: HTMLCanvasElement;
};

function makeCanvas(size = 256) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  return { canvas, ctx };
}

function finalize(canvas: HTMLCanvasElement): PaintableTexture {
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  // Lưu canvas gốc vào userData để useColorPicker đọc pixel sau này
  // (xem stack.md mục 4 — Color Picking Pipeline)
  texture.userData = { sourceCanvas: canvas };
  return { texture, canvas };
}

/** Khu Gỗ — vân gỗ với nhiều sắc nâu khác nhau */
export function createWoodTexture(): PaintableTexture {
  const { canvas, ctx } = makeCanvas();
  ctx.fillStyle = "#a9764f";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 60; i++) {
    const y = Math.random() * canvas.height;
    const h = 2 + Math.random() * 5;
    const tone = Math.random() > 0.5 ? "rgba(60,35,20,0.25)" : "rgba(200,160,110,0.2)";
    ctx.fillStyle = tone;
    ctx.fillRect(0, y, canvas.width, h);
  }
  return finalize(canvas);
}

/** Khu Bê tông — xám lốm đốm */
export function createConcreteTexture(): PaintableTexture {
  const { canvas, ctx } = makeCanvas();
  ctx.fillStyle = "#9a9a9a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 400; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const r = 1 + Math.random() * 2.5;
    const shade = 120 + Math.random() * 80;
    ctx.fillStyle = `rgba(${shade},${shade},${shade},0.5)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return finalize(canvas);
}

/** Khu Cây cảnh — xanh với đốm lá đậm/nhạt */
export function createPlantTexture(): PaintableTexture {
  const { canvas, ctx } = makeCanvas();
  ctx.fillStyle = "#4f7a3a";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 150; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const r = 4 + Math.random() * 10;
    const dark = Math.random() > 0.5;
    ctx.fillStyle = dark ? "rgba(30,60,20,0.35)" : "rgba(140,200,90,0.3)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return finalize(canvas);
}

/** Khu Vải/Canvas — be nhạt với vài vết màu loang (giống vải bố xưởng vẽ) */
export function createCanvasFabricTexture(): PaintableTexture {
  const { canvas, ctx } = makeCanvas();
  ctx.fillStyle = "#e8ddc7";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  // vân vải dạng sọc mảnh
  for (let i = 0; i < 100; i++) {
    const y = Math.random() * canvas.height;
    ctx.fillStyle = "rgba(160,145,110,0.1)";
    ctx.fillRect(0, y, canvas.width, 1);
  }
  // vết màu loang ngẫu nhiên (sơn vương ra vải)
  const splatColors = ["#c0392b", "#2980b9", "#27ae60", "#f1c40f"];
  for (let i = 0; i < 6; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const r = 8 + Math.random() * 18;
    ctx.fillStyle = splatColors[i % splatColors.length] + "55";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return finalize(canvas);
}

/** Khu Tường gạch — đỏ gạch với mạch vữa xám */
export function createBrickTexture(): PaintableTexture {
  const { canvas, ctx } = makeCanvas();
  ctx.fillStyle = "#9a9a8c"; // màu vữa nền
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const brickW = 34, brickH = 16, gap = 3;
  let row = 0;
  for (let y = 0; y < canvas.height; y += brickH + gap) {
    const offset = row % 2 === 0 ? 0 : brickW / 2;
    for (let x = -brickW; x < canvas.width; x += brickW + gap) {
      const shade = 140 + Math.random() * 50;
      ctx.fillStyle = `rgb(${shade + 30}, ${shade - 50}, ${shade - 60})`;
      ctx.fillRect(x + offset, y, brickW, brickH);
    }
    row++;
  }
  return finalize(canvas);
}

/** Khu Thùng sơn loang — gỗ pallet với nhiều vết sơn đổ nhiều màu (điểm nhấn màu sắc) */
export function createPaintSplatterTexture(): PaintableTexture {
  const { canvas, ctx } = makeCanvas();
  ctx.fillStyle = "#8a7a63"; // gỗ pallet nhạt
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 30; i++) {
    const y = Math.random() * canvas.height;
    ctx.fillStyle = "rgba(50,35,20,0.2)";
    ctx.fillRect(0, y, canvas.width, 2 + Math.random() * 3);
  }
  const splatColors = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6"];
  for (let i = 0; i < 10; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const r = 10 + Math.random() * 22;
    ctx.fillStyle = splatColors[i % splatColors.length] + "cc";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return finalize(canvas);
}
export function createFloorTexture(): PaintableTexture {
  const { canvas, ctx } = makeCanvas();
  ctx.fillStyle = "#e8e4da";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (let i = 0; i < 80; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    const r = 6 + Math.random() * 14;
    ctx.fillStyle = `rgba(180,175,160,${0.15 + Math.random() * 0.15})`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  return finalize(canvas);
}
