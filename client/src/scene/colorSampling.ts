import * as THREE from "three";

/**
 * Lấy canvas để đọc pixel từ 1 THREE.Texture, hỗ trợ cả 2 nguồn:
 * - Texture procedural (CanvasTexture tự sinh, Giai đoạn 2): đã có sẵn
 *   `userData.sourceCanvas`, dùng trực tiếp.
 * - Texture ảnh thật (load qua TextureLoader/useTexture, Giai đoạn 0 asset):
 *   `texture.image` là HTMLImageElement — vẽ 1 lần ra canvas ẩn rồi cache
 *   lại vào `userData.sourceCanvas` để các lần sau không phải vẽ lại.
 */
export function getSampleableCanvas(texture: THREE.Texture | null | undefined): HTMLCanvasElement | undefined {
  if (!texture) return undefined;
  if (texture.userData?.sourceCanvas) return texture.userData.sourceCanvas as HTMLCanvasElement;

  const image = texture.image as HTMLImageElement | HTMLCanvasElement | undefined;
  if (!image || !image.width || !image.height) return undefined;

  const canvas = document.createElement("canvas");
  canvas.width = image.width;
  canvas.height = image.height;
  // willReadFrequently: canvas này bị sampleCanvasAtUV gọi getImageData MỖI
  // FRAME trong lúc hover chọn màu môi trường (isPainting=true, useFrame trong
  // useInteraction.ts) — không phải lâu lâu 1 lần. Phải set NGAY LÚC TẠO
  // context, vì browser chỉ áp option này ở lần getContext("2d") ĐẦU TIÊN cho
  // 1 canvas — gọi lại getContext("2d") sau đó (như trong sampleCanvasAtUV)
  // chỉ trả về context đã có, không đổi được option nữa.
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return undefined;
  ctx.drawImage(image, 0, 0);

  texture.userData = { ...texture.userData, sourceCanvas: canvas };
  return canvas;
}

/**
 * Đọc màu tại tọa độ UV (0..1) trên canvas nguồn của 1 texture.
 * UV v=0 = đáy ảnh (chuẩn OpenGL) nên y ảnh = (1 - v) * height.
 */
export function sampleCanvasAtUV(canvas: HTMLCanvasElement, u: number, v: number): string {
  const ctx = canvas.getContext("2d");
  if (!ctx) return "#ffffff";

  const wrappedU = ((u % 1) + 1) % 1;
  const wrappedV = ((v % 1) + 1) % 1;

  const x = Math.min(canvas.width - 1, Math.max(0, Math.floor(wrappedU * canvas.width)));
  const y = Math.min(canvas.height - 1, Math.max(0, Math.floor((1 - wrappedV) * canvas.height)));

  const [r, g, b] = ctx.getImageData(x, y, 1, 1).data;
  return rgbToHex(r, g, b);
}

export function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}
