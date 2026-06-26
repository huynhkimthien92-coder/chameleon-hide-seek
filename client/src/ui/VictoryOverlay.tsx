import { useEffect, useRef } from "react";
import { Crosshair, Leaf } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import { sfx } from "../audio/sounds";

export function VictoryOverlay() {
  const phase = useGameStore((s) => s.phase);
  const winner = useGameStore((s) => s.winner);
  const team = useGameStore((s) => s.team);

  const playedFor = useRef<string | null>(null);

  useEffect(() => {
    if (phase !== "ended" || !winner) return;
    if (playedFor.current === winner) return; // chỉ phát 1 lần mỗi trận
    playedFor.current = winner;
    if (team === winner) sfx.victory();
    else sfx.defeat();
  }, [phase, winner, team]);

  if (phase !== "ended") return null;

  const youWon = team === winner;
  const tintClass = winner === "seeker" ? "bg-primary/20" : "bg-accent/20";
  const WinnerIcon = winner === "seeker" ? Crosshair : Leaf;

  return (
    <div
      className={`pointer-events-auto fixed inset-0 flex items-center justify-center
                  ${tintClass} font-body select-none`}
    >
      <div className="bg-surface rounded-panel shadow-hard-surface px-10 py-8 text-center max-w-sm">
        <h1 className="font-display font-extrabold text-3xl text-ink mb-2">
          {youWon ? "🎉 Bạn thắng!" : "💀 Bạn thua"}
        </h1>
        <p className="text-ink/70 mb-1 flex items-center justify-center gap-1.5">
          Phe thắng:
          <WinnerIcon size={16} className={winner === "seeker" ? "text-primary" : "text-accent"} />
          <strong>{winner === "seeker" ? "Seeker" : "Hider"}</strong>
        </p>
        <p className="text-sm text-ink/50">
          {winner === "seeker"
            ? "Tất cả Hider đã bị loại."
            : "Hết giờ — vẫn còn Hider sống sót."}
        </p>
      </div>
    </div>
  );
}
