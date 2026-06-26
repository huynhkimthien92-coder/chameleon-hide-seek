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
import { PaintBoard } from "./ui/PaintBoard";
import { VictoryOverlay } from "./ui/VictoryOverlay";
import { useGameStore } from "./store/useGameStore";
import { connectToGame, disconnectFromGame } from "./net/colyseus";

function App() {
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
      <PaintBoard />
    </>
  );
}

export default App;
