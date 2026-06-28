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
    skinnedMesh.material = new THREE.MeshStandardMaterial({
      map: canvas.texture,
      roughness: 0.8,
      // DoubleSide: raycaster mặc định CHỈ tính trúng mặt trước tam giác
      // (FrontSide). Ở pose lệch nhiều (vd "Nằm", xoay 90°+), skinning có
      // thể làm một số tam giác bị tính sai hướng pháp tuyến lúc raycast dù
      // vẫn render bình thường (khác cơ chế GPU) -> raycast bỏ sót, đúng
      // triệu chứng "thấy trắng nhưng không tô trúng". DoubleSide bỏ hẳn
      // việc lọc theo hướng — an toàn cho mesh người đặc, không gây lệch gì.
      side: THREE.DoubleSide,
    });
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

  // ⚠️ FIX QUAN TRỌNG — bind pose THẬT của file mannequin.glb (kể cả không
  // áp pose gì) tự nó nằm NGANG trong world sau khi qua node YUpFix: đã
  // verify bằng forward-kinematics trên đúng node thật trong file (Hông ->
  // Cột sống -> Cổ -> Đầu), hướng ra ~(0,-0.03,±1) — gần thuần trục Z/X,
  // KHÔNG phải (0,1,0). Đây là lỗi nằm trong chính file asset (chuỗi
  // PreRotation do assimp sinh ra khi convert FBX->glTF), không phải lỗi ở
  // Player.tsx/RemotePlayer.tsx/poseBones.ts. Bù bằng đúng 1 phép xoay
  // +90° quanh X ở NGOÀI CÙNG (trước cả YUpFix) — đã verify lại bằng FK,
  // hướng Hông->Đầu sau khi bù ra ~(0,1,0.03), đúng người đứng thẳng.
  // Đặt fix ở ĐÂY (trong Mannequin, lớp ngoài cùng) để áp dụng tự động cho
  // CẢ Player.tsx (local) và RemotePlayer.tsx (người khác) — không cần sửa
  // 2 nơi, không ảnh hưởng tới các giá trị ARM_DOWN/LEG_BEND trong
  // poseBones.ts (chúng là quaternion LOCAL của xương, không phụ thuộc lớp
  // bọc ngoài này).
  // ⚠️ CẬP NHẬT — phép xoay +90X (NEW_FIX) ở trên xoay quanh GỐC (0,0,0)
  // của group, nhưng thân người (Hông) lại không nằm ở gốc đó trước khi
  // xoay (Hông nằm cách gốc ~0.68 unit theo Y cũ, do bind pose nằm ngang
  // gốc) — nên xoay xong, Hông bị "quay vòng" lệch sang Z ≈ +0.68, làm
  // toàn thân lệch khỏi đúng tâm capsule (đúng bug "người nằm ngoài
  // collider, lệch sát vách" người dùng phát hiện). Bù bằng position Z
  // ngược lại — đã verify bằng FK: sau bù, Hông về đúng (0,*,0) theo X/Z.
  return (
    <group rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.6824]}>
      <primitive ref={groupRef} object={cloned} />
    </group>
  );
}

/** Gọi khi 1 player rời phòng hẳn — KHÔNG gọi cho local player (cần giữ suốt session). */
export function releaseMannequinCanvases(sessionId: string) {
  releasePlayerCanvas(sessionId);
}

useGLTF.preload(MODEL_URL);
