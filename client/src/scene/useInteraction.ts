import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../store/useGameStore";
import { sampleCanvasAtUV, getSampleableCanvas } from "./colorSampling";
import { sendShoot, sendPaintStroke } from "../net/colyseus";
import { paintDab } from "./paintRegistry";
import { sfx } from "../audio/sounds";

const PICK_RANGE = 6; // mét — tầm hút màu tối đa (đo từ NHÂN VẬT, không phải camera)
const AIM_RANGE = 30; // mét — tầm ngắm bắn, khớp MAX_SHOOT_RANGE phía server
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
 * Raycast liên tục.
 *
 * BÌNH THƯỜNG (isPainting=false): từ giữa màn hình (crosshair, pointer-lock
 * kiểu FPS) — chỉ dùng để Seeker ngắm bắn. Hider không hút màu được ở đây
 * nữa (xem lý do dưới).
 *
 * CHẾ ĐỘ TÔ MÀU (isPainting=true, bấm nút "Tô màu"): nhân vật + camera đứng
 * yên hẳn (xem Player.tsx), pointer-lock nhả ra, raycast theo ĐÚNG VỊ TRÍ
 * CON TRỎ CHUỘT THẬT — GỘP CHUNG cả hút màu (nhắm vào môi trường) VÀ vẽ
 * (nhắm vào người mình) trong CÙNG 1 chế độ đứng yên này. Lý do gộp: trước
 * đây hút màu vẫn dùng camera xoay-để-ngắm như lúc đi lại bình thường —
 * người dùng phản hồi đúng: xoay camera để ngắm tường làm mất tương quan
 * "người mình đang ở đâu so với tường đó", rất khó so màu cho khớp. Gộp cả
 * 2 việc vào chung chế độ đứng yên thì người chơi canh góc 1 lần (thấy cả
 * người mình + tường cạnh đó), rồi hút màu + tô đều dùng đúng góc đó, không
 * còn phải xoay qua xoay lại giữa 2 bước.
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

    // [DEBUG TẠM] khi đang tô màu, ghi lại TOÀN BỘ hits thật mỗi ~150ms vào
    // window.__paintDebug — để xem CHÍNH XÁC tại sao 1 điểm không tô được:
    // không có hit nào (ray hụt hẳn), có hit nhưng không phải mesh người
    // mình (vật khác chắn trước), hay có hit đúng mesh nhưng thiếu uv.
    if (isPainting) {
      const now = performance.now();
      const w = window as unknown as { __paintDebugLast?: number };
      if (!w.__paintDebugLast || now - w.__paintDebugLast > 150) {
        w.__paintDebugLast = now;
        (window as unknown as Record<string, unknown>).__paintDebug = {
          ndcX: +ndcX.toFixed(3),
          ndcY: +ndcY.toFixed(3),
          totalHits: hits.length,
          hits: hits.slice(0, 8).map((h) => ({
            objectType: h.object.type,
            objectName: h.object.name || "(no name)",
            isOwnBody: !!h.object.userData?.isOwnBody,
            ownerSessionId: h.object.userData?.ownerSessionId ?? null,
            hasUV: !!h.uv,
            distance: +h.distance.toFixed(3),
          })),
        };
      }
    }

    // --- Chế độ tô màu: GỘP hút màu (môi trường) + vẽ (người mình) ---
    if (isPainting) {
      const ownBodyHit = hits.find(
        (h) => h.object.userData?.isOwnBody && h.object.userData?.ownerSessionId === mySessionId && h.uv
      );

      if (ownBodyHit?.uv) {
        // Đang nhắm vào người mình -> sẵn sàng vẽ, không hover môi trường nữa.
        if (!wasAimingOwnBody.current) {
          wasAimingOwnBody.current = true;
          setIsAimingOwnBody(true);
          gl.domElement.style.cursor = "pointer";
        }
        if (lastHover.current !== null) {
          lastHover.current = null;
          setHoverColor(null);
        }
        if (isMouseDown.current) {
          const heldColor = useGameStore.getState().heldColor;
          const brushSize = useGameStore.getState().brushSize;
          const now = performance.now();
          if (heldColor && now - lastPaintAt.current >= PAINT_INTERVAL_MS) {
            lastPaintAt.current = now;
            paintDab(mySessionId ?? "local-pending", ownBodyHit.uv.x, ownBodyHit.uv.y, heldColor, brushSize);
            sendPaintStroke(ownBodyHit.uv.x, ownBodyHit.uv.y, heldColor, brushSize);
          }
        }
        return;
      }

      if (wasAimingOwnBody.current) {
        wasAimingOwnBody.current = false;
        setIsAimingOwnBody(false);
        gl.domElement.style.cursor = "crosshair";
      }

      // Không nhắm vào người mình -> thử hút màu môi trường (vẫn cùng con
      // trỏ chuột thật, cùng camera đứng yên — không cần thoát chế độ).
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
      return;
    }

    // --- Ngoài chế độ tô màu: chỉ còn Seeker ngắm bắn ---
    if (team === "seeker") {
      const hit = hits.find((h) => findPlayerSessionId(h.object));
      const distanceFromPlayer = hit ? hit.point.distanceTo(playerVec) : Infinity;
      const inRange = distanceFromPlayer <= AIM_RANGE;
      const sessionId = hit && inRange ? findPlayerSessionId(hit.object) : null;
      const remote = sessionId ? useGameStore.getState().remotePlayers[sessionId] : null;
      const valid = !!remote && remote.team === "hider" && !remote.eliminated;
      setAimTarget(sessionId, valid);
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
        // Đang nhắm vào người mình -> bắt đầu vẽ (useFrame xử lý liên tục).
        // Đang nhắm vào môi trường -> hút màu ngay (one-shot), không cần
        // thoát chế độ — đúng yêu cầu gộp chung.
        if (wasAimingOwnBody.current) {
          isMouseDown.current = true;
        } else {
          const hover = useGameStore.getState().hoverColor;
          if (hover) {
            useGameStore.getState().setHeldColor(hover);
            sfx.uiClick();
          }
        }
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
