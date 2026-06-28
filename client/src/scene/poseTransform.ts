export type Pose = "idle" | "crouch" | "lean" | "lay" | "freeze";

/**
 * ⚠️ CẬP NHẬT — sau khi thêm phép xoay bù `<group rotation={[Math.PI/2,0,0]}>`
 * trong Mannequin.tsx (bind pose gốc của file `.glb` tự nó nằm ngang, xem
 * comment ở đó), mốc "feet tại local Y=0" KHÔNG còn đúng nữa — hình học đã
 * xoay nên chân rơi vào vị trí Y khác. Tính lại bằng forward-kinematics
 * THẬT trên xương `LeftToeBase`/`LeftToe_End` (đúng chuỗi mannequinGroupRef
 * -> NEW_FIX -> YUpFix -> ... -> chân): toe_Y ≈ -0.9153 trong khung
 * mannequinGroupRef. Để chân chạm đúng ĐÁY capsule (RigidBody-local Y=-0.75,
 * theo CapsuleCollider halfHeight 0.42+radius 0.33), offset cần =
 * -0.75 - toe_Y = -0.75 - (-0.9153) ≈ 0.1653 (LƯU Ý: đổi dấu hẳn so với giá
 * trị cũ -0.75 — bình thường, vì hình học đã xoay hẳn 90°, không phải lỗi).
 */
export const CAPSULE_GROUND_OFFSET = 0.1653;

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
      // ⚠️ CẬP NHẬT — giá trị cũ (rotX:+PI/2, posY:-0.55) tính cho bind pose
      // GỐC (nằm ngang sẵn, trước khi sửa ở Mannequin.tsx). Sau khi sửa
      // hướng đứng, tính lại bằng FK đầy đủ (gồm cả thành phần xoay Y=PI —
      // thứ tự Euler XYZ làm ĐẢO DẤU rotX cần dùng, không phải lỗi đánh máy):
      // rotX=-PI/2 cho thân nằm phẳng đúng hướng, posY=-0.0777 để điểm thấp
      // nhất (chân) chạm đúng đáy capsule, không lơ lửng.
      return { scaleY: 1, posY: -0.0777, rotX: -Math.PI / 2, rotZ: 0 };
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
