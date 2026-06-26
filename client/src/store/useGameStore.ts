import { create } from "zustand";
import type { Pose } from "../scene/poseTransform";
import type { BodyPart } from "../scene/paintRegistry";

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

  // Vị trí nhân vật hiện tại — dùng để tính tầm hút màu theo NHÂN VẬT,
  // không phải theo camera (camera lùi xa nhân vật ở third-person).
  localPosition: { x: number; y: number; z: number };

  // Color Picker (hút màu từ môi trường trong 3D) — KHÔNG đổi.
  hoverColor: string | null; // màu đang nhìn thấy qua crosshair (chưa chọn)
  heldColor: string | null; // màu đang "cầm" — dùng để vẽ trong Bảng vẽ 2D

  // Bảng vẽ 2D (PaintBoard.tsx) — thay cho việc nhắm+vẽ trong không gian 3D
  // (đã bỏ vì luôn vướng camera/góc nhìn, không kiểm soát được chính xác).
  isPaintBoardOpen: boolean;

  // Pose System
  localPose: Pose;

  // Combat: phản hồi crosshair khi team = seeker
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

  setLocalPosition: (pos: { x: number; y: number; z: number }) => void;

  setHoverColor: (color: string | null) => void;
  setHeldColor: (color: string | null) => void;

  setIsPaintBoardOpen: (open: boolean) => void;

  setLocalPose: (pose: Pose) => void;

  setAimTarget: (sessionId: string | null, valid: boolean) => void;
};

export const useGameStore = create<GameStore>((set) => ({
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

  localPosition: { x: 0, y: 1, z: 0 },

  hoverColor: null,
  heldColor: null,

  isPaintBoardOpen: false,

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

  setLocalPosition: (pos) => set({ localPosition: pos }),

  setHoverColor: (color) => set({ hoverColor: color }),
  setHeldColor: (color) => set({ heldColor: color }),

  setIsPaintBoardOpen: (open) => set({ isPaintBoardOpen: open }),

  setLocalPose: (pose) => set({ localPose: pose }),

  setAimTarget: (sessionId, valid) => set({ aimTargetSessionId: sessionId, aimTargetValid: valid }),
}));

export type { BodyPart };
