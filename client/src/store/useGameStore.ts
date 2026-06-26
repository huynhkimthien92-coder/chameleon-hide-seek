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

  // Vị trí nhân vật hiện tại — dùng để tính tầm hút màu/bắn/vẽ theo NHÂN VẬT,
  // không phải theo camera (camera lùi xa nhân vật ở third-person).
  localPosition: { x: number; y: number; z: number };

  // Color Picker — hút màu từ môi trường, "cầm" 1 màu để vẽ lên người (tự do,
  // không chia ô đầu/thân/tay/chân — người chơi tự chọn vị trí bằng cách
  // nhắm trực tiếp, xem useInteraction.ts + paintRegistry.ts).
  hoverColor: string | null; // màu đang nhìn thấy qua crosshair (chưa chọn)
  heldColor: string | null; // màu đang "cầm" sau khi hút — dùng để vẽ

  // Pose System
  localPose: Pose;

  // Combat: phản hồi crosshair khi team = seeker
  aimTargetSessionId: string | null;
  aimTargetValid: boolean; // đang ngắm 1 Hider còn sống, trong tầm

  // Đang nhắm vào ĐÚNG NGƯỜI MÌNH (sẵn sàng vẽ) — để crosshair hiện chỉ báo
  // riêng, phân biệt với "nhắm vào người khác" hoặc "nhắm vào môi trường".
  isAimingOwnBody: boolean;

  // Con trỏ vẽ tự do: trong lúc giữ chuột trái để vẽ, camera ĐỨNG YÊN, chuột
  // di chuyển 1 con trỏ tự do trong khung hình (giống app vẽ thật) thay vì
  // xoay camera — xem Player.tsx (mousemove) + useInteraction.ts (raycast).
  isPaintDragging: boolean;
  reticleOffset: { x: number; y: number }; // NDC, -1..1, (0,0) = giữa màn hình

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

  setLocalPose: (pose: Pose) => void;

  setAimTarget: (sessionId: string | null, valid: boolean) => void;
  setIsAimingOwnBody: (value: boolean) => void;
  setIsPaintDragging: (value: boolean) => void;
  setReticleOffset: (offset: { x: number; y: number }) => void;
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

  localPose: "idle",

  aimTargetSessionId: null,
  aimTargetValid: false,
  isAimingOwnBody: false,
  isPaintDragging: false,
  reticleOffset: { x: 0, y: 0 },

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

  setLocalPose: (pose) => set({ localPose: pose }),

  setAimTarget: (sessionId, valid) => set({ aimTargetSessionId: sessionId, aimTargetValid: valid }),
  setIsAimingOwnBody: (value) => set({ isAimingOwnBody: value }),
  setIsPaintDragging: (value) => set({ isPaintDragging: value }),
  setReticleOffset: (offset) => set({ reticleOffset: offset }),
}));

export type { BodyPart };
