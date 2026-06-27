import * as THREE from "three";

/**
 * Wrapper chung cho texture dùng được trong cơ chế hút màu (eyedropper) —
 * dùng cho cả texture ảnh thật (load qua useTexture) và texture tự sinh
 * bằng canvas (không còn dùng nữa từ khi đủ 7/7 mặt có ảnh thật — xem
 * ArtStudioScene.tsx — nhưng giữ lại type này vì MapProps.tsx vẫn dùng để
 * nhận texture chung cho các vật cản như CrateStack/Easel).
 */
export type PaintableTexture = {
  texture: THREE.Texture;
  canvas?: HTMLCanvasElement;
};
