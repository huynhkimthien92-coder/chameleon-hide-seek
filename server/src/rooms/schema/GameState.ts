import { Schema, type, MapSchema } from "@colyseus/schema";

/**
 * State của 1 player trong room.
 * colorHead/Torso/Arms/Legs + pose mới chỉ khai báo sẵn (giá trị mặc định) —
 * sẽ được client thực sự gửi/đọc ở Giai đoạn 2 (cơ chế Chameleon).
 * Khai báo trước để tránh phải migrate schema giữa các giai đoạn.
 */
export class PlayerState extends Schema {
  @type("number") x = 0;
  @type("number") y = 1;
  @type("number") z = 0;
  @type("number") rotY = 0;

  @type("string") team: "seeker" | "hider" = "hider";
  @type("string") pose: "idle" | "crouch" | "lean" | "lay" | "freeze" = "idle";
  @type("boolean") eliminated = false;
  @type("uint8") ammo = 5;

  @type("string") colorHead = "#ffffff";
  @type("string") colorTorso = "#ffffff";
  @type("string") colorArms = "#ffffff";
  @type("string") colorLegs = "#ffffff";
}

/** Theo vision.md mục 3: 2 Seeker / 4 Hider, trận đếm ngược 180s. */
export class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type("number") matchSecondsLeft = 180;
  @type("string") phase: "lobby" | "playing" | "ended" = "lobby";
  @type("string") winner: "seeker" | "hider" | "" = "";
}
