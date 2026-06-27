import { useEffect, useMemo } from "react";
import { useTexture, Environment } from "@react-three/drei";
import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import { type PaintableTexture } from "./textures/proceduralTextures";
import { CrateStack, Easel, PlantPot, Steps, BrickWall } from "./MapProps";

/** Bọc 1 THREE.Texture đã load thật thành PaintableTexture (đồng nhất API với texture procedural).
 * `repeat`: dùng cho mặt rộng cần lặp ảnh nhiều lần (sàn 40x40) — nếu không
 * truyền, mặc định (1,1) tức không lặp, giống các khu màu nhỏ khác. */
function useRealTexture(url: string, repeat?: [number, number]): PaintableTexture {
  const texture = useTexture(url);
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    if (repeat) {
      texture.wrapS = THREE.RepeatWrapping;
      texture.wrapT = THREE.RepeatWrapping;
      texture.repeat.set(repeat[0], repeat[1]);
    }
    texture.needsUpdate = true;
  }, [texture, repeat?.[0], repeat?.[1]]);
  // Không có sourceCanvas ngay — getSampleableCanvas (colorSampling.ts) sẽ tự
  // tạo canvas từ texture.image (HTMLImageElement) khi cần, cache lại sau đó.
  return useMemo(() => ({ texture }), [texture]);
}

/**
 * Map "Art Studio" — 7/7 mặt dùng ẢNH THẬT (Giai đoạn 0, xem docs/asset-brief.md):
 * Gỗ, Bê tông, Cây cảnh, Gạch, Vải/Canvas, Thùng sơn loang, Sàn.
 */
export function ArtStudioScene() {
  const wood = useRealTexture("/textures/wood.jpg");
  const concrete = useRealTexture("/textures/concrete.jpg");
  const plant = useRealTexture("/textures/plant.jpg");
  const brick = useRealTexture("/textures/brick.jpg");
  const fabric = useRealTexture("/textures/fabric.jpg");
  const paintSplatter = useRealTexture("/textures/paint_splatter.jpg");
  // Sàn rộng 40x40 — lặp 8x8 lần (mỗi tile ~5 unit) để không bị mờ/loãng
  // như khi trải nguyên 1 ảnh cho cả mặt sàn lớn.
  const floor = useRealTexture("/textures/floor.jpg", [8, 8]);

  return (
    <>
      <Environment preset="warehouse" />
      <ambientLight intensity={0.3} />
      <directionalLight
        position={[8, 12, 6]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <pointLight position={[8, 4, 5]} intensity={25} distance={14} decay={2} />

      {/* Sàn — hút màu được.
          QUAN TRỌNG: dùng box mỏng + collider "cuboid", KHÔNG dùng plane +
          "trimesh" — trimesh nổi tiếng không ổn định khi có vật thể động
          (player) đứng/di chuyển liên tục trên nó (dễ giật/lún/kẹt ở đường
          nối tam giác). Mọi khối màu khác trong scene đều dùng cuboid nên ổn,
          chỉ riêng sàn cũ bị vì dùng trimesh — đã sửa. */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh receiveShadow position={[0, -0.1, 0]} userData={{ pickable: true }}>
          <boxGeometry args={[40, 0.2, 40]} />
          <meshStandardMaterial map={floor.texture} />
        </mesh>
      </RigidBody>

      {/* Khu Gỗ — ảnh thật */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[-8, 0.5, -5]} userData={{ pickable: true }}>
          <boxGeometry args={[5, 1, 5]} />
          <meshStandardMaterial map={wood.texture} />
        </mesh>
      </RigidBody>

      {/* Khu Bê tông — ảnh thật */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[6, 0.5, -3]} userData={{ pickable: true }}>
          <boxGeometry args={[6, 1, 6]} />
          <meshStandardMaterial map={concrete.texture} />
        </mesh>
      </RigidBody>

      {/* Khu Cây cảnh — ảnh thật */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[0, 0.5, 8]} userData={{ pickable: true }}>
          <boxGeometry args={[5, 1, 5]} />
          <meshStandardMaterial map={plant.texture} />
        </mesh>
      </RigidBody>

      {/* Khu Vải/Canvas — ảnh thật */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[-8, 0.5, 6]} userData={{ pickable: true }}>
          <boxGeometry args={[5, 1, 5]} />
          <meshStandardMaterial map={fabric.texture} />
        </mesh>
      </RigidBody>

      {/* Khu Thùng sơn loang — ảnh thật */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[3, 0.5, -9]} userData={{ pickable: true }}>
          <boxGeometry args={[4, 1, 4]} />
          <meshStandardMaterial map={paintSplatter.texture} />
        </mesh>
      </RigidBody>

      {/* Tường gạch — ảnh thật */}
      <BrickWall position={[8, 0, 6]} texture={brick} />

      {/* Vật cản */}
      <CrateStack position={[-3, 0, 1]} texture={wood} />
      <CrateStack position={[2.5, 0, 2.5]} texture={paintSplatter} />
      <Easel position={[2, 0, -1]} canvasTexture={fabric} />
      <PlantPot position={[-5, 0, 2]} scale={1.1} />
      <PlantPot position={[4.5, 0, 4]} scale={0.7} />
      <PlantPot position={[-1, 0, -4]} scale={1.3} />

      {/* Bậc thang lên platform nhỏ */}
      <Steps position={[8, 0, 3]} />
    </>
  );
}

useTexture.preload("/textures/wood.jpg");
useTexture.preload("/textures/concrete.jpg");
useTexture.preload("/textures/plant.jpg");
useTexture.preload("/textures/brick.jpg");
useTexture.preload("/textures/fabric.jpg");
useTexture.preload("/textures/paint_splatter.jpg");
useTexture.preload("/textures/floor.jpg");
