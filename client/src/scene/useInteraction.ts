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
const BRUSH_RADIUS = 0.06; // bán kính nét cọ, đơn vị UV (0..1)
const PAINT_INTERVAL_MS = 60; // throttle vẽ — ~16 nét/giây, đủ mượt mà không spam mạng

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
 * Raycast liên tục từ giữa màn hình (crosshair). Với Hider, mỗi frame kiểm
 * tra theo thứ tự ưu tiên:
 *   1. Đang nhắm vào ĐÚNG NGƯỜI MÌNH (userData.isBodyPart + ownerSessionId
 *      khớp sessionId của mình) -> chế độ VẼ. Giữ chuột trái + đang "cầm"
 *      màu -> vẽ liên tục (paintDab cục bộ + gửi server, throttle).
 *   2. Ngược lại -> chế độ HÚT MÀU từ môi trường như cũ (hover preview,
 *      click để "cầm" màu — không còn bước chọn bộ phận/Áp dụng nữa, người
 *      chơi tự chọn vị trí bằng cách nhắm trực tiếp ở bước 1).
 *
 * Seeker: ngắm người chơi khác để bắn (không đổi so với trước, chỉ sửa bug
 * đo khoảng cách từ camera -> đổi sang đo từ nhân vật).
 */
export function useInteraction() {
  const { camera, scene, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const lastHover = useRef<string | null>(null);
  const isMouseDown = useRef(false);
  const aimingOwnBody = useRef<{ part: BodyPart; u: number; v: number } | null>(null);
  const wasAimingOwnBody = useRef(false);
  const lastPaintAt = useRef(0);

  const setHoverColor = useGameStore((s) => s.setHoverColor);
  const setAimTarget = useGameStore((s) => s.setAimTarget);
  const setIsAimingOwnBody = useGameStore((s) => s.setIsAimingOwnBody);

  useFrame(() => {
    const team = useGameStore.getState().team;
    const mySessionId = useGameStore.getState().sessionId;
    const isPaintDragging = useGameStore.getState().isPaintDragging;
    const reticleOffset = useGameStore.getState().reticleOffset;

    // Đang kéo vẽ: dùng vị trí con trỏ tự do (reticle), không phải giữa màn
    // hình — camera đứng yên lúc này (xem Player.tsx onMouseMove).
    const ndcX = isPaintDragging ? reticleOffset.x : 0;
    const ndcY = isPaintDragging ? reticleOffset.y : 0;
    raycaster.current.setFromCamera(new THREE.Vector2(ndcX, ndcY), camera);
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

    // --- Hider: ưu tiên 1 — đang nhắm vào người mình? ---
    const ownBodyHit = hits.find(
      (h) => h.object.userData?.isBodyPart && h.object.userData?.ownerSessionId === mySessionId && h.uv
    );

    if (ownBodyHit?.uv) {
      aimingOwnBody.current = {
        part: ownBodyHit.object.userData.bodyPart as BodyPart,
        u: ownBodyHit.uv.x,
        v: ownBodyHit.uv.y,
      };
      if (!wasAimingOwnBody.current) {
        wasAimingOwnBody.current = true;
        setIsAimingOwnBody(true);
      }
      if (lastHover.current !== null) {
        lastHover.current = null;
        setHoverColor(null); // không còn hover môi trường khi đang nhắm vào người mình
      }

      if (isMouseDown.current) {
        const heldColor = useGameStore.getState().heldColor;
        const now = performance.now();
        if (heldColor && now - lastPaintAt.current >= PAINT_INTERVAL_MS) {
          lastPaintAt.current = now;
          const { part, u, v } = aimingOwnBody.current;
          paintDab(mySessionId ?? "local-pending", part, u, v, heldColor, BRUSH_RADIUS); // optimistic
          sendPaintStroke(part, u, v, heldColor, BRUSH_RADIUS); // đồng bộ cho người khác
        }
      }
      return;
    }

    aimingOwnBody.current = null;
    if (wasAimingOwnBody.current) {
      wasAimingOwnBody.current = false;
      setIsAimingOwnBody(false);
    }

    if (isPaintDragging) return; // đang kéo vẽ, lệch khỏi người mình -> tạm dừng, không cần hover môi trường

    // --- Ưu tiên 2: hút màu môi trường (như Giai đoạn 2) ---
    const hit = hits.find((h) => h.object.userData?.pickable && h.uv);
    const distanceFromPlayer = hit ? hit.point.distanceTo(playerVec) : Infinity;
    let next: string | null = null;
    if (hit?.uv && distanceFromPlayer <= PICK_RANGE) {
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

      isMouseDown.current = true;

      // Đang nhắm vào người mình -> bắt đầu 1 nét vẽ: chuyển sang chế độ
      // con trỏ tự do (reticle), camera đứng yên cho tới khi thả chuột.
      if (aimingOwnBody.current) {
        useGameStore.getState().setIsPaintDragging(true);
        useGameStore.getState().setReticleOffset({ x: 0, y: 0 });
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
      if (useGameStore.getState().isPaintDragging) {
        useGameStore.getState().setIsPaintDragging(false);
        useGameStore.getState().setReticleOffset({ x: 0, y: 0 }); // về giữa cho lần ngắm tiếp theo
      }
    };

    canvasEl.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
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
