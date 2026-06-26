import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { getOrCreatePlayerCanvases, releasePlayerCanvases } from "./paintRegistry";

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
 * head/torso/arms/legs, mỗi mesh có UV riêng (spherical cho đầu, cylindrical
 * 2-nửa trái/phải cho thân/tay/chân — xem split_parts_with_uv.mjs).
 *
 * KHÁC bản cũ: không còn tô 1 màu phẳng/phần qua material.color — mỗi player
 * có 1 bộ canvas vẽ riêng (paintRegistry.ts), người chơi tô tự do bằng cách
 * nhắm+click trực tiếp lên người (xem useInteraction.ts), không qua bước
 * "chọn bộ phận" nữa.
 *
 * `userData.isBodyPart` + `ownerSessionId` gắn trên từng mesh để raycaster
 * nhận diện "đang nhắm vào đúng người nào, phần nào" — xem useInteraction.ts.
 */
export function Mannequin({ sessionId, castShadow = true }: { sessionId: string; castShadow?: boolean }) {
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

  return (
    <group>
      <mesh
        geometry={nodes.head.geometry}
        material={materials.head}
        castShadow={castShadow}
        userData={{ isBodyPart: true, bodyPart: "head", ownerSessionId: sessionId }}
      />
      <mesh
        geometry={nodes.torso.geometry}
        material={materials.torso}
        castShadow={castShadow}
        userData={{ isBodyPart: true, bodyPart: "torso", ownerSessionId: sessionId }}
      />
      <mesh
        geometry={nodes.arms.geometry}
        material={materials.arms}
        castShadow={castShadow}
        userData={{ isBodyPart: true, bodyPart: "arms", ownerSessionId: sessionId }}
      />
      <mesh
        geometry={nodes.legs.geometry}
        material={materials.legs}
        castShadow={castShadow}
        userData={{ isBodyPart: true, bodyPart: "legs", ownerSessionId: sessionId }}
      />
    </group>
  );
}

/** Gọi khi 1 player rời phòng hẳn — KHÔNG gọi cho local player (cần giữ suốt session). */
export function releaseMannequinCanvases(sessionId: string) {
  releasePlayerCanvases(sessionId);
}

useGLTF.preload(MODEL_URL);
