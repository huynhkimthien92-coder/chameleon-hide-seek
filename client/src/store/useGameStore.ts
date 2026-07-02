import { create } from "zustand";
import type { Pose } from "../scene/poseTransform";

export type Team = "seeker" | "hider";
export type MatchPhase = "lobby" | "preparing" | "playing" | "ended";

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
  prepSecondsLeft: number; // đếm ngược pha chuẩn bị (Hider giấu mình/vẽ, Seeker bị chặn)
  matchSecondsLeft: number;
  winner: Team | "";
  playerCount: number; // để hiện "đang chờ x/6" ở lobby

  // Vị trí nhân vật hiện tại — dùng để tính tầm hút màu theo NHÂN VẬT,
  // không phải theo camera (camera lùi xa nhân vật ở third-person).
  localPosition: { x: number; y: number; z: number };

  // Color Picker (hút màu từ môi trường trong 3D) — KHÔNG đổi.
  hoverColor: string | null; // màu đang nhìn thấy qua crosshair (chưa chọn)
  heldColor: string | null; // màu đang "cầm" — dùng để vẽ trong Bảng vẽ 2D

  // Chế độ vẽ: bấm "Cọ vẽ" -> nhân vật + camera đứng yên hẳn (không xoay theo
  // chuột nữa), chuột thật (thoát pointer-lock) điều khiển con trỏ tự do để
  // vẽ trực tiếp lên người NGAY TRONG THẾ GIỚI GAME — giữ nguyên map/môi
  // trường xung quanh trong tầm nhìn để so màu cho khớp lúc vẽ. Đã bỏ hẳn
  // cách "khung 3D riêng" (PaintBoard) vì làm mất hoàn toàn khả năng so màu
  // với môi trường xung quanh — đúng mục đích cốt lõi của camo.
  isPainting: boolean;
  isAimingOwnBody: boolean; // đang nhắm đúng người mình (sẵn sàng vẽ) trong lúc isPainting
  brushSize: number; // bán kính nét cọ 3D, đơn vị local mesh (cao ~1.9) — chỉnh bằng thanh trượt trong ColorPickerUI

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
  setPrepSecondsLeft: (seconds: number) => void;
  setMatchSecondsLeft: (seconds: number) => void;
  setWinner: (winner: Team | "") => void;
  setPlayerCount: (count: number) => void;

  setLocalPosition: (pos: { x: number; y: number; z: number }) => void;

  setHoverColor: (color: string | null) => void;
  setHeldColor: (color: string | null) => void;

  setIsPainting: (value: boolean) => void;
  setIsAimingOwnBody: (value: boolean) => void;
  setBrushSize: (size: number) => void;

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
  prepSecondsLeft: 30,
  matchSecondsLeft: 180,
  winner: "",
  playerCount: 0,

  localPosition: { x: 0, y: 1, z: 0 },

  hoverColor: null,
  heldColor: null,

  isPainting: false,
  isAimingOwnBody: false,
  brushSize: 0.1,

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
  setPrepSecondsLeft: (seconds) => set({ prepSecondsLeft: seconds }),
  setMatchSecondsLeft: (seconds) => set({ matchSecondsLeft: seconds }),
  setWinner: (winner) => set({ winner }),
  setPlayerCount: (count) => set({ playerCount: count }),

  setLocalPosition: (pos) => set({ localPosition: pos }),

  setHoverColor: (color) => set({ hoverColor: color }),
  setHeldColor: (color) => set({ heldColor: color }),

  setIsPainting: (value) => set({ isPainting: value }),
  setIsAimingOwnBody: (value) => set({ isAimingOwnBody: value }),
  setBrushSize: (size) => set({ brushSize: size }),

  setLocalPose: (pose) => set({ localPose: pose }),

  setAimTarget: (sessionId, valid) => set({ aimTargetSessionId: sessionId, aimTargetValid: valid }),
}));

