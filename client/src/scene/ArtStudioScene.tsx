import { useEffect, useMemo } from "react";
import { useTexture, Environment } from "@react-three/drei";
import { RigidBody } from "@react-three/rapier";
import * as THREE from "three";
import {
  createFloorTexture,
  type PaintableTexture,
} from "./textures/proceduralTextures";
import { CrateStack, Easel, PlantPot, Steps, BrickWall } from "./MapProps";

/** Bọc 1 THREE.Texture đã load thật thành PaintableTexture (đồng nhất API với texture procedural). */
function useRealTexture(url: string): PaintableTexture {
  const texture = useTexture(url);
  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
  }, [texture]);
  // Không có sourceCanvas ngay — getSampleableCanvas (colorSampling.ts) sẽ tự
  // tạo canvas từ texture.image (HTMLImageElement) khi cần, cache lại sau đó.
  return useMemo(() => ({ texture }), [texture]);
}

/**
 * Map "Art Studio" — 6/6 khu dùng ẢNH THẬT (Giai đoạn 0, xem docs/asset-brief.md):
 * Gỗ, Bê tông, Cây cảnh, Gạch, Vải/Canvas, Thùng sơn loang. Chỉ còn Sàn vẫn
 * dùng texture canvas tự sinh (Giai đoạn 2) — chưa có ảnh sàn riêng phù hợp.
 */
export function ArtStudioScene() {
  const wood = useRealTexture("/textures/wood.jpg");
  const concrete = useRealTexture("/textures/concrete.jpg");
  const plant = useRealTexture("/textures/plant.jpg");
  const brick = useRealTexture("/textures/brick.jpg");
  const fabric = useRealTexture("/textures/fabric.jpg");
  const paintSplatter = useRealTexture("/textures/paint_splatter.jpg");

  const floor = useMemo(() => createFloorTexture(), []);

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

      {/* Sàn — hút màu được */}
      <RigidBody type="fixed" colliders="trimesh">
        <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]} userData={{ pickable: true }}>
          <planeGeometry args={[40, 40]} />
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
