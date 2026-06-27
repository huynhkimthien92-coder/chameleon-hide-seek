import { useEffect, useRef, type ComponentRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, CapsuleCollider, useRapier, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { sendLocalTransform } from "../net/colyseus";
import { useGameStore } from "../store/useGameStore";
import { Mannequin } from "./Mannequin";
import { getPoseOffset, CAPSULE_GROUND_OFFSET } from "./poseTransform";

const MOVE_SPEED = 4.5;
const MOUSE_SENSITIVITY = 0.0025;
const GRAVITY = 18; // khớp Physics gravity={[0,-18,0]} trong App.tsx
const MAX_FALL_SPEED = 12; // chặn vận tốc rơi tối đa — tránh tăng vô hạn khi rơi xa/lâu

// Tham số KCC — xem README mục KCC để biết lý do đổi từ RigidBody động sang
// Character Controller (auto-step leo bậc thang, snap-to-ground chống rung/kẹt).
const AUTOSTEP_MAX_HEIGHT = 0.4; // > 0.22 (chiều cao mỗi bậc thang trong MapProps.tsx)
const AUTOSTEP_MIN_WIDTH = 0.2;
const SNAP_TO_GROUND_DISTANCE = 0.5;
const MAX_SLOPE_CLIMB_ANGLE = (60 * Math.PI) / 180;
const MIN_SLOPE_SLIDE_ANGLE = (50 * Math.PI) / 180;

/**
 * Local player — di chuyển bằng WASD, nhìn bằng chuột (pointer lock).
 * Nhấn "V" để chuyển First person <-> Third person.
 *
 * DÙNG Kinematic Character Controller (KCC) của Rapier, KHÔNG còn RigidBody
 * động + setLinvel như trước — lý do: RigidBody động va chạm `trimesh`/cuboid
 * thường bị rung/kẹt ở vật cản thấp (bậc thang) và không có khả năng tự leo.
 * KCC xử lý đúng việc này qua `enableAutostep`/`enableSnapToGround` — chuẩn
 * dùng cho mọi game 3D có nhân vật đi bộ, không phải tự chế.
 *
 * Vì kinematic body KHÔNG được engine tự áp dụng gravity (chỉ dynamic body
 * mới được), ta tự mô phỏng rơi bằng `verticalVelocity` cộng dồn mỗi frame,
 * reset về 0 khi `controller.computedGrounded()` báo đã chạm đất.
 */
export function Player() {
  const { camera, gl } = useThree();
  const { world } = useRapier();

  const bodyRef = useRef<RapierRigidBody>(null);
  const colliderRef = useRef<ComponentRef<typeof CapsuleCollider>>(null);
  const controllerRef = useRef<ReturnType<typeof world.createCharacterController> | null>(null);
  const verticalVelocity = useRef(0);

  const mannequinGroupRef = useRef<THREE.Group>(null);
  const yaw = useRef(0); // góc camera — luôn theo chuột (orbit tự do quanh nhân vật ở third-person)
  const facingYaw = useRef(0); // hướng NHÂN VẬT thật — chỉ đổi khi đang di chuyển (xem useFrame)
  const pitch = useRef(0);
  const paintZoomDistance = useRef(3); // khoảng cách camera lúc tô màu — cuộn chuột để chỉnh (xem onWheel)
  const isFirstPerson = useRef(false);
  const keys = useRef<Record<string, boolean>>({});

  const localPose = useGameStore((s) => s.localPose);
  const team = useGameStore((s) => s.team);
  const sessionId = useGameStore((s) => s.sessionId);
  const isPainting = useGameStore((s) => s.isPainting);

  // Vào chế độ vẽ: nhả pointer-lock (để chuột thật điều khiển con trỏ vẽ,
  // xem useInteraction.ts) + ép Third person (để luôn thấy người mình, dù
  // trước đó đang First person). Camera/nhân vật tự đứng yên vì useFrame
  // dưới đây bỏ qua mousemove lúc không còn pointer-lock + bỏ qua WASD lúc
  // isPainting (xem điều kiện movement bên dưới).
  useEffect(() => {
    if (isPainting) {
      document.exitPointerLock();
      isFirstPerson.current = false;
    } else {
      useGameStore.getState().setHoverColor(null);
    }
  }, [isPainting]);

  // Tạo KCC 1 lần khi world sẵn sàng, dọn dẹp lúc unmount.
  useEffect(() => {
    const controller = world.createCharacterController(0.02); // offset nhỏ, tránh kẹt số học
    controller.setFilterGroups(0xffffffff);
    controller.enableAutostep(AUTOSTEP_MAX_HEIGHT, AUTOSTEP_MIN_WIDTH, true);
    controller.enableSnapToGround(SNAP_TO_GROUND_DISTANCE);
    controller.setMaxSlopeClimbAngle(MAX_SLOPE_CLIMB_ANGLE);
    controller.setMinSlopeSlideAngle(MIN_SLOPE_SLIDE_ANGLE);
    controller.setApplyImpulsesToDynamicBodies(false); // không có dynamic body khác để đẩy
    controllerRef.current = controller;
    return () => {
      world.removeCharacterController(controller);
      controllerRef.current = null;
    };
  }, [world]);

  // [DEBUG TẠM] overlay đo KCC — gỡ sau khi tìm ra root cause.
  const debugElRef = useRef<HTMLDivElement | null>(null);
  const debugLastUpdate = useRef(0);
  useEffect(() => {
    const el = document.createElement("div");
    el.style.cssText =
      "position:fixed;left:8px;bottom:8px;z-index:9999;font:12px/1.4 monospace;" +
      "background:rgba(0,0,0,.8);color:#0f0;padding:8px 10px;border-radius:6px;white-space:pre;pointer-events:none;";
    document.body.appendChild(el);
    debugElRef.current = el;
    return () => { el.remove(); debugElRef.current = null; };
  }, []);

  // Mặc định góc nhìn theo team khi server gán xong (vision.md: First person
  // cho Seeker, Third person cho Hider) — vẫn cho phép "V" đổi tay vì tiện
  // test/debug, không khoá cứng (việc khoá cứng để Giai đoạn 4 quyết định).
  useEffect(() => {
    if (team === "seeker") isFirstPerson.current = true;
    if (team === "hider") isFirstPerson.current = false;
  }, [team]);

  useEffect(() => {
    const canvas = gl.domElement;

    const onClick = () => {
      // Đang vẽ -> KHÔNG lock lại pointer. Trước đó thiếu điều kiện này: mỗi
      // lần click để vẽ, trình duyệt cũng bắn sự kiện "click" trên canvas,
      // handler này lock lại pointer ngay lập tức -> chuột quay về điều
      // khiển camera dù đang ở chế độ vẽ (đúng bug người dùng báo).
      if (useGameStore.getState().isPainting) return;
      canvas.requestPointerLock();
    };
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      yaw.current -= e.movementX * MOUSE_SENSITIVITY;
      pitch.current -= e.movementY * MOUSE_SENSITIVITY;
      pitch.current = THREE.MathUtils.clamp(pitch.current, -1.3, 1.3);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === "KeyV") isFirstPerson.current = !isFirstPerson.current;
      if (e.code === "Escape" && useGameStore.getState().isPainting) {
        useGameStore.getState().setIsPainting(false);
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };
    const onWheel = (e: WheelEvent) => {
      // Chỉ có tác dụng lúc đang tô màu — zoom gần/xa để tô chi tiết hơn,
      // không ảnh hưởng khoảng cách camera mặc định lúc chơi bình thường.
      if (!useGameStore.getState().isPainting) return;
      e.preventDefault();
      paintZoomDistance.current = THREE.MathUtils.clamp(
        paintZoomDistance.current + e.deltaY * 0.0025,
        1.2,
        5
      );
    };

    canvas.addEventListener("click", onClick);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      canvas.removeEventListener("wheel", onWheel);
    };
  }, [gl]);

  useFrame((_state, delta) => {
    const body = bodyRef.current;
    const collider = colliderRef.current;
    const controller = controllerRef.current;
    if (!body || !collider || !controller) return;

    const eliminated = useGameStore.getState().eliminated;

    // Hider đã bị loại -> Spectate: vẫn nhìn quanh được nhưng không di chuyển,
    // không gửi "move" lên server (server cũng đã tự chặn — đây là phía client
    // cho cảm giác nhất quán). Kinematic body không tự rơi nếu không gọi
    // setNextKinematicTranslation, nên chỉ cần KHÔNG tính toán gì là đứng yên.
    if (eliminated) {
      if (isFirstPerson.current) {
        const pos = body.translation();
        camera.position.set(pos.x, pos.y - 0.25, pos.z);
        camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
      }
      return;
    }

    // Hướng NHÂN VẬT thật (facingYaw) chỉ đồng bộ theo góc camera (yaw) khi:
    // - First person (luôn nhìn = hướng đi, không có khái niệm orbit riêng), hoặc
    // - Seeker (cần camera = hướng ngắm bắn chính xác mọi lúc, không tách rời), hoặc
    // - Đang thật sự di chuyển (WASD) — quay người theo hướng đang đi tới.
    const isMoving =
      keys.current["KeyW"] || keys.current["KeyA"] || keys.current["KeyS"] || keys.current["KeyD"];
    if (isFirstPerson.current || team === "seeker" || isMoving) {
      facingYaw.current = yaw.current;
    }

    // Hướng di chuyển theo facingYaw (hướng nhân vật thật, không phải góc camera)
    const forward = new THREE.Vector3(Math.sin(facingYaw.current), 0, Math.cos(facingYaw.current));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    // Đang vẽ, hoặc đang pha chuẩn bị mà mình là Seeker -> tạm dừng di
    // chuyển ngang (vẫn rơi/đứng trên sàn bình thường qua KCC ở dưới).
    const isPaintingNow = useGameStore.getState().isPainting;
    const phase = useGameStore.getState().phase;
    const isSeekerWaitingToPrep = phase === "preparing" && team === "seeker";
    const horizontalInput = new THREE.Vector3();
    if (!isPaintingNow && !isSeekerWaitingToPrep) {
      if (keys.current["KeyW"]) horizontalInput.add(forward);
      if (keys.current["KeyS"]) horizontalInput.sub(forward);
      if (keys.current["KeyD"]) horizontalInput.add(right);
      if (keys.current["KeyA"]) horizontalInput.sub(right);
      if (horizontalInput.lengthSq() > 0) horizontalInput.normalize().multiplyScalar(MOVE_SPEED);
    }

    // Gravity tự mô phỏng (kinematic body không được engine tự áp dụng).
    verticalVelocity.current = Math.max(verticalVelocity.current - GRAVITY * delta, -MAX_FALL_SPEED);

    const desiredMovement = {
      x: horizontalInput.x * delta,
      y: verticalVelocity.current * delta,
      z: horizontalInput.z * delta,
    };

    controller.computeColliderMovement(collider, desiredMovement);
    const corrected = controller.computedMovement();
    const grounded = controller.computedGrounded();
    if (grounded) verticalVelocity.current = 0;

    const current = body.translation();
    const next = {
      x: current.x + corrected.x,
      y: current.y + corrected.y,
      z: current.z + corrected.z,
    };
    body.setNextKinematicTranslation(next);
    // [DEBUG TẠM] ghi số đo mỗi ~100ms (gỡ sau khi xong).
    const nowMs = performance.now();
    if (debugElRef.current && nowMs - debugLastUpdate.current > 100) {
      debugLastUpdate.current = nowMs;
      let colliderCount = -1;
      try { colliderCount = (world as unknown as { colliders: { len(): number } }).colliders.len(); } catch { /* noop */ }
      debugElRef.current.textContent =
        `body.y      = ${next.y.toFixed(3)}\n` +
        `vVel        = ${verticalVelocity.current.toFixed(3)}\n` +
        `desired.y   = ${desiredMovement.y.toFixed(4)}\n` +
        `corrected.y = ${corrected.y.toFixed(4)}\n` +
        `grounded    = ${grounded}\n` +
        `colliders   = ${colliderCount}\n` +
        `delta(ms)   = ${(delta * 1000).toFixed(1)}`;
    }

    // Mannequin chỉ hiện ở Third person, quay theo facingYaw (hướng thật),
    // KHÔNG theo yaw (góc camera) — để camera orbit tự do không xoay người.
    if (mannequinGroupRef.current) {
      mannequinGroupRef.current.visible = !isFirstPerson.current;
      mannequinGroupRef.current.rotation.y = facingYaw.current + Math.PI;
    }

    if (isFirstPerson.current) {
      camera.position.set(next.x, next.y - 0.25, next.z);
      camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
    } else {
      // Orbit quanh điểm nhìn cố định (ngực nhân vật) theo cả yaw VÀ pitch.
      // Lúc đang tô màu: dùng khoảng cách riêng (paintZoomDistance, chỉnh
      // bằng cuộn chuột — xem onWheel) để zoom gần hơn cho việc tô chi tiết,
      // không ảnh hưởng khoảng cách mặc định lúc chơi bình thường.
      const distance = useGameStore.getState().isPainting ? paintZoomDistance.current : 5;
      const horizontalDist = distance * Math.cos(pitch.current);
      const verticalOffset = distance * Math.sin(pitch.current);
      const camX = next.x - Math.sin(yaw.current) * horizontalDist;
      const camZ = next.z - Math.cos(yaw.current) * horizontalDist;
      camera.position.set(camX, next.y - 0.08 + verticalOffset, camZ);
      camera.lookAt(next.x, next.y - 0.08, next.z);
    }

    sendLocalTransform(next.x, next.y, next.z, facingYaw.current);
    useGameStore.getState().setLocalPosition({ x: next.x, y: next.y, z: next.z });
  });

  const pose = getPoseOffset(localPose);

  return (
    <RigidBody ref={bodyRef} type="kinematicPosition" colliders={false} position={[0, 1, 0]}>
      <CapsuleCollider ref={colliderRef} args={[0.42, 0.33]} />
      <group
        ref={mannequinGroupRef}
        rotation={[pose.rotX, Math.PI, pose.rotZ]}
        position={[0, CAPSULE_GROUND_OFFSET + pose.posY, 0]}
        scale={[1, pose.scaleY, 1]}
      >
        <Mannequin sessionId={sessionId ?? "local-pending"} pose={localPose} />
      </group>
    </RigidBody>
  );
}
