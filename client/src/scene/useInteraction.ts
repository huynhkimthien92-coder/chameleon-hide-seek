import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGameStore } from "../store/useGameStore";
import { sampleCanvasAtUV, getSampleableCanvas } from "./colorSampling";
import { sendShoot, sendPaintStroke } from "../net/colyseus";
import { paintDab3D, interpolateBindPosition } from "./paint3dClient";
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

// Object tạm dùng lại giữa các lần gọi (tránh tạo mới mỗi frame, đỡ GC) —
// CHỈ dùng trong manualRaycastOwnBody, không thread-safe nhưng code chạy
// đơn luồng trong useFrame nên an toàn.
const _invMatrix = new THREE.Matrix4();
const _localRay = new THREE.Ray();
const _vA = new THREE.Vector3();
const _vB = new THREE.Vector3();
const _vC = new THREE.Vector3();
const _intersectPoint = new THREE.Vector3();
const _bestPointLocal = new THREE.Vector3();
const _uvA = new THREE.Vector2();
const _uvB = new THREE.Vector2();
const _uvC = new THREE.Vector2();
const _bestUV = new THREE.Vector2();
const _bestBind = new THREE.Vector3();

// index 3 đỉnh của tam giác trúng gần nhất
let _bestTriA = -1;
let _bestTriB = -1;
let _bestTriC = -1;

/**
 * ⚠️ RAYCAST THỦ CÔNG riêng cho mesh người mình — KHÔNG dùng
 * `raycaster.intersectObject()` built-in của Three.js cho mesh này nữa.
 *
 * Lý do: `Mesh.raycast()` built-in của Three.js (qua GLTFLoader nạp model
 * nén Draco) trả về 0 hit một cách KHÔNG ỔN ĐỊNH cho riêng SkinnedMesh này
 * — đã verify kỹ bằng số liệu thật suốt nhiều vòng debug (camera/ray tính
 * tay xác nhận tia đi xuyên qua rất gần tâm bounding sphere của mesh, có
 * lúc cách tâm chỉ ~0.24-0.26 unit trong khi bán kính bao là ~1.05 — chắc
 * chắn phải trúng về hình học — nhưng `intersectObject()` vẫn trả 0 hit).
 * Đã loại trừ hết: geometry/skin data hợp lệ (khớp byte-for-byte với dữ
 * liệu gốc), material.side=DoubleSide đúng, layers khớp, bounding sphere
 * đúng, world matrix hợp lệ — và quan trọng nhất: gọi trực tiếp
 * `getVertexPosition()` (hàm LÕI mà raycast dùng để lấy vị trí vertex sau
 * skinning) cho ra toạ độ HOÀN TOÀN HỢP LÝ. Tức là dữ liệu/hàm tính vị trí
 * đều đúng — chỉ riêng logic raycast() cấp cao (tổ hợp DoubleSide + skinning
 * + version Three.js này) có vấn đề, không rõ nguyên nhân sâu hơn (nghi
 * liên quan đến cách Three.js xử lý bounding box/early-rejection cho
 * SkinnedMesh nén Draco qua GLTFLoader — không tái hiện được trong môi
 * trường Node để đào sâu hơn vì DRACOLoader cần Web Worker thật).
 *
 * Hàm này tự lặp qua TỪNG TAM GIÁC, dùng `mesh.getVertexPosition()` (đã
 * verify đúng) lấy vị trí 3 đỉnh SAU skinning, rồi tự test giao cắt tia
 * bằng `THREE.Ray.intersectTriangle()` (cùng hàm lõi mà Three.js dùng bên
 * trong, chỉ là gọi trực tiếp, không qua lớp bounding-sphere/early-reject
 * nghi có bug) — bỏ qua hoàn toàn `Mesh.raycast()`. Chi phí: ~4000 tam
 * giác/lần gọi, ~1ms/frame — chấp nhận được cho riêng lúc đang tô màu.
 */
function manualRaycastOwnBody(
  mesh: THREE.SkinnedMesh,
  ray: THREE.Ray
): {distance: number; uv: THREE.Vector2; point: THREE.Vector3; bindPoint: THREE.Vector3;} | null {
  const geometry = mesh.geometry;
  const index = geometry.index;
  const uvAttr = geometry.attributes.uv;
  if (!index || !uvAttr) return null;

  _invMatrix.copy(mesh.matrixWorld).invert();
  _localRay.copy(ray).applyMatrix4(_invMatrix);

  let closestDistSq = Infinity;
  _bestTriA = _bestTriB = _bestTriC = -1;
  let found = false;

  const idxArr = index.array;
  for (let i = 0; i < idxArr.length; i += 3) {
    const a = idxArr[i];
    const b = idxArr[i + 1];
    const c = idxArr[i + 2];
    mesh.getVertexPosition(a, _vA);
    mesh.getVertexPosition(b, _vB);
    mesh.getVertexPosition(c, _vC);

    const hit = _localRay.intersectTriangle(_vA, _vB, _vC, false, _intersectPoint);
    if (!hit) continue;

    const distSq = _localRay.origin.distanceToSquared(_intersectPoint);
    if (distSq < closestDistSq) {
      closestDistSq = distSq;
      found = true;

      _bestPointLocal.copy(_intersectPoint);

      _bestTriA = a;
      _bestTriB = b;
      _bestTriC = c;

      _uvA.fromBufferAttribute(uvAttr as THREE.BufferAttribute, a);
      _uvB.fromBufferAttribute(uvAttr as THREE.BufferAttribute, b);
      _uvC.fromBufferAttribute(uvAttr as THREE.BufferAttribute, c);

      THREE.Triangle.getInterpolation(
        _intersectPoint,
        _vA,
        _vB,
        _vC,
        _uvA,
        _uvB,
        _uvC,
        _bestUV
      );
    }
  }

  if (!found) return null;
  
  // Lấy lại 3 đỉnh của tam giác tốt nhất
  mesh.getVertexPosition(_bestTriA, _vA);
  mesh.getVertexPosition(_bestTriB, _vB);
  mesh.getVertexPosition(_bestTriC, _vC);
  
  // Nội suy vị trí bind-pose
  interpolateBindPosition(
    geometry,
    _bestTriA,
    _bestTriB,
    _bestTriC,
    _vA,
    _vB,
    _vC,
    _bestPointLocal,
    _bestBind
  );
  const worldPoint = _bestPointLocal.clone().applyMatrix4(mesh.matrixWorld);
  const distance = ray.origin.distanceTo(worldPoint);
  return { distance, uv: _bestUV.clone(), point: worldPoint, bindPoint: _bestBind.clone()};
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
 *
 * Vẽ lên NGƯỜI MÌNH dùng `manualRaycastOwnBody()` riêng (xem comment ở hàm
 * đó) — KHÔNG nằm trong mảng `hits` chung. Hút màu MÔI TRƯỜNG vẫn dùng
 * `hits` chung như cũ (raycast built-in hoạt động bình thường cho các mesh
 * tĩnh của map, chỉ riêng SkinnedMesh người mới gặp vấn đề).
 */
export function useInteraction() {
  const { camera, scene, gl } = useThree();
  const raycaster = useRef(new THREE.Raycaster());
  const lastHover = useRef<string | null>(null);
  const isMouseDown = useRef(false);
  const wasAimingOwnBody = useRef(false);
  const lastPaintAt = useRef(0);
  const cursorPx = useRef({ x: 0, y: 0 }); // vị trí con trỏ chuột THẬT (px), chỉ có ý nghĩa khi isPainting
  const ownMeshRef = useRef<THREE.SkinnedMesh | null>(null);

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

    // --- Chế độ tô màu: GỘP hút màu (môi trường) + vẽ (người mình) ---
    if (isPainting) {
      // Tìm lại mesh người mình nếu chưa có hoặc sessionId đổi (reconnect).
      // Không tìm lại mỗi frame nếu đã có sẵn — đỡ traverse cả scene liên tục.
      if (!ownMeshRef.current || ownMeshRef.current.userData?.ownerSessionId !== mySessionId) {
        let found: THREE.SkinnedMesh | null = null;
        scene.traverse((o) => {
          if (
            !found &&
            (o as THREE.SkinnedMesh).isSkinnedMesh &&
            o.userData?.isOwnBody &&
            o.userData?.ownerSessionId === mySessionId
          ) {
            found = o as THREE.SkinnedMesh;
          }
        });
        ownMeshRef.current = found;
      }

      const ownBodyHit = ownMeshRef.current
        ? manualRaycastOwnBody(ownMeshRef.current, raycaster.current.ray)
        : null;

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

            const bp = ownBodyHit.bindPoint;
            paintDab3D(mySessionId ?? "local-pending",bp,heldColor,brushSize);
            sendPaintStroke(bp.x,bp.y,bp.z,heldColor,brushSize);
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
