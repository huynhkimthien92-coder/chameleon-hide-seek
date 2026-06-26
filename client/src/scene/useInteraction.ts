import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../store/useGameStore";
import { sampleCanvasAtUV, getSampleableCanvas } from "./colorSampling";
import { sendShoot } from "../net/colyseus";
import { sfx } from "../audio/sounds";

const PICK_RANGE = 6; // mét — tầm hút màu tối đa
const AIM_RANGE = 30; // mét — tầm ngắm bắn, khớp MAX_SHOOT_RANGE phía server

/** Đi lên cây cha tìm group đã gắn userData.playerSessionId (xem RemotePlayer.tsx). */
function findPlayerSessionId(object: THREE.Object3D | null): string | null {
  let current = object;
  while (current) {
    if (current.userData?.playerSessionId) return current.userData.playerSessionId as string;
    current = current.parent;
  }
  return null;
}

/**
 * Raycast liên tục từ giữa màn hình (crosshair, kiểu FPS aim-to-interact vì
 * chuột đã bị pointer-lock cho việc nhìn — không có cursor 2D tự do).
 *
 * - team === "hider": hút màu từ môi trường (userData.pickable, Giai đoạn 2).
 * - team === "seeker": ngắm người chơi khác (userData.playerSessionId, Giai đoạn 3).
 *
 * Click trái (khi đã pointer-lock):
 * - Hider: "hút" màu đang hover vào ô màu đã chọn (chưa bắn được gì cả).
 * - Seeker: bắn ngay (server tự validate lại, xem GameRoom.ts isValidShot).
 */
export function useInteraction() {
  const { camera, scene, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const lastHover = useRef<string | null>(null);
  const setHoverColor = useGameStore((s) => s.setHoverColor);
  const setPickedColor = useGameStore((s) => s.setPickedColor);
  const setAimTarget = useGameStore((s) => s.setAimTarget);

  useFrame(() => {
    const team = useGameStore.getState().team;
    raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.current.intersectObjects(scene.children, true);

    if (team === "seeker") {
      const hit = hits.find(
        (h) => findPlayerSessionId(h.object) && h.distance <= AIM_RANGE
      );
      const sessionId = hit ? findPlayerSessionId(hit.object) : null;
      const remote = sessionId ? useGameStore.getState().remotePlayers[sessionId] : null;
      const valid = !!remote && remote.team === "hider" && !remote.eliminated;
      setAimTarget(sessionId, valid);
      return;
    }

    // Hider (hoặc chưa rõ team) -> hút màu môi trường như Giai đoạn 2
    const hit = hits.find((h) => h.object.userData?.pickable && h.uv && h.distance <= PICK_RANGE);
    let next: string | null = null;
    if (hit?.uv) {
      const mesh = hit.object as THREE.Mesh;
      const material = mesh.material as THREE.MeshStandardMaterial;
      const canvas = getSampleableCanvas(material.map);
      if (canvas) next = sampleCanvasAtUV(canvas, hit.uv.x, hit.uv.y);
    }
    if (next !== lastHover.current) {
      lastHover.current = next;
      setHoverColor(next);
    }
  });

  useEffect(() => {
    const canvasEl = gl.domElement;
    const onMouseDown = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvasEl) return; // click đầu để lock, bỏ qua
      if (e.button !== 0) return; // chuột trái

      const team = useGameStore.getState().team;
      if (team === "seeker") {
        const { aimTargetSessionId, aimTargetValid, ammo } = useGameStore.getState();
        if (ammo <= 0) {
          sfx.emptyClick();
          return;
        }
        sendShoot(aimTargetSessionId);
        sfx.gunshot();
        if (aimTargetValid) sfx.hitDing(); // dự đoán phía client — server vẫn validate lại
        return;
      }

      const hover = useGameStore.getState().hoverColor;
      if (hover) setPickedColor(hover);
    };
    canvasEl.addEventListener("mousedown", onMouseDown);
    return () => canvasEl.removeEventListener("mousedown", onMouseDown);
  }, [gl, setPickedColor]);
}

/** Component rỗng — chỉ để gọi hook bên trong <Canvas>. */
export function InteractionController() {
  useInteraction();
  return null;
}
