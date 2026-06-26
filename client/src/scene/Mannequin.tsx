import { useEffect, useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

export type MannequinColors = {
  head: string;
  torso: string;
  arms: string;
  legs: string;
};

const MODEL_URL = "/models/mannequin.glb";

type MannequinGLTF = {
  nodes: {
    head: THREE.Mesh;
    torso: THREE.Mesh;
    arms: THREE.Mesh;
    legs: THREE.Mesh;
  };
};

/**
 * Mannequin thật (Giai đoạn 0 — xem docs/asset-brief.md), gồm 4 mesh riêng
 * head/torso/arms/legs xuất từ Blender/Meshy, đã giảm poly (~2.9k tam giác)
 * và chuẩn hoá cao 1.8 unit khớp CapsuleCollider trong Player.tsx.
 *
 * QUAN TRỌNG: mỗi instance phải có Material RIÊNG (tạo mới ở đây, không tái
 * dùng material gốc từ GLTF) — nếu dùng chung material giữa nhiều player,
 * đổi màu 1 người sẽ đổi màu tất cả (lỗi đã cảnh báo ở stack.md mục 4).
 */
export function Mannequin({ colors, castShadow = true }: { colors: MannequinColors; castShadow?: boolean }) {
  const { nodes } = useGLTF(MODEL_URL) as unknown as MannequinGLTF;

  const materials = useMemo(
    () => ({
      head: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
      torso: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
      arms: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
      legs: new THREE.MeshStandardMaterial({ roughness: 0.8 }),
    }),
    []
  );

  useEffect(() => {
    materials.head.color.set(colors.head);
    materials.torso.color.set(colors.torso);
    materials.arms.color.set(colors.arms);
    materials.legs.color.set(colors.legs);
  }, [colors, materials]);

  return (
    <group>
      <mesh geometry={nodes.head.geometry} material={materials.head} castShadow={castShadow} />
      <mesh geometry={nodes.torso.geometry} material={materials.torso} castShadow={castShadow} />
      <mesh geometry={nodes.arms.geometry} material={materials.arms} castShadow={castShadow} />
      <mesh geometry={nodes.legs.geometry} material={materials.legs} castShadow={castShadow} />
    </group>
  );
}

export const DEFAULT_MANNEQUIN_COLORS: MannequinColors = {
  head: "#ffffff",
  torso: "#ffffff",
  arms: "#ffffff",
  legs: "#ffffff",
};

useGLTF.preload(MODEL_URL);
