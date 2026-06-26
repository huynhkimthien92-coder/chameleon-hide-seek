import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { RigidBody, CapsuleCollider, type RapierRigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { sendLocalTransform } from "../net/colyseus";
import { useGameStore } from "../store/useGameStore";
import { Mannequin } from "./Mannequin";
import { getPoseOffset } from "./poseTransform";

const MOVE_SPEED = 4.5;
const MOUSE_SENSITIVITY = 0.0025;

/**
 * Local player — di chuyển bằng WASD, nhìn bằng chuột (pointer lock).
 * Nhấn "V" để chuyển First person <-> Third person.
 *
 * Lưu ý: ở Giai đoạn 1 chưa gán team — mọi player đều dùng controller này.
 * Việc khoá First person cho Seeker / Third person cho Hider sẽ làm ở
 * Giai đoạn 3 khi team được server gán (vision.md mục 3: 2 Seeker / 4 Hider).
 */
export function Player() {
  const bodyRef = useRef<RapierRigidBody>(null);
  const mannequinGroupRef = useRef<THREE.Group>(null);
  const yaw = useRef(0);
  const pitch = useRef(0);
  const isFirstPerson = useRef(false);
  const keys = useRef<Record<string, boolean>>({});
  const { camera, gl } = useThree();

  const localPose = useGameStore((s) => s.localPose);
  const team = useGameStore((s) => s.team);
  const sessionId = useGameStore((s) => s.sessionId);

  // Mặc định góc nhìn theo team khi server gán xong (vision.md: First person
  // cho Seeker, Third person cho Hider) — vẫn cho phép "V" đổi tay vì tiện
  // test/debug, không khoá cứng (việc khoá cứng để Giai đoạn 4 quyết định).
  useEffect(() => {
    if (team === "seeker") isFirstPerson.current = true;
    if (team === "hider") isFirstPerson.current = false;
  }, [team]);

  useEffect(() => {
    const canvas = gl.domElement;

    const onClick = () => canvas.requestPointerLock();
    const onMouseMove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      yaw.current -= e.movementX * MOUSE_SENSITIVITY;
      pitch.current -= e.movementY * MOUSE_SENSITIVITY;
      pitch.current = THREE.MathUtils.clamp(pitch.current, -1.3, 1.3);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      keys.current[e.code] = true;
      if (e.code === "KeyV") isFirstPerson.current = !isFirstPerson.current;
    };
    const onKeyUp = (e: KeyboardEvent) => {
      keys.current[e.code] = false;
    };

    canvas.addEventListener("click", onClick);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [gl]);

  useFrame(() => {
    const body = bodyRef.current;
    if (!body) return;

    const eliminated = useGameStore.getState().eliminated;

    // Hider đã bị loại -> Spectate: vẫn nhìn quanh được nhưng không di chuyển,
    // không gửi "move" lên server (server cũng đã tự chặn — đây là phía client
    // cho cảm giác nhất quán, tránh local physics trôi tự do không ai thấy).
    if (eliminated) {
      const vel = body.linvel();
      body.setLinvel({ x: 0, y: vel.y, z: 0 }, true);

      if (isFirstPerson.current) {
        const pos = body.translation();
        camera.position.set(pos.x, pos.y + 0.6, pos.z);
        camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
      }
      return;
    }

    // Hướng di chuyển theo yaw camera (forward = -Z khi yaw = 0)
    const forward = new THREE.Vector3(Math.sin(yaw.current), 0, Math.cos(yaw.current));
    const right = new THREE.Vector3(forward.z, 0, -forward.x);

    const input = new THREE.Vector3();
    if (keys.current["KeyW"]) input.add(forward);
    if (keys.current["KeyS"]) input.sub(forward);
    if (keys.current["KeyD"]) input.add(right);
    if (keys.current["KeyA"]) input.sub(right);
    if (input.lengthSq() > 0) input.normalize().multiplyScalar(MOVE_SPEED);

    const vel = body.linvel();
    body.setLinvel({ x: input.x, y: vel.y, z: input.z }, true);

    const pos = body.translation();

    // Mannequin chỉ hiện ở Third person, quay theo hướng nhìn (yaw)
    if (mannequinGroupRef.current) {
      mannequinGroupRef.current.visible = !isFirstPerson.current;
      mannequinGroupRef.current.rotation.y = yaw.current + Math.PI;
    }

    if (isFirstPerson.current) {
      camera.position.set(pos.x, pos.y + 0.6, pos.z);
      camera.rotation.set(pitch.current, yaw.current, 0, "YXZ");
    } else {
      // Orbit quanh điểm nhìn cố định (ngực nhân vật) theo cả yaw VÀ pitch —
      // trước đây pitch không có tác dụng gì ở third-person (camera khoá cứng
      // nhìn ngực), khiến không thể nhắm lên đầu/xuống chân chính mình để vẽ.
      const distance = 5;
      const horizontalDist = distance * Math.cos(pitch.current);
      const verticalOffset = distance * Math.sin(pitch.current);
      const camX = pos.x - Math.sin(yaw.current) * horizontalDist;
      const camZ = pos.z - Math.cos(yaw.current) * horizontalDist;
      camera.position.set(camX, pos.y + 0.8 + verticalOffset, camZ);
      camera.lookAt(pos.x, pos.y + 0.8, pos.z);
    }

    sendLocalTransform(pos.x, pos.y, pos.z, yaw.current);
    useGameStore.getState().setLocalPosition({ x: pos.x, y: pos.y, z: pos.z });
  });

  const pose = getPoseOffset(localPose);

  return (
    <RigidBody
      ref={bodyRef}
      colliders={false}
      mass={1}
      lockRotations
      position={[0, 1, 0]}
    >
      <CapsuleCollider args={[0.5, 0.4]} />
      <group
        ref={mannequinGroupRef}
        rotation={[pose.rotX, Math.PI, pose.rotZ]}
        position={[0, pose.posY, 0]}
        scale={[1, pose.scaleY, 1]}
      >
        <Mannequin sessionId={sessionId ?? "local-pending"} />
      </group>
    </RigidBody>
  );
}
