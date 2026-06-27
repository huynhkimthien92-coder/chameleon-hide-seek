import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import type { ThreeEvent } from "@react-three/fiber";
import { getOrCreatePlayerCanvases, releasePlayerCanvases, type BodyPart } from "./paintRegistry";

const MODEL_URL = "/models/mannequin.glb";

type MannequinGLTF = {
  nodes: {
    head: THREE.Mesh;
    torso: THREE.Mesh;
    arms: THREE.Mesh;
    legs: THREE.Mesh;
  };
};

export type PartPointerHandler = (part: BodyPart, e: ThreeEvent<PointerEvent>) => void;

type MannequinProps = {
  sessionId: string;
  castShadow?: boolean;
  /** Chỉ truyền khi cần vẽ trực tiếp (PaintBoard.tsx) — không dùng lúc render trong game. */
  onPartPointerDown?: PartPointerHandler;
  onPartPointerMove?: PartPointerHandler;
  onPartPointerUp?: PartPointerHandler;
};

/**
 * Mannequin thật (Giai đoạn 0 — xem docs/asset-brief.md), gồm 4 mesh riêng
 * head/torso/arms/legs, mỗi mesh có UV riêng (spherical cho đầu, cylindrical
 * 2-nửa trái/phải cho thân/tay/chân — xem split_parts_with_uv.mjs).
 *
 * Mỗi player có 1 bộ canvas vẽ riêng (paintRegistry.ts). Vẽ lên người làm
 * qua khung xem 3D riêng trong PaintBoard.tsx (camera/raycast TÁCH HẲN khỏi
 * gameplay) — không phải bằng cách nhắm trong camera chơi game (đã bỏ vì
 * luôn vướng việc di chuyển/xoay người theo camera, xem README mục bug fix).
 *
 * `onPartPointerDown/Move/Up` dùng sự kiện con trỏ có sẵn của R3F (raycast
 * tự động theo từng mesh) — chỉ PaintBoard.tsx truyền vào, Player/RemotePlayer
 * không truyền nên không có gì thay đổi ở chỗ render trong game.
 */
export function Mannequin({
  sessionId,
  castShadow = true,
  onPartPointerDown,
  onPartPointerMove,
  onPartPointerUp,
}: MannequinProps) {
  const { nodes } = useGLTF(MODEL_URL) as unknown as MannequinGLTF;

  const canvases = useMemo(() => getOrCreatePlayerCanvases(sessionId), [sessionId]);

  const materials = useMemo(
    () => ({
      head: new THREE.MeshStandardMaterial({ map: canvases.head.texture, roughness: 0.8 }),
      torso: new THREE.MeshStandardMaterial({ map: canvases.torso.texture, roughness: 0.8 }),
      arms: new THREE.MeshStandardMaterial({ map: canvases.arms.texture, roughness: 0.8 }),
      legs: new THREE.MeshStandardMaterial({ map: canvases.legs.texture, roughness: 0.8 }),
    }),
    [canvases]
  );

  const partProps = (part: BodyPart) => ({
    onPointerDown: onPartPointerDown
      ? (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onPartPointerDown(part, e);
        }
      : undefined,
    onPointerMove: onPartPointerMove
      ? (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onPartPointerMove(part, e);
        }
      : undefined,
    onPointerUp: onPartPointerUp
      ? (e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onPartPointerUp(part, e);
        }
      : undefined,
  });

  return (
    <group>
      <mesh geometry={nodes.head.geometry} material={materials.head} castShadow={castShadow} {...partProps("head")} />
      <mesh geometry={nodes.torso.geometry} material={materials.torso} castShadow={castShadow} {...partProps("torso")} />
      <mesh geometry={nodes.arms.geometry} material={materials.arms} castShadow={castShadow} {...partProps("arms")} />
      <mesh geometry={nodes.legs.geometry} material={materials.legs} castShadow={castShadow} {...partProps("legs")} />
    </group>
  );
}

/** Gọi khi 1 player rời phòng hẳn — KHÔNG gọi cho local player (cần giữ suốt session). */
export function releaseMannequinCanvases(sessionId: string) {
  releasePlayerCanvases(sessionId);
}

useGLTF.preload(MODEL_URL);
