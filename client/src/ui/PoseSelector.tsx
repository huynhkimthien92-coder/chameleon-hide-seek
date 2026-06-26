import { PersonStanding, ChevronDown, MoveDiagonal, Minus, Snowflake } from "lucide-react";
import { useGameStore } from "../store/useGameStore";
import { sendPose } from "../net/colyseus";
import { POSE_LIST, type Pose } from "../scene/poseTransform";
import { sfx } from "../audio/sounds";

const POSE_ICONS: Record<Pose, typeof PersonStanding> = {
  idle: PersonStanding,
  crouch: ChevronDown,
  lean: MoveDiagonal,
  lay: Minus,
  freeze: Snowflake,
};

export function PoseSelector() {
  const localPose = useGameStore((s) => s.localPose);
  const setLocalPose = useGameStore((s) => s.setLocalPose);

  return (
    <div className="pointer-events-auto fixed bottom-24 left-1/2 -translate-x-1/2 flex gap-2 select-none">
      {POSE_LIST.map((pose) => {
        const Icon = POSE_ICONS[pose.id];
        const active = localPose === pose.id;
        return (
          <button
            key={pose.id}
            title={pose.label}
            onClick={() => {
              setLocalPose(pose.id);
              sendPose(pose.id);
              sfx.uiClick();
            }}
            className={`w-11 h-11 rounded-full flex items-center justify-center transition
              active:translate-y-[2px] active:shadow-none
              ${
                active
                  ? "bg-accent text-white shadow-hard-accent -translate-y-0.5"
                  : "bg-surface text-ink shadow-hard-surface"
              }`}
          >
            <Icon size={20} strokeWidth={2.25} />
          </button>
        );
      })}
    </div>
  );
}
