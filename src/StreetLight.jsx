const POLE_H = 4.2
const POLE_R = 0.045

export default function StreetLight({ position = [0, 0, 0] }) {
  return (
    <group position={position}>

      {/* Pole — thin tapered cylinder */}
      <mesh position={[0, POLE_H / 2, 0]} castShadow>
        <cylinderGeometry args={[POLE_R * 0.7, POLE_R * 1.3, POLE_H, 6]} />
        <meshStandardMaterial color="#252530" roughness={0.7} metalness={0.5} />
      </mesh>

      {/* Arm — short angled bracket */}
      <mesh position={[0.24, POLE_H - 0.04, 0]} rotation={[0, 0, -Math.PI / 10]} castShadow>
        <cylinderGeometry args={[POLE_R * 0.55, POLE_R * 0.55, 0.55, 6]} />
        <meshStandardMaterial color="#252530" roughness={0.7} metalness={0.5} />
      </mesh>

      {/* Lamp housing — flat disc, warm golden-orange */}
      <mesh position={[0.45, POLE_H + 0.01, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.06, 8]} />
        <meshStandardMaterial
          color="#ffaa30"
          emissive="#ffaa30"
          emissiveIntensity={2.0}
          roughness={0.3}
          metalness={0.2}
        />
      </mesh>

    </group>
  )
}
