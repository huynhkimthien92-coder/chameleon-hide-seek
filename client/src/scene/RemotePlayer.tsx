import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RemotePlayerState } from "../store/useGameStore";
import { Mannequin, releaseMannequinCanvases } from "./Mannequin";
import { getPoseOffset, CAPSULE_GROUND_OFFSET } from "./poseTransform";

/**
 * Render player khác trong room tại vị trí đồng bộ từ Colyseus.
 *
 * LƯU Ý THIẾT KẾ: mannequin KHÔNG tô theo màu team (đỏ/xanh) — chỉ hiện đúng
 * những gì người chơi đó đã tự vẽ lên canvas riêng của họ (paintRegistry.ts,
 * đồng bộ qua message "paintStroke" — xem net/colyseus.ts). Tô theo team sẽ
 * lộ ngay ai là Seeker/Hider, phá vỡ cơ chế camouflage là trọng tâm của game.
 */
export function RemotePlayer({ player }: { player: RemotePlayerState }) {
  const groupRef = useRef<THREE.Group>(null);
  const innerGroupRef = useRef<THREE.Group>(null);
  // [DEBUG TẠM] in góc xoay thật ra console (throttle, không phải hook trong
  // callback — chỉ ghi số bình thường, an toàn).
  const lastDebugLog = useRef(0);

  // Giải phóng canvas vẽ khi player này thật sự rời phòng (unmount hẳn,
  // không phải lúc eliminated — eliminated chỉ ẩn render, xem return null dưới).
  useEffect(() => {
    return () => releaseMannequinCanvases(player.id);
  }, [player.id]);

  useFrame(() => {
    if (!groupRef.current) return;
    groupRef.current.position.lerp(
      new THREE.Vector3(player.x, player.y, player.z),
      0.25
    );
    groupRef.current.rotation.y = THREE.MathUtils.lerp(
      groupRef.current.rotation.y,
      player.rotY + Math.PI,
      0.25
    );

    // [DEBUG TẠM] log mỗi ~500ms — đọc góc xoay THẬT của cả 2 group + pose
    // gốc nhận từ server, lưu vào window theo từng player.id (không bị đè
    // lẫn nhau giữa nhiều remote player).
    const nowMs = performance.now();
    if (nowMs - lastDebugLog.current > 500) {
      lastDebugLog.current = nowMs;
      const pose = getPoseOffset(player.pose);
      const key = `__remoteDebug_${player.id}`;
      (window as unknown as Record<string, unknown>)[key] = {
        rawPoseFromServer: player.pose,
        poseOffset: { rotX: pose.rotX, rotZ: pose.rotZ, posY: pose.posY, scaleY: pose.scaleY },
        outerGroupRotation: groupRef.current
          ? { x: groupRef.current.rotation.x, y: groupRef.current.rotation.y, z: groupRef.current.rotation.z }
          : null,
        innerGroupRotation: innerGroupRef.current
          ? { x: innerGroupRef.current.rotation.x, y: innerGroupRef.current.rotation.y, z: innerGroupRef.current.rotation.z }
          : null,
        innerGroupPosition: innerGroupRef.current
          ? { x: innerGroupRef.current.position.x, y: innerGroupRef.current.position.y, z: innerGroupRef.current.position.z }
          : null,
      };
    }
  });

  if (player.eliminated) return null; // bị loại -> không render (xem vision.md Spectate)

  const pose = getPoseOffset(player.pose);

  return (
    <group
      ref={groupRef}
      position={[player.x, player.y, player.z]}
      userData={{ playerSessionId: player.id }}
    >
      <group
        ref={innerGroupRef}
        rotation={[pose.rotX, 0, pose.rotZ]}
        position={[0, CAPSULE_GROUND_OFFSET + pose.posY, 0]}
        scale={[1, pose.scaleY, 1]}
      >
        <Mannequin sessionId={player.id} pose={player.pose} />
      </group>
    </group>
  );
}
