import { useEffect, Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { Physics } from "@react-three/rapier";
import { ArtStudioScene } from "./scene/ArtStudioScene";
import { Player } from "./scene/Player";
import { RemotePlayer } from "./scene/RemotePlayer";
import { InteractionController } from "./scene/useInteraction";
import { HUD } from "./ui/HUD";
import { ColorPickerUI } from "./ui/ColorPickerUI";
import { PoseSelector } from "./ui/PoseSelector";
import { VictoryOverlay } from "./ui/VictoryOverlay";
import { useGameStore } from "./store/useGameStore";
import { connectToGame, disconnectFromGame } from "./net/colyseus";

/**
 * Toàn bộ phần 3D nặng (Canvas/Physics/Rapier/Three) — TÁCH RIÊNG khỏi
 * App.tsx, chỉ tải qua `lazy(() => import("./Game"))` SAU KHI người chơi
 * bấm "Chơi ngay" ở StartScreen. Lý do: Rapier WASM (~3.1MB) là phần nặng
 * nhất của toàn app — không có lý do gì tải nó TRƯỚC KHI người chơi quyết
 * định chơi. Kết nối server (connectToGame) cũng đặt ở đây — chỉ join
 * room thật khi Game này thực sự mount, không chiếm slot phòng lúc người
 * chơi còn đang ở màn hình chờ.
 */
export default function Game() {
  const remotePlayers = useGameStore((s) => s.remotePlayers);
  const team = useGameStore((s) => s.team);

  useEffect(() => {
    connectToGame();
    return () => disconnectFromGame();
  }, []);

  return (
    <>
      <Canvas shadows camera={{ fov: 60 }}>
        <Suspense fallback={null}>
          <Physics gravity={[0, -18, 0]}>
            <ArtStudioScene />
            <Player />
            {Object.values(remotePlayers).map((p) => (
              <RemotePlayer key={p.id} player={p} />
            ))}
            <InteractionController />
          </Physics>
        </Suspense>
      </Canvas>
      <HUD />
      {/* Hút màu/Pose là cơ chế của Hider (vision.md mục 2) — Seeker không cần thấy */}
      {team === "hider" && (
        <>
          <ColorPickerUI />
          <PoseSelector />
        </>
      )}
      <VictoryOverlay />
    </>
  );
}
