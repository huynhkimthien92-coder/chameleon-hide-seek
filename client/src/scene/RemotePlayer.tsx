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
        rotation={[pose.rotX, 0, pose.rotZ]}
        position={[0, CAPSULE_GROUND_OFFSET + pose.posY, 0]}
        scale={[1, pose.scaleY, 1]}
      >
        <Mannequin sessionId={player.id} pose={player.pose} />
      </group>
    </group>
  );
}
