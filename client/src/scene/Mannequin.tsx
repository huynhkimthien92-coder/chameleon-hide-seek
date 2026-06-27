import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import { getOrCreatePlayerCanvas, releasePlayerCanvas } from "./paintRegistry";
import { applyBonePose } from "./poseBones";
import type { Pose } from "./poseTransform";

const MODEL_URL = "/models/mannequin.glb";

/**
 * Mannequin v3 — rig + skin THẬT từ Mixamo (22 bone), thay cho cách "xoay cả
 * khối cứng" cũ. 1 mesh liền duy nhất (không còn chia head/torso/arms/legs
 * — UV thật của model đã đủ tốt để dùng 1 texture chung, xem README mục
 * Mannequin v3). Pose (idle/crouch) áp bằng cách xoay XƯƠNG thật qua
 * `poseBones.ts` (quaternion đã tính + verify ngoại tuyến — xem file đó).
 *
 * Mỗi player phải có skeleton ĐỘC LẬP riêng (không share) — dùng
 * `SkeletonUtils.clone()` của three-stdlib, KHÔNG dùng `.clone()` thường
 * (chỉ copy tham chiếu skeleton, mọi player sẽ cùng pose theo người cuối
 * cùng gọi applyBonePose — lỗi kinh điển khi dùng SkinnedMesh nhiều instance).
 */
export function Mannequin({
  sessionId,
  pose = "idle",
  castShadow = true,
}: {
  sessionId: string;
  pose?: Pose;
  castShadow?: boolean;
}) {
  const { scene } = useGLTF(MODEL_URL);
  const groupRef = useRef<THREE.Group>(null);

  const canvas = useMemo(() => getOrCreatePlayerCanvas(sessionId), [sessionId]);

  // Clone TOÀN BỘ scene (mesh + skeleton) độc lập cho riêng player này.
  const cloned = useMemo(() => SkeletonUtils.clone(scene) as THREE.Group, [scene]);

  const skinnedMesh = useMemo<THREE.SkinnedMesh | null>(() => {
    let found: THREE.SkinnedMesh | null = null;
    cloned.traverse((obj) => {
      if ((obj as THREE.SkinnedMesh).isSkinnedMesh) found = obj as THREE.SkinnedMesh;
    });
    return found;
  }, [cloned]);

  // Gắn texture canvas riêng của player này lên material — tạo material mới
  // (không share) để mỗi player tô màu độc lập.
  useEffect(() => {
    if (!skinnedMesh) return;
    skinnedMesh.material = new THREE.MeshStandardMaterial({ map: canvas.texture, roughness: 0.8 });
    skinnedMesh.castShadow = castShadow;
    skinnedMesh.userData.isOwnBody = true;
    skinnedMesh.userData.ownerSessionId = sessionId;
  }, [skinnedMesh, canvas, castShadow, sessionId]);

  // Áp pose mỗi khi đổi (không phải mỗi frame — xoay xương 1 lần là đủ, xem
  // poseBones.ts: không có animation thật để chạy liên tục).
  useEffect(() => {
    if (!skinnedMesh?.skeleton) return;
    applyBonePose(skinnedMesh.skeleton.bones, pose);
    skinnedMesh.skeleton.update();
  }, [skinnedMesh, pose]);

  return <primitive ref={groupRef} object={cloned} />;
}

/** Gọi khi 1 player rời phòng hẳn — KHÔNG gọi cho local player (cần giữ suốt session). */
export function releaseMannequinCanvases(sessionId: string) {
  releasePlayerCanvas(sessionId);
}

useGLTF.preload(MODEL_URL);
