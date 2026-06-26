import { RigidBody } from "@react-three/rapier";
import type { PaintableTexture } from "./textures/proceduralTextures";

/** Chồng 2-3 thùng gỗ — vừa che tầm nhìn, vừa là chỗ Hider tựa/núp (vision.md pose "lean"/"crouch") */
export function CrateStack({
  position,
  texture,
}: {
  position: [number, number, number];
  texture: PaintableTexture;
}) {
  const [x, y, z] = position;
  return (
    <>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[x, y + 0.4, z]} userData={{ pickable: true }}>
          <boxGeometry args={[0.8, 0.8, 0.8]} />
          <meshStandardMaterial map={texture.texture} />
        </mesh>
      </RigidBody>
      <RigidBody type="fixed" colliders="cuboid">
        <mesh
          castShadow
          receiveShadow
          position={[x + 0.15, y + 1.15, z - 0.1]}
          rotation={[0, 0.3, 0]}
          userData={{ pickable: true }}
        >
          <boxGeometry args={[0.7, 0.7, 0.7]} />
          <meshStandardMaterial map={texture.texture} />
        </mesh>
      </RigidBody>
    </>
  );
}

/** Giá vẽ — chân đứng mỏng + khung canvas hơi nghiêng, chỗ núp mỏng cho pose "lean" */
export function Easel({
  position,
  canvasTexture,
}: {
  position: [number, number, number];
  canvasTexture: PaintableTexture;
}) {
  const [x, y, z] = position;
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <group position={[x, y, z]}>
        {/* Khung canvas — bề mặt hút màu chính */}
        <mesh castShadow receiveShadow position={[0, 0.9, 0]} rotation={[-0.1, 0, 0]} userData={{ pickable: true }}>
          <boxGeometry args={[0.7, 0.9, 0.06]} />
          <meshStandardMaterial map={canvasTexture.texture} />
        </mesh>
        {/* Chân giá 3 cây gỗ mỏng */}
        <mesh castShadow position={[-0.25, 0.45, 0.25]} rotation={[0, 0, 0.15]}>
          <cylinderGeometry args={[0.025, 0.025, 0.9, 6]} />
          <meshStandardMaterial color="#6b4f33" />
        </mesh>
        <mesh castShadow position={[0.25, 0.45, 0.25]} rotation={[0, 0, -0.15]}>
          <cylinderGeometry args={[0.025, 0.025, 0.9, 6]} />
          <meshStandardMaterial color="#6b4f33" />
        </mesh>
      </group>
    </RigidBody>
  );
}

/** Chậu cây — cao thấp khác nhau để tạo điểm núp đa dạng, không cần pickable (không phải bề mặt camo chính) */
export function PlantPot({
  position,
  scale = 1,
}: {
  position: [number, number, number];
  scale?: number;
}) {
  const [x, y, z] = position;
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <group position={[x, y, z]} scale={scale}>
        <mesh castShadow receiveShadow position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.3, 0.22, 0.5, 12]} />
          <meshStandardMaterial color="#a9764f" />
        </mesh>
        <mesh castShadow position={[0, 0.75, 0]}>
          <sphereGeometry args={[0.42, 10, 10]} />
          <meshStandardMaterial color="#3f6b2c" />
        </mesh>
      </group>
    </RigidBody>
  );
}

/** Bậc thang lên 1 platform nhỏ — thêm độ cao để Seeker phải nhìn lên/xuống (map-variety-notes.md mục 3) */
export function Steps({ position }: { position: [number, number, number] }) {
  const [x, y, z] = position;
  const stepHeight = 0.22;
  return (
    <>
      {[0, 1, 2].map((i) => (
        <RigidBody key={i} type="fixed" colliders="cuboid">
          <mesh
            castShadow
            receiveShadow
            position={[x, y + stepHeight * (i + 0.5), z - i * 0.5]}
          >
            <boxGeometry args={[1.4, stepHeight * (i + 1), 0.5]} />
            <meshStandardMaterial color="#9a9a9a" />
          </mesh>
        </RigidBody>
      ))}
      {/* Platform nhỏ trên cùng — đứng được, nhìn được toàn cảnh */}
      <RigidBody type="fixed" colliders="cuboid">
        <mesh castShadow receiveShadow position={[x, y + stepHeight * 3, z - 1.6]}>
          <boxGeometry args={[1.8, stepHeight, 1.6]} />
          <meshStandardMaterial color="#9a9a9a" />
        </mesh>
      </RigidBody>
    </>
  );
}

/** Tường gạch — vừa là khu màu pickable, vừa là vật cản cao chắn tầm nhìn thật (không phải box thấp) */
export function BrickWall({
  position,
  texture,
}: {
  position: [number, number, number];
  texture: PaintableTexture;
}) {
  const [x, y, z] = position;
  return (
    <RigidBody type="fixed" colliders="cuboid">
      <mesh castShadow receiveShadow position={[x, y + 1.5, z]} userData={{ pickable: true }}>
        <boxGeometry args={[6, 3, 0.5]} />
        <meshStandardMaterial map={texture.texture} />
      </mesh>
    </RigidBody>
  );
}
