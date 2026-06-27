import * as THREE from "three";
import type { Pose } from "./poseTransform";

/**
 * Pose bằng xương thật (Mannequin v3, rig Mixamo 22 bone) — thay cho cách
 * "xoay/scale cả khối" cũ.
 *
 * ⚠️ LỊCH SỬ BUG QUAN TRỌNG (test thật trên deploy phát hiện): bộ quaternion
 * đầu tiên tính sai do dùng nhầm parent (bone mixamorig cha kế tiếp, vd
 * LeftShoulder) thay vì parent THẬT trong file (node "_$AssimpFbx$_PreRotation"
 * do assimp sinh ra khi convert FBX) — gây ra hiện tượng "người lộn ngược"
 * ngay khi vào game. Đã sửa bằng công thức đúng (xem chi tiết bên dưới) và
 * verify lại bằng cách tính world position của tay/chân sau pose — khớp
 * với lần verify trước (world effect đúng như tính toán ban đầu), chỉ riêng
 * giá trị LOCAL quaternion gán vào bone là khác (vì parent dùng để quy đổi
 * khác nhau).
 *
 * Cách tính (NGOÀI app, không chạy trong code thật):
 *   1. Lấy world bind quaternion THẬT của từng xương từ `inverseBindMatrices`
 *      (nguồn dữ liệu chính xác cho skinning).
 *   2. Mỗi bone có local rotation = identity ở bind pose (verify qua dữ liệu
 *      thật) -> world quat của PARENT THẬT (PreRotation) == world quat bind
 *      của CHÍNH bone đó. Quy đổi 1 delta xoay theo world thành local quat:
 *      `local = bindWorldQuat^-1 * delta * bindWorldQuat` (phép conjugate).
 *   3. Verify lại bằng cách tính world position đầu/gối/chân SAU khi áp pose.
 */

type BoneQuat = [number, number, number, number];

/**
 * ⚠️ CẬP NHẬT LẦN 3 — sau khi phát hiện bind pose GỐC của file `.glb` tự nó
 * nằm ngang trong world (xem Mannequin.tsx, đã thêm `<group rotation={[Math.PI/2,0,0]}>`
 * để bù), MỌI quaternion world-target tính trước đó (bao gồm ARM_DOWN lần 2)
 * đều SAI vì chuỗi ancestor đã đổi (`bindWorldQuat` của vai giờ có thêm phép
 * xoay bù phía trên nó). Tính lại bằng đúng chuỗi MỚI (kể cả phép xoay bù),
 * verify lại bằng FK: hướng vai->tay sau khi áp ra ~(0,-1,0) (sai lệch
 * <5% trên X/Z) — đúng tay buông dọc thân.
 */
const ARM_DOWN: Record<string, BoneQuat> = {
  "mixamorigLeftArm": [0.7172823261533293, -1.9428902930940242e-16, -0.0454268737374971, 0.6953002687548069],
  "mixamorigRightArm": [0.7180281482448576, -1.5959455978986628e-16, 0.031106581306632155, 0.6953186024603935],
};

const LEG_BEND: Record<string, BoneQuat> = {
  "mixamorigLeftUpLeg": [-0.0022218420893521107, -0.03628351954185588, 0.3809529879709767, 0.9238795325425244],
  "mixamorigRightUpLeg": [0.0022908974821386208, 0.03627922517636975, 0.3809529879350891, 0.9238795325132338],
  "mixamorigLeftLeg": [-0.006631900244705002, 0.020040622738657893, -0.7067916181923193, 0.707106781333291],
  "mixamorigRightLeg": [0.007405547429984949, -0.020015866192053422, -0.7067846368033783, 0.7071067810829137],
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
  const hips = byName.get("mixamorigHips");

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
