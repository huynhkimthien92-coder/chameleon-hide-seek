import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../store/useGameStore";
import { sampleCanvasAtUV, getSampleableCanvas } from "./colorSampling";
import { sendShoot, sendPaintStroke } from "../net/colyseus";
import { paintDab, type BodyPart } from "./paintRegistry";
import { sfx } from "../audio/sounds";

const PICK_RANGE = 6; // mét — tầm hút màu tối đa (đo từ NHÂN VẬT, không phải camera)
const AIM_RANGE = 30; // mét — tầm ngắm bắn, khớp MAX_SHOOT_RANGE phía server
const BRUSH_RADIUS = 0.05; // bán kính nét cọ, đơn vị UV (0..1)
const PAINT_INTERVAL_MS = 50; // throttle vẽ — ~20 nét/giây, đủ mượt không spam mạng

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
 * Raycast liên tục. BÌNH THƯỜNG (không vẽ): từ giữa màn hình (crosshair,
 * pointer-lock kiểu FPS) — hút màu môi trường (Hider) hoặc ngắm bắn (Seeker).
 *
 * CHẾ ĐỘ VẼ (isPainting=true, bấm nút "Cọ vẽ"): nhân vật + camera đứng yên
 * hẳn (xem Player.tsx), pointer-lock được nhả ra, raycast theo ĐÚNG VỊ TRÍ
 * CON TRỎ CHUỘT THẬT trên màn hình (không tích lũy delta) — vẽ trực tiếp lên
 * người NGAY TRONG THẾ GIỚI GAME, giữ nguyên map/môi trường xung quanh trong
 * tầm nhìn để so màu cho khớp — đây là điểm khác biệt cốt lõi so với cách
 * "khung 3D riêng" đã bỏ (xem README).
 */
export function useInteraction() {
  const { camera, scene, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const lastHover = useRef<string | null>(null);
  const isMouseDown = useRef(false);
  const wasAimingOwnBody = useRef(false);
  const lastPaintAt = useRef(0);
  const cursorPx = useRef({ x: 0, y: 0 }); // vị trí con trỏ chuột THẬT (px), chỉ có ý nghĩa khi isPainting

  const setHoverColor = useGameStore((s) => s.setHoverColor);
  const setAimTarget = useGameStore((s) => s.setAimTarget);
  const setIsAimingOwnBody = useGameStore((s) => s.setIsAimingOwnBody);

  const isPaintingState = useGameStore((s) => s.isPainting);
  useEffect(() => {
    gl.domElement.style.cursor = isPaintingState ? "crosshair" : "auto";
  }, [isPaintingState, gl]);

  useFrame(() => {
    const team = useGameStore.getState().team;
    const mySessionId = useGameStore.getState().sessionId;
    const isPainting = useGameStore.getState().isPainting;

    let ndcX = 0;
    let ndcY = 0;
    if (isPainting) {
      const rect = gl.domElement.getBoundingClientRect();
      ndcX = ((cursorPx.current.x - rect.left) / rect.width) * 2 - 1;
      ndcY = -(((cursorPx.current.y - rect.top) / rect.height) * 2 - 1);
    }
    raycaster.current.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
    const hits = raycaster.current.intersectObjects(scene.children, true);
    const playerPos = useGameStore.getState().localPosition;
    const playerVec = new THREE.Vector3(playerPos.x, playerPos.y, playerPos.z);

    // --- Chế độ vẽ: chỉ tìm body của chính mình, không làm gì khác ---
    if (isPainting) {
      const ownBodyHit = hits.find(
        (h) => h.object.userData?.isBodyPart && h.object.userData?.ownerSessionId === mySessionId && h.uv
      );

      if (ownBodyHit?.uv) {
        if (!wasAimingOwnBody.current) {
          wasAimingOwnBody.current = true;
          setIsAimingOwnBody(true);
          gl.domElement.style.cursor = "pointer";
        }
        if (isMouseDown.current) {
          const heldColor = useGameStore.getState().heldColor;
          const now = performance.now();
          if (heldColor && now - lastPaintAt.current >= PAINT_INTERVAL_MS) {
            lastPaintAt.current = now;
            const part = ownBodyHit.object.userData.bodyPart as BodyPart;
            paintDab(mySessionId ?? "local-pending", part, ownBodyHit.uv.x, ownBodyHit.uv.y, heldColor, BRUSH_RADIUS);
            sendPaintStroke(part, ownBodyHit.uv.x, ownBodyHit.uv.y, heldColor, BRUSH_RADIUS);
          }
        }
      } else if (wasAimingOwnBody.current) {
        wasAimingOwnBody.current = false;
        setIsAimingOwnBody(false);
        gl.domElement.style.cursor = "crosshair";
      }
      return;
    }

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

    const onMouseMoveTrack = (e: MouseEvent) => {
      cursorPx.current = { x: e.clientX, y: e.clientY };
    };

    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return; // chuột trái

      const isPainting = useGameStore.getState().isPainting;
      if (isPainting) {
        isMouseDown.current = true;
        return;
      }

      if (document.pointerLockElement !== canvasEl) return; // click đầu để lock, bỏ qua

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

    const onMouseUp = (e: MouseEvent) => {
      if (e.button !== 0) return;
      isMouseDown.current = false;
    };

    canvasEl.addEventListener("mousemove", onMouseMoveTrack);
    canvasEl.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      canvasEl.removeEventListener("mousemove", onMouseMoveTrack);
      canvasEl.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [gl]);
}

/** Component rỗng — chỉ để gọi hook bên trong <Canvas>. */
export function InteractionController() {
  useInteraction();
  return null;
}
