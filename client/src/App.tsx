import { lazy, Suspense, useEffect, useState } from "react";
import { StartScreen } from "./ui/StartScreen";
import { LoadingScreen } from "./ui/LoadingScreen";

// Toàn bộ Three/Rapier/Colyseus nằm trong Game.tsx — chỉ tải khi cần (lazy),
// không nằm trong bundle chính. Xem Game.tsx để biết lý do đầy đủ.
const Game = lazy(() => import("./Game"));

function App() {
  const [started, setStarted] = useState(false);

  useEffect(() => {
    // Tải ngầm chunk Game lúc browser rảnh (không chặn lần vẽ đầu tiên của
    // StartScreen) — để lúc bấm "Chơi ngay" gần như tức thì vì module đã có
    // sẵn trong cache, vẫn giữ được lợi ích "không tải Rapier trước khi cần".
    const idleSchedule =
      "requestIdleCallback" in window
        ? (cb: () => void) => window.requestIdleCallback(cb)
        : (cb: () => void) => setTimeout(cb, 200);
    idleSchedule(() => {
      import("./Game");
    });
  }, []);

  if (!started) {
    return <StartScreen onPlay={() => setStarted(true)} />;
  }

  return (
    <Suspense fallback={<LoadingScreen />}>
      <Game />
    </Suspense>
  );
}

export default App;
