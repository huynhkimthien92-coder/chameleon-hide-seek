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
 * ⚠️ CẬP NHẬT LẦN 2 — bộ giá trị trước (lần "sửa parent đúng") vẫn SAI, dù
 * công thức quy đổi local<->world đã đúng. Phát hiện bằng cách tính lại
 * forward-kinematics THẬT trên đúng hierarchy của `mannequin.glb` (62 node,
 * gồm các node trung gian `_$AssimpFbx$_Translation`/`_PreRotation` do
 * assimp sinh ra) — không suy đoán: hướng vai->tay ở T-pose ra đúng [gần
 * như thuần X, Y~0] (khớp T-pose thật), nhưng SAU khi áp ARM_DOWN cũ, Y vẫn
 * ~0 — tức tay chỉ xoay NGANG sang hướng khác (X -> Z), không hề HẠ XUỐNG.
 * Đây là nguyên nhân tay luôn xoè ngang dù không đổi pose (bug "trục sai"
 * người dùng phát hiện được sau khi bug rơi xuyên sàn đã sửa xong).
 *
 * Giá trị MỚI: tính delta xoay world từ hướng tay T-pose thật (lấy từ FK
 * trên node thật) sang target world = thẳng xuống (0,-1,0), quy đổi qua
 * `local = bindWorldQuat^-1 * delta * bindWorldQuat` (đúng công thức cũ,
 * delta lần này đúng hướng) — ĐÃ VERIFY lại bằng FK: hướng vai->tay sau khi
 * áp ra đúng ~(0,-1,0) (sai lệch <4% trên X/Z, dư do project lên world
 * thẳng đứng tuyệt đối — đủ tốt cho "tay buông tự nhiên", có thể chỉnh tinh
 * sau nếu cần tay khép hơi vào trong thân).
 */
const ARM_DOWN: Record<string, BoneQuat> = {
  "mixamorigLeftArm": [-0.0450304520949398, 6.40763483938933e-17, -0.7082792333398699, 0.7044947026086227],
  "mixamorigRightArm": [-0.032794693162463216, -2.42861286636753e-17, 0.7258759500129293, 0.6870433853063485],
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
