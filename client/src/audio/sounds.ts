import { Howl } from "howler";
import { encodeWav } from "./wavEncoder";
import {
  synthPaintPop,
  synthGunshot,
  synthEmptyClick,
  synthHitDing,
  synthEliminated,
  synthVictory,
  synthDefeat,
  synthUiClick,
} from "./synthesize";

function makeHowl(samples: Float32Array, volume = 0.5): Howl {
  const url = URL.createObjectURL(encodeWav(samples));
  return new Howl({ src: [url], format: ["wav"], volume });
}

// Lazy — chỉ synth + tạo Blob URL khi thực sự cần phát lần đầu (tránh chặn
// thread chính lúc app khởi động vì phải làm cùng lúc 8 thứ).
let cache: Partial<Record<string, Howl>> = {};

function getOrCreate(key: string, factory: () => Howl): Howl {
  if (!cache[key]) cache[key] = factory();
  return cache[key]!;
}

export const sfx = {
  paintPop: () => getOrCreate("paintPop", () => makeHowl(synthPaintPop(), 0.4)).play(),
  gunshot: () => getOrCreate("gunshot", () => makeHowl(synthGunshot(), 0.5)).play(),
  emptyClick: () => getOrCreate("emptyClick", () => makeHowl(synthEmptyClick(), 0.3)).play(),
  hitDing: () => getOrCreate("hitDing", () => makeHowl(synthHitDing(), 0.5)).play(),
  eliminated: () => getOrCreate("eliminated", () => makeHowl(synthEliminated(), 0.45)).play(),
  victory: () => getOrCreate("victory", () => makeHowl(synthVictory(), 0.5)).play(),
  defeat: () => getOrCreate("defeat", () => makeHowl(synthDefeat(), 0.45)).play(),
  uiClick: () => getOrCreate("uiClick", () => makeHowl(synthUiClick(), 0.25)).play(),
};
