import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import type { RemotePlayerState } from "../store/useGameStore";
import { Mannequin } from "./Mannequin";
import { getPoseOffset } from "./poseTransform";

/**
 * Render player khác trong room tại vị trí đồng bộ từ Colyseus.
 *
 * LƯU Ý THIẾT KẾ: mannequin KHÔNG tô theo màu team (đỏ/xanh) nữa — chỉ dùng
 * đúng màu mà người chơi đó đã tự sơn (colorHead/Torso/Arms/Legs từ server).
 * Tô theo team sẽ lộ ngay ai là Seeker/Hider, phá vỡ cơ chế camouflage là
 * trọng tâm của game (xem vision.md). Phân biệt team chỉ nên hiện ở UI/HUD
 * (icon, không phải màu mannequin trong thế giới game) — xem design.md mục 2.
 */
export function RemotePlayer({ player }: { player: RemotePlayerState }) {
  const groupRef = useRef<THREE.Group>(null);

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
        position={[0, pose.posY, 0]}
        scale={[1, pose.scaleY, 1]}
      >
        <Mannequin colors={player.colors} />
      </group>
    </group>
  );
}
