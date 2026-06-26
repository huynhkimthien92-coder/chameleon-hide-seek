import { create } from "zustand";
import type { Pose } from "../scene/poseTransform";
import type { MannequinColors } from "../scene/Mannequin";

export type BodyPart = "head" | "torso" | "arms" | "legs";
export type Team = "seeker" | "hider";
export type MatchPhase = "lobby" | "playing" | "ended";

export type RemotePlayerState = {
  id: string;
  x: number;
  y: number;
  z: number;
  rotY: number;
  team: Team;
  pose: Pose;
  eliminated: boolean;
  colors: MannequinColors;
};

export type ConnectionStatus = "idle" | "connecting" | "connected" | "error";

type GameStore = {
  connectionStatus: ConnectionStatus;
  sessionId: string | null;
  remotePlayers: Record<string, RemotePlayerState>;

  // --- State của CHÍNH player này, đồng bộ 1 chiều từ server (authoritative) ---
  team: Team | null;
  ammo: number;
  eliminated: boolean;

  // --- Match info, top-level GameState từ server (vision.md mục 3) ---
  phase: MatchPhase;
  matchSecondsLeft: number;
  winner: Team | "";
  playerCount: number; // để hiện "đang chờ x/6" ở lobby

  // Giai đoạn 2 — Color Picker
  hoverColor: string | null; // màu đang nhìn thấy qua crosshair (chưa chọn)
  pickedColor: string | null; // màu đã "hút" — chờ áp dụng
  selectedPart: BodyPart; // bộ phận sẽ được áp màu khi nhấn "Áp dụng"
  localColors: MannequinColors; // màu hiện tại của mannequin local player

  // Giai đoạn 2 — Pose System
  localPose: Pose;

  // Giai đoạn 3 — Combat: phản hồi crosshair khi team = seeker
  aimTargetSessionId: string | null;
  aimTargetValid: boolean; // đang ngắm 1 Hider còn sống, trong tầm

  setConnectionStatus: (status: ConnectionStatus) => void;
  setSessionId: (id: string | null) => void;
  upsertRemotePlayer: (player: RemotePlayerState) => void;
  removeRemotePlayer: (id: string) => void;

  setTeam: (team: Team) => void;
  setAmmo: (ammo: number) => void;
  setEliminated: (eliminated: boolean) => void;

  setPhase: (phase: MatchPhase) => void;
  setMatchSecondsLeft: (seconds: number) => void;
  setWinner: (winner: Team | "") => void;
  setPlayerCount: (count: number) => void;

  setHoverColor: (color: string | null) => void;
  setPickedColor: (color: string | null) => void;
  setSelectedPart: (part: BodyPart) => void;
  applyPickedColorToLocal: () => void;

  setLocalPose: (pose: Pose) => void;

  setAimTarget: (sessionId: string | null, valid: boolean) => void;
};

export const useGameStore = create<GameStore>((set, get) => ({
  connectionStatus: "idle",
  sessionId: null,
  remotePlayers: {},

  team: null,
  ammo: 5,
  eliminated: false,

  phase: "lobby",
  matchSecondsLeft: 180,
  winner: "",
  playerCount: 0,

  hoverColor: null,
  pickedColor: null,
  selectedPart: "torso",
  localColors: { head: "#ffffff", torso: "#ffffff", arms: "#ffffff", legs: "#ffffff" },

  localPose: "idle",

  aimTargetSessionId: null,
  aimTargetValid: false,

  setConnectionStatus: (status) => set({ connectionStatus: status }),
  setSessionId: (id) => set({ sessionId: id }),
  upsertRemotePlayer: (player) =>
    set((state) => ({
      remotePlayers: { ...state.remotePlayers, [player.id]: player },
    })),
  removeRemotePlayer: (id) =>
    set((state) => {
      const next = { ...state.remotePlayers };
      delete next[id];
      return { remotePlayers: next };
    }),

  setTeam: (team) => set({ team }),
  setAmmo: (ammo) => set({ ammo }),
  setEliminated: (eliminated) => set({ eliminated }),

  setPhase: (phase) => set({ phase }),
  setMatchSecondsLeft: (seconds) => set({ matchSecondsLeft: seconds }),
  setWinner: (winner) => set({ winner }),
  setPlayerCount: (count) => set({ playerCount: count }),

  setHoverColor: (color) => set({ hoverColor: color }),
  setPickedColor: (color) => set({ pickedColor: color }),
  setSelectedPart: (part) => set({ selectedPart: part }),
  applyPickedColorToLocal: () => {
    const { pickedColor, selectedPart, localColors } = get();
    if (!pickedColor) return;
    set({ localColors: { ...localColors, [selectedPart]: pickedColor } });
  },

  setLocalPose: (pose) => set({ localPose: pose }),

  setAimTarget: (sessionId, valid) => set({ aimTargetSessionId: sessionId, aimTargetValid: valid }),
}));
