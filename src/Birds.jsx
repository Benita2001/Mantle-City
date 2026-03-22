import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'

// One bird: two offset wing meshes forming a V when viewed head-on
function BirdShape() {
  return (
    <group>
      {/* Left wing — outer tip tilts up */}
      <mesh position={[-0.72, 0, 0]} rotation={[0.18, 0, -Math.PI / 7]}>
        <boxGeometry args={[1.44, 0.055, 0.26]} />
        <meshStandardMaterial color="#1a2a3a" roughness={0.9} metalness={0} />
      </mesh>
      {/* Right wing — outer tip tilts up */}
      <mesh position={[0.72, 0, 0]} rotation={[0.18, 0, Math.PI / 7]}>
        <boxGeometry args={[1.44, 0.055, 0.26]} />
        <meshStandardMaterial color="#1a2a3a" roughness={0.9} metalness={0} />
      </mesh>
    </group>
  )
}

const COUNT     = 10
const ORBIT_R   = 145   // base orbit radius around city centre
const ALTITUDE  = 74
const SPEED     = 0.095 // rad/s (about 66s per lap — leisurely)

// Fast deterministic pseudo-random (no import needed)
function rnd(n) { return (Math.sin(n * 127.1 + 311.7) * 0.5 + 0.5) }

export default function Birds({ cx = 84, cz = 90 }) {
  const birds = useMemo(() => (
    Array.from({ length: COUNT }, (_, i) => ({
      startAngle: (i / COUNT) * Math.PI * 2,
      radiusMult: 0.82 + rnd(i * 3)  * 0.36,   // spread the formation a little
      yOffset:    (rnd(i * 7) - 0.5) * 16,
      speedMult:  0.88 + rnd(i * 11) * 0.24,
      bobPhase:   rnd(i * 5) * Math.PI * 2,
    }))
  ), [])

  const refs = useRef([])

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    birds.forEach((b, i) => {
      const g = refs.current[i]
      if (!g) return
      const angle = b.startAngle + t * SPEED * b.speedMult
      const r     = ORBIT_R * b.radiusMult
      g.position.x = cx + Math.cos(angle) * r
      g.position.y = ALTITUDE + b.yOffset + Math.sin(t * 1.9 + b.bobPhase) * 1.3
      g.position.z = cz + Math.sin(angle) * r
      // Face tangent of the circle (direction of travel)
      g.rotation.y = -angle - Math.PI / 2
    })
  })

  return (
    <>
      {birds.map((_, i) => (
        <group key={i} ref={el => refs.current[i] = el}>
          <BirdShape />
        </group>
      ))}
    </>
  )
}
