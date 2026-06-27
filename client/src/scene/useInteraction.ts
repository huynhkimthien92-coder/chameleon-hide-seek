import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../store/useGameStore";
import { sampleCanvasAtUV, getSampleableCanvas } from "./colorSampling";
import { sendShoot } from "../net/colyseus";
import { sfx } from "../audio/sounds";

const PICK_RANGE = 6; // mét — tầm hút màu tối đa (đo từ NHÂN VẬT, không phải camera)
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
 * - team === "hider": hút màu từ môi trường (userData.pickable). Vẽ lên
 *   người KHÔNG còn làm ở đây nữa — xem ui/PaintBoard.tsx (bảng vẽ 2D riêng,
 *   thay cho cách nhắm trong không gian 3D đã bỏ vì luôn vướng camera/góc
 *   nhìn, không kiểm soát chính xác được).
 * - team === "seeker": ngắm người chơi khác để bắn (không đổi).
 */
export function useInteraction() {
  const { camera, scene, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const lastHover = useRef<string | null>(null);

  const setHoverColor = useGameStore((s) => s.setHoverColor);
  const setAimTarget = useGameStore((s) => s.setAimTarget);

  useFrame(() => {
    const team = useGameStore.getState().team;
    raycaster.current.setFromCamera(new THREE.Vector2(0, 0), camera);
    const hits = raycaster.current.intersectObjects(scene.children, true);
    const playerPos = useGameStore.getState().localPosition;
    const playerVec = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);

    if (team === "seeker") {
      const hit = hits.find((h) => findPlayerSessionId(h.object));
      const distanceFromPlayer = hit ? hit.point.distanceTo(playerVec) : Infinity;
      const inRange = distanceFromPlayer <= AIM_RANGE;
      const sessionId = hit && inRange ? findPlayerSessionId(hit.object) : null;
      const remote = sessionId ? useGameStore.getState().remotePlayers[sessionId] : null;
      const valid = !!remote && remote.team === "hider" && !remote.eliminated;
      setAimTarget(sessionId, valid);
      return;
    }

    // Hider — hút màu môi trường
    const hit = hits.find((h) => h.object.userData?.pickable && h.uv);
    const distanceFromPlayer = hit ? hit.point.distanceTo(playerVec) : Infinity;
    let next: string | null = null;
    if (hit?.uv && distanceFromPlayer <= PICK_RANGE) {
      const mesh = hit.object as THREE.Mesh;
      const material = mesh.material as THREE.MeshStandardMaterial;
      const canvas = getSampleableCanvas(material.map);
      if (canvas) {
        // Nhân theo texture.repeat — bắt buộc cho texture có lặp lại (sàn,
        // xem ArtStudioScene.tsx) vì raycaster trả UV thô 0..1 theo hình học,
        // KHÔNG tự biết GPU đang lặp ảnh mấy lần khi hiển thị. Texture không
        // lặp có repeat mặc định (1,1) nên nhân vào không ảnh hưởng gì.
        const repeatX = material.map?.repeat.x ?? 1;
        const repeatY = material.map?.repeat.y ?? 1;
        next = sampleCanvasAtUV(canvas, hit.uv.x * repeatX, hit.uv.y * repeatY);
      }
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
      if (hover) {
        useGameStore.getState().setHeldColor(hover);
        sfx.uiClick();
      }
    };

    canvasEl.addEventListener("mousedown", onMouseDown);
    return () => canvasEl.removeEventListener("mousedown", onMouseDown);
  }, [gl]);
}

/** Component rỗng — chỉ để gọi hook bên trong <Canvas>. */
export function InteractionController() {
  useInteraction();
  return null;
}
