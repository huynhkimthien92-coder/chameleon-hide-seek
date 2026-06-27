import * as THREE from "three";
import type { Pose } from "./poseTransform";

/**
 * Pose bằng xương thật (Mannequin v3, rig Mixamo 22 bone) — thay cho cách
 * "xoay/scale cả khối" cũ. Các quaternion dưới đây đã được TÍNH + VERIFY
 * NGOẠI TUYẾN bằng script Node.js riêng (không chạy trong app thật):
 *   1. Lấy world bind quaternion THẬT của từng xương từ `inverseBindMatrices`
 *      (nguồn dữ liệu chính xác cho skinning — KHÔNG dùng cây node thông
 *      thường, vì rig này có node phụ "_$AssimpFbx$_PreRotation" do assimp
 *      sinh ra khi convert FBX, làm cây node thường tính sai world rotation).
 *   2. Với mỗi pose, chọn 1 góc xoay mong muốn THEO TRỤC WORLD thật (đã xác
 *      định bằng cách đo hướng ngón chân — trục X dương = phía trước nhân
 *      vật), áp lên world quat bind, quy đổi lại về local quat (theo parent).
 *   3. Verify lại bằng cách tính world position của đầu/gối/chân SAU khi áp
 *      pose — xác nhận: idle hạ tay đúng xuống 2 bên (không bay lên), crouch
 *      hạ đầu ~0.26 unit (cả người ngồi xuống rõ) mà CHÂN GẦN NHƯ GIỮ NGUYÊN
 *      vị trí cũ (lệch <0.003 unit — không trượt sàn).
 *
 * Vì đã gắn cứng kết quả NGOÀI app (không tính lại lúc chạy), rủi ro chỉ còn
 * ở "có đúng như mắt nhìn ngoài đời không" — phần này CHƯA test được trên
 * browser thật, cần người dùng test kỹ sau khi deploy.
 */

type BoneQuat = [number, number, number, number];

const ARM_DOWN: Record<string, BoneQuat> = {
  "mixamorig:LeftArm": [0.5581145818676403, 0.008466174479763921, -0.010164967528005091, 0.8296584302229284],
  "mixamorig:RightArm": [0.5568784583062167, 0.03930192534224049, 0.015282263234828798, 0.8295228711550278],
};

const LEG_BEND: Record<string, BoneQuat> = {
  "mixamorig:LeftUpLeg": [0.2782060133972691, 0.6754152837401545, -0.6125313961404322, 0.302027974492214],
  "mixamorig:RightUpLeg": [-0.302610757912947, -0.6122436910204321, 0.6751502212147019, -0.2788486521338702],
  "mixamorig:LeftLeg": [0.0202379173748492, 0.04198099772874507, -0.759993979645329, 0.6482570273733834],
  "mixamorig:RightLeg": [-0.01971751532249577, -0.04186013358472743, -0.7643453166338391, 0.6431447625479112],
};

/** Hips dịch theo trục Z RIÊNG của xương (chưa qua wrapper xoay Y-up của
 * Mannequin.tsx — đây là trục "cao" THẬT trong hệ gốc FBX) để bù việc chân
 * nhô lên do gập gối — xem verify trong lịch sử chat (chân lệch <0.003 sau bù). */
const HIPS_CROUCH_OFFSET_Z = -0.258;

const hipsBindZ = new WeakMap<THREE.Bone, number>();
const legBindQuat = new WeakMap<THREE.Bone, THREE.Quaternion>();

/**
 * Áp pose lên 1 bộ xương (Skeleton.bones) — gọi mỗi khi đổi pose, KHÔNG phải
 * mỗi frame (xoay xương 1 lần là đủ, không có animation thật để chạy liên
 * tục — xem README, file FBX gốc chỉ có 1 keyframe T-pose).
 *
 * lean/lay KHÔNG xử lý ở đây — vẫn dùng cách xoay/dịch cả khối ngoài
 * (poseTransform.ts) vì bản chất là nghiêng/xoay CẢ THÂN, không cần cử động
 * khớp riêng — rủi ro thấp hơn nhiều so với tự đoán góc khớp xương.
 *
 * Hàm này AN TOÀN gọi lại nhiều lần (đổi pose qua lại) — không cộng dồn sai,
 * luôn tính lại từ vị trí/góc BIND gốc (nhớ 1 lần đầu qua WeakMap).
 */
export function applyBonePose(bones: THREE.Bone[], pose: Pose) {
  const byName = new Map(bones.map((b) => [b.name, b]));
  const setQuat = (name: string, q: BoneQuat) => byName.get(name)?.quaternion.set(...q);
  const hips = byName.get("mixamorig:Hips");

  // Luôn bắt đầu từ tay hạ xuống (idle) — lean/lay/freeze dùng chung dáng
  // tay này, chỉ riêng crouch mới cần thêm gập chân.
  for (const [name, q] of Object.entries(ARM_DOWN)) setQuat(name, q);

  if (hips) {
    if (!hipsBindZ.has(hips)) hipsBindZ.set(hips, hips.position.z);
    const baseZ = hipsBindZ.get(hips)!;
    hips.position.z = pose === "crouch" ? baseZ + HIPS_CROUCH_OFFSET_Z : baseZ;
  }

  // Xương chân: crouch -> gập theo LEG_BEND; pose khác -> PHẢI trả về đúng
  // bind gốc (không phải bỏ qua — nếu vừa rời crouch mà không reset, chân
  // sẽ bị kẹt ở trạng thái gập từ lần trước).
  for (const name of Object.keys(LEG_BEND)) {
    const bone = byName.get(name);
    if (!bone) continue;
    if (!legBindQuat.has(bone)) legBindQuat.set(bone, bone.quaternion.clone());
    if (pose === "crouch") {
      bone.quaternion.set(...LEG_BEND[name]);
    } else {
      bone.quaternion.copy(legBindQuat.get(bone)!);
    }
  }
}
