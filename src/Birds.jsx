import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const birdMat = new THREE.MeshStandardMaterial({ color: '#1a2a3a', roughness: 0.9, metalness: 0 })

function BirdShape() {
  return (
    <group>
      {/* Left wing */}
      <mesh material={birdMat} position={[-0.72, 0, 0]} rotation={[0.18, 0, -Math.PI / 7]}>
        <boxGeometry args={[1.44, 0.055, 0.26]} />
      </mesh>
      {/* Right wing */}
      <mesh material={birdMat} position={[0.72, 0, 0]} rotation={[0.18, 0, Math.PI / 7]}>
        <boxGeometry args={[1.44, 0.055, 0.26]} />
      </mesh>
    </group>
  )
}

// V-formation offsets: [right, up, back] in formation local space
const V_OFFSETS = [
  [   0,   0,    0 ],  // lead
  [-2.5, 0.4,  3.5 ],  // left-1
  [-5.0, 0.9,  7.0 ],  // left-2
  [-7.5, 1.4, 10.5 ],  // left-3
  [ 2.5, 0.4,  3.5 ],  // right-1
  [ 5.0, 0.9,  7.0 ],  // right-2
  [ 7.5, 1.4, 10.5 ],  // right-3
  [-3.5, 0.7,  6.0 ],  // straggler
]

const ORBIT_R  = 150
const ALTITUDE = 76
const SPEED    = 0.075  // rad/s (~84s per lap)

export default function Birds({ cx = 84, cz = 90 }) {
  const refs = useRef([])

  useFrame(({ clock }) => {
    const t     = clock.getElapsedTime()
    const angle = t * SPEED

    // Formation centre
    const fcx = cx + Math.cos(angle) * ORBIT_R
    const fcz = cz + Math.sin(angle) * ORBIT_R

    // Heading tangent: direction of travel
    const hx =  -Math.sin(angle)
    const hz =   Math.cos(angle)
    // Right vector (perpendicular, pointing outward)
    const rx =   Math.cos(angle)
    const rz =   Math.sin(angle)

    V_OFFSETS.forEach(([lRight, lUp, lBack], i) => {
      const g = refs.current[i]
      if (!g) return
      g.position.x = fcx + rx * lRight - hx * lBack
      g.position.y = ALTITUDE + lUp + Math.sin(t * 1.9 + i * 0.7) * 0.9
      g.position.z = fcz + rz * lRight - hz * lBack
      g.rotation.y = -angle - Math.PI / 2
    })
  })

  return (
    <>
      {V_OFFSETS.map((_, i) => (
        <group key={i} ref={el => refs.current[i] = el}>
          <BirdShape />
        </group>
      ))}
    </>
  )
}
