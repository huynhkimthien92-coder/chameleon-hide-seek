import { useEffect, useRef } from "react";
import { Crosshair as CrosshairIcon, Leaf as LeafIcon } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import { sfx } from "../audio/sounds";

const STATUS_LABEL: Record<string, string> = {
  idle: "Chưa kết nối",
  connecting: "Đang kết nối...",
  connected: "Đã kết nối",
  error: "Lỗi kết nối",
};

const ROOM_CAPACITY = 6; // khớp server (vision.md mục 3) — chỉ để hiển thị

function Crosshair() {
  const team = useGameStore((s) => s.team);
  const aimTargetValid = useGameStore((s) => s.aimTargetValid);
  const isPainting = useGameStore((s) => s.isPainting);

  if (isPainting) return null; // đang tô màu -> dùng con trỏ chuột thật, không cần crosshair giữa màn hình

  if (team === "seeker") {
    return (
      <div
        className={`w-4 h-4 rounded-full border-2 transition-colors
          ${aimTargetValid ? "border-accent bg-accent/40" : "border-white"}`}
      />
    );
  }

  return null; // Hider ngoài chế độ tô màu — không hút màu/vẽ được ở đây nữa, không cần hiện gì
}

export function HUD() {
  const ammo = useGameStore((s) => s.ammo);
  const team = useGameStore((s) => s.team);
  const eliminated = useGameStore((s) => s.eliminated);
  const phase = useGameStore((s) => s.phase);
  const playerCount = useGameStore((s) => s.playerCount);
  const matchSecondsLeft = useGameStore((s) => s.matchSecondsLeft);
  const prepSecondsLeft = useGameStore((s) => s.prepSecondsLeft);
  const connectionStatus = useGameStore((s) => s.connectionStatus);
  const isPainting = useGameStore((s) => s.isPainting);
  const remoteCount = useGameStore((s) => Object.keys(s.remotePlayers).length);

  const minutes = Math.floor(matchSecondsLeft / 60);
  const seconds = matchSecondsLeft % 60;

  const wasEliminated = useRef(false);
  useEffect(() => {
    if (eliminated && !wasEliminated.current) sfx.eliminated();
    wasEliminated.current = eliminated;
  }, [eliminated]);

  return (
    <div className="pointer-events-none fixed inset-0 font-body select-none">
      {/* Spectate — khi đã bị loại (vision.md mục 3) */}
      {eliminated && phase === "playing" && (
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 bg-ink text-white
                     font-display font-bold px-5 py-2 rounded-pill shadow-hard-surface"
        >
          👁 Đang Spectate — bạn đã bị loại
        </div>
      )}

      {/* Đang tô màu — nhân vật/camera đứng yên, di chuột để hút màu hoặc tô */}
      {isPainting && (
        <div
          className="absolute top-20 left-1/2 -translate-x-1/2 bg-accent text-white
                     font-display font-bold px-5 py-2 rounded-pill shadow-hard-accent"
        >
          🎨 Đang tô màu — nhắm tường để hút màu, nhắm người để tô · Cuộn chuột để zoom · Escape/"Xong" để thoát
        </div>
      )}

      {/* Crosshair — giữa màn hình */}
      <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <Crosshair />
      </div>

      {/* Ammo — chỉ hiện cho Seeker (vision.md mục 2) */}
      {team === "seeker" && (
        <div
          className="absolute top-4 left-4 bg-primary text-white font-display font-bold
                     px-5 py-2 rounded-pill shadow-hard-primary"
        >
          Đạn: {ammo}
        </div>
      )}

      {/* Timer / Lobby / Chuẩn bị — góc trên-phải */}
      <div
        className={`absolute top-4 right-4 font-display font-bold px-5 py-2 rounded-pill shadow-hard-surface
          ${phase === "preparing" ? "bg-accent text-white" : "bg-surface text-ink"}`}
      >
        {phase === "lobby" && `Đang chờ người chơi… (${playerCount}/${ROOM_CAPACITY})`}
        {phase === "preparing" &&
          `🙈 Đang chuẩn bị: ${prepSecondsLeft}s${team === "seeker" ? " — chờ đã!" : " — giấu mình đi!"}`}
        {(phase === "playing" || phase === "ended") &&
          `${minutes}:${seconds.toString().padStart(2, "0")}`}
      </div>

      {/* Trạng thái kết nối — góc dưới-trái (debug) */}
      <div
        className="absolute bottom-4 left-4 bg-surface text-ink text-sm
                   px-4 py-2 rounded-panel shadow-hard-surface flex items-center gap-2"
      >
        <span>{STATUS_LABEL[connectionStatus] ?? connectionStatus}</span>
        {team && (
          <span
            className={`inline-flex items-center gap-1 font-display font-bold px-2 py-0.5 rounded-pill text-white text-xs
              ${team === "seeker" ? "bg-primary" : "bg-accent"}`}
          >
            {team === "seeker" ? <CrosshairIcon size={12} /> : <LeafIcon size={12} />}
            {team === "seeker" ? "Seeker" : "Hider"}
          </span>
        )}
        <span>· {remoteCount} người chơi khác</span>
        <div className="text-xs opacity-60 basis-full mt-1">
          Click vào màn hình để bắt đầu · WASD di chuyển · V đổi góc nhìn ·{" "}
          {team === "seeker" ? "Click trái để bắn" : "Bấm \"Tô màu\" để hút màu + tô lên người"}
        </div>
      </div>
    </div>
  );
}
