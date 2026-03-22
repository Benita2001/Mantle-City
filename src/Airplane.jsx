import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// Shared materials (created once, not per-render)
const bodyMat  = new THREE.MeshStandardMaterial({ color: '#999999', roughness: 0.4, metalness: 0.7 })
// fog:false so lights remain visible through the night haze at distance
const whiteMat = new THREE.MeshBasicMaterial({ color: '#ffffff', fog: false })
const redMat   = new THREE.MeshBasicMaterial({ color: '#ff2222', fog: false })

const ALTITUDE = 140
const ORBIT_R  = 340   // large radius so path looks nearly straight
const SPEED    = 0.045 // rad/s — very slow crossing (~140s per orbit)

export default function Airplane({ cx = 84, cz = 90 }) {
  const groupRef  = useRef()
  const wLightRef = useRef()   // white strobe (nose)
  const rLightRef = useRef()   // red beacon   (belly)

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime()
    if (!groupRef.current) return

    const angle = t * SPEED
    groupRef.current.position.set(
      cx + Math.cos(angle) * ORBIT_R,
      ALTITUDE,
      cz + Math.sin(angle) * ORBIT_R,
    )
    // Nose points in the direction of travel (tangent of circle)
    groupRef.current.rotation.y = -angle - Math.PI / 2

    // White strobe: brief flash at ~1.5 Hz
    if (wLightRef.current)
      wLightRef.current.visible = (t * 1.5) % 1 < 0.12
    // Red anti-collision beacon: slower pulse ~0.9 Hz
    if (rLightRef.current)
      rLightRef.current.visible = (t * 0.9) % 1 < 0.45
  })

  return (
    <group ref={groupRef}>
      {/* Fuselage */}
      <mesh material={bodyMat}>
        <boxGeometry args={[1.0, 1.0, 9]} />
      </mesh>
      {/* Main wings */}
      <mesh material={bodyMat} position={[0, -0.2, 0.5]}>
        <boxGeometry args={[18, 0.38, 2.6]} />
      </mesh>
      {/* Horizontal tail */}
      <mesh material={bodyMat} position={[0, 0, -4]}>
        <boxGeometry args={[7, 0.30, 1.5]} />
      </mesh>
      {/* Vertical tail fin */}
      <mesh material={bodyMat} position={[0, 1.3, -4]}>
        <boxGeometry args={[0.32, 2.4, 1.6]} />
      </mesh>
      {/* White strobe — nose tip */}
      <mesh ref={wLightRef} material={whiteMat} position={[0, 0, 5]}>
        <sphereGeometry args={[0.28, 6, 6]} />
      </mesh>
      {/* Red beacon — belly centre */}
      <mesh ref={rLightRef} material={redMat} position={[0, -0.65, 0]}>
        <sphereGeometry args={[0.24, 6, 6]} />
      </mesh>
    </group>
  )
}
