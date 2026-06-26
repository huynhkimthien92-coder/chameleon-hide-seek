import { Schema, type, MapSchema } from "@colyseus/schema";

/**
 * State của 1 player trong room.
 *
 * KHÔNG còn colorHead/Torso/Arms/Legs (đã bỏ) — màu giờ là vẽ tự do bằng nét
 * cọ lên canvas riêng từng phần (paintRegistry.ts phía client), không phải
 * 1 giá trị màu/phần. Lịch sử nét vẽ lưu riêng ở GameRoom.ts (plain object,
 * KHÔNG qua Schema — vì danh sách nét vẽ có thể dài, không hợp để đồng bộ
 * qua state diffing như Colyseus Schema; thay vào đó dùng broadcast message
 * "paintStroke" + gửi lại toàn bộ lịch sử 1 lần cho người mới vào phòng).
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
}

/** Theo vision.md mục 3: 2 Seeker / 4 Hider, trận đếm ngược 180s. */
export class GameState extends Schema {
  @type({ map: PlayerState }) players = new MapSchema<PlayerState>();
  @type("number") matchSecondsLeft = 180;
  @type("string") phase: "lobby" | "playing" | "ended" = "lobby";
  @type("string") winner: "seeker" | "hider" | "" = "";
}
