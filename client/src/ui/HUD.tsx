import { useEffect, useRef, type ReactNode } from "react";
import { Crosshair as CrosshairIcon, Leaf as LeafIcon, Paintbrush } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import { sfx } from "../audio/sounds";

const STATUS_LABEL: Record<string, string> = {
  idle: "Chưa kết nối",
  connecting: "Đang kết nối...",
  connected: "Đã kết nối",
  error: "Lỗi kết nối",
};

const ROOM_CAPACITY = 6; // khớp server (vision.md mục 3) — chỉ để hiển thị

/** Dịch crosshair theo reticleOffset (NDC) lúc đang kéo vẽ — đứng yên giữa màn hình lúc khác. */
function ReticleWrapper({ children }: { children: ReactNode }) {
  const isPaintDragging = useGameStore((s) => s.isPaintDragging);
  const reticleOffset = useGameStore((s) => s.reticleOffset);

  const translateX = isPaintDragging ? reticleOffset.x * (window.innerWidth / 2) : 0;
  const translateY = isPaintDragging ? -reticleOffset.y * (window.innerHeight / 2) : 0;

  return (
    <div
      className="fixed top-1/2 left-1/2"
      style={{ transform: `translate(calc(-50% + ${translateX}px), calc(-50% + ${translateY}px))` }}
    >
      {children}
    </div>
  );
}

function Crosshair() {
  const team = useGameStore((s) => s.team);
  const hoverColor = useGameStore((s) => s.hoverColor);
  const aimTargetValid = useGameStore((s) => s.aimTargetValid);
  const isAimingOwnBody = useGameStore((s) => s.isAimingOwnBody);
  const heldColor = useGameStore((s) => s.heldColor);

  if (team === "seeker") {
    return (
      <div
        className={`w-4 h-4 rounded-full border-2 transition-colors
          ${aimTargetValid ? "border-accent bg-accent/40" : "border-white"}`}
      />
    );
  }

  // Đang nhắm ĐÚNG NGƯỜI MÌNH — chỉ báo riêng, khác hẳn hover môi trường,
  // để không nhầm "nhắm vào người khác" với "nhắm vào chính mình".
  if (isAimingOwnBody) {
    return (
      <div
        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center
          ${heldColor ? "border-accent" : "border-white border-dashed"}`}
        style={{ backgroundColor: heldColor ?? "transparent" }}
        title={heldColor ? "Giữ chuột trái để vẽ" : "Chưa cầm màu — hút màu từ môi trường trước"}
      >
        <Paintbrush size={12} className={heldColor ? "text-white/90" : "text-white/70"} />
      </div>
    );
  }

  // Hider (hoặc chưa rõ team) — preview màu hút được, giống Giai đoạn 2
  return (
    <div
      className="w-5 h-5 rounded-full border-2 border-white"
      style={{ backgroundColor: hoverColor ?? "transparent" }}
    />
  );
}

export function HUD() {
  const ammo = useGameStore((s) => s.ammo);
  const team = useGameStore((s) => s.team);
  const eliminated = useGameStore((s) => s.eliminated);
  const phase = useGameStore((s) => s.phase);
  const playerCount = useGameStore((s) => s.playerCount);
  const matchSecondsLeft = useGameStore((s) => s.matchSecondsLeft);
  const connectionStatus = useGameStore((s) => s.connectionStatus);
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

      {/* Crosshair — giữa màn hình, hoặc lệch theo reticle lúc đang kéo vẽ */}
      <ReticleWrapper>
        <Crosshair />
      </ReticleWrapper>

      {/* Ammo — chỉ hiện cho Seeker (vision.md mục 2) */}
      {team === "seeker" && (
        <div
          className="absolute top-4 left-4 bg-primary text-white font-display font-bold
                     px-5 py-2 rounded-pill shadow-hard-primary"
        >
          Đạn: {ammo}
        </div>
      )}

      {/* Timer / Lobby — góc trên-phải */}
      <div
        className="absolute top-4 right-4 bg-surface text-ink font-display font-bold
                   px-5 py-2 rounded-pill shadow-hard-surface"
      >
        {phase === "lobby"
          ? `Đang chờ người chơi… (${playerCount}/${ROOM_CAPACITY})`
          : `${minutes}:${seconds.toString().padStart(2, "0")}`}
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
          {team === "seeker" ? "Click trái để bắn" : "Click để hút màu · Nhắm vào người mình + giữ chuột để vẽ"}
        </div>
      </div>
    </div>
  );
}
