export type Pose = "idle" | "crouch" | "lean" | "lay" | "freeze";

/**
 * ⚠️ TỈ LỆ NHÂN VẬT — co đồng đều CẢ hình ảnh VÀ vùng va chạm (collider) để
 * dễ ẩn nấp hơn. Áp dụng tại ĐÚNG 1 chỗ (group bọc Mannequin trong
 * Player.tsx, xem `scale={[CHARACTER_SCALE, ...]}`) — nhờ đặt ở lớp NGOÀI
 * CÙNG, mọi thứ BÊN TRONG (NEW_FIX, Z_OFFSET trong Mannequin.tsx, các
 * quaternion ARM_DOWN/LEG_BEND trong poseBones.ts) KHÔNG cần đổi gì — chúng
 * là số xoay/offset cục bộ, group cha co tỉ lệ thì tự động co theo, không
 * phải tính lại FK. CHỈ 2 thứ phải co tay theo ĐÚNG CHARACTER_SCALE này:
 * 1. CAPSULE_GROUND_OFFSET ngay dưới đây (vị trí group so với tâm capsule).
 * 2. Kích thước CapsuleCollider trong Player.tsx (`args={[...]}`).
 * Muốn đổi cỡ người: CHỈ sửa đúng số này, không sửa gì khác.
 */
export const CHARACTER_SCALE = 0.2;

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
 * Sau đó tinh chỉnh tay xuống 0.1 (bù khoảng hở đế giày, đo bằng mắt).
 *
 * GIỜ co theo CHARACTER_SCALE — vì cả collider (xem CapsuleCollider trong
 * Player.tsx) VÀ mesh đều co cùng tỉ lệ, offset này co tuyến tính theo
 * CÙNG hệ số (xem giải thích đầy đủ ở CHARACTER_SCALE phía trên).
 */
export const CAPSULE_GROUND_OFFSET = 0.1 * CHARACTER_SCALE;

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
      // ⚠️ CẬP NHẬT LẦN 2 — sau khi thêm Z_OFFSET bù lệch ngang trong
      // Mannequin.tsx, offset đó bị pose "lay" xoay trộn vào trục Y (vì lay
      // xoay cả khối quanh X). Tính lại bằng FK đầy đủ (gồm Z_OFFSET):
      // posY = -0.7601 (không phải -0.0777 như tính thiếu Z_OFFSET trước đó).
      // GIỜ co theo CHARACTER_SCALE — cùng lý do với CAPSULE_GROUND_OFFSET.
      return { scaleY: 1, posY: -0.7601 * CHARACTER_SCALE, rotX: -Math.PI / 2, rotZ: 0 };
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
