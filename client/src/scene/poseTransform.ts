export type Pose = "idle" | "crouch" | "lean" | "lay" | "freeze";

/**
 * Offset đặt mannequin (feet tại local Y=0) đúng vào ĐÁY capsule, không phải
 * TÂM capsule. CapsuleCollider trong Player.tsx dùng args=[halfHeight=0.42,
 * radius=0.33] -> nửa chiều cao thật (tâm tới đáy) = 0.42+0.33 = 0.75 (khớp
 * chiều cao mannequin v3 = 1.5, xem README mục "điều chỉnh kích thước nhỏ
 * hơn" — trước đây 1.8/halfExtent 0.9, đã thu nhỏ theo tỉ lệ 1.5/1.8≈0.833).
 * Thiếu offset này, mannequin sẽ lơ lửng cách sàn đúng 0.75 unit.
 */
export const CAPSULE_GROUND_OFFSET = -0.75;

export type PoseOffset = {
  scaleY: number;
  posY: number;
  rotX: number;
  rotZ: number;
};

/**
 * Biến đổi hình học cho CẢ KHỐI (group bọc ngoài Mannequin) — chỉ còn dùng
 * cho "lean"/"lay" (nghiêng/nằm CẢ THÂN, không cần cử động khớp riêng).
 * "crouch" KHÔNG còn xử lý ở đây nữa — giờ dùng pose xương thật qua
 * `poseBones.ts` (gập gối/hạ hông thật, mượt hơn hẳn cách "ép tỉ lệ" cũ).
 */
export function getPoseOffset(pose: Pose): PoseOffset {
  switch (pose) {
    case "lean":
      return { scaleY: 1, posY: 0, rotX: 0, rotZ: 0.55 };
    case "lay":
      return { scaleY: 1, posY: -0.55, rotX: Math.PI / 2, rotZ: 0 };
    case "crouch":
    case "freeze":
    case "idle":
    default:
      // crouch: không cần biến đổi cả khối nữa, xương tự gập/hạ hông (poseBones.ts).
      // freeze: ý nghĩa là KHOÁ DI CHUYỂN (server chặn "move"), không phải tư thế riêng.
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
