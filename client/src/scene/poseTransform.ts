export type Pose = "idle" | "crouch" | "lean" | "lay" | "freeze";

/**
 * Offset đặt mannequin (feet tại local Y=0) đúng vào ĐÁY capsule, không phải
 * TÂM capsule. CapsuleCollider trong Player.tsx dùng args=[halfHeight=0.5,
 * radius=0.4] -> nửa chiều cao thật (tâm tới đáy) = 0.5+0.4 = 0.9. Thiếu
 * offset này, mannequin sẽ lơ lửng cách sàn đúng 0.9 unit (RigidBody nghỉ
 * với TÂM capsule cách sàn 0.9, nhưng mannequin local feet=0 lại đặt ngay
 * tại tâm đó nếu không trừ offset).
 */
export const CAPSULE_GROUND_OFFSET = -0.9;

export type PoseOffset = {
  scaleY: number;
  posY: number;
  rotX: number;
  rotZ: number;
};

/**
 * PLACEHOLDER: biến đổi hình học đơn giản để mô phỏng pose, vì chưa có
 * animation clip GLTF thật (Giai đoạn 0). Khi có mannequin thật, thay
 * bằng AnimationMixer/useAnimations của drei và xoá hàm này.
 */
export function getPoseOffset(pose: Pose): PoseOffset {
  switch (pose) {
    case "crouch":
      return { scaleY: 0.62, posY: -0.3, rotX: 0, rotZ: 0 };
    case "lean":
      return { scaleY: 1, posY: 0, rotX: 0, rotZ: 0.55 };
    case "lay":
      return { scaleY: 1, posY: -0.55, rotX: Math.PI / 2, rotZ: 0 };
    case "freeze":
    case "idle":
    default:
      // "freeze" dùng chung transform với "idle" ở bản placeholder này — ý nghĩa
      // của freeze là KHOÁ DI CHUYỂN (xem GameRoom.ts: server chặn "move" khi
      // pose === "freeze"), không phải một tư thế hình học riêng.
      return { scaleY: 1, posY: 0, rotX: 0, rotZ: 0 };
  }
}

export const POSE_LIST: { id: Pose; label: string }[] = [
  { id: "idle", label: "Đứng" },
  { id: "crouch", label: "Ngồi" },
  { id: "lean", label: "Nghiêng" },
  { id: "lay", label: "Nằm" },
  { id: "freeze", label: "Đóng băng" },
];
