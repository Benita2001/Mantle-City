import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const SEG = 64   // subdivisions per side — enough for smooth waves

export default function Ocean({ gridW = 168 }) {
  const meshRef = useRef()

  const { geo, origPos } = useMemo(() => {
    const geo     = new THREE.PlaneGeometry(gridW + 500, 500, SEG, SEG)
    const origPos = Float32Array.from(geo.attributes.position.array)
    return { geo, origPos }
  }, [gridW])

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const t    = clock.getElapsedTime()
    const attr = meshRef.current.geometry.attributes.position
    const arr  = attr.array

    for (let i = 0; i < arr.length / 3; i++) {
      const lx = origPos[i * 3]       // maps to world X
      const ly = origPos[i * 3 + 1]   // maps to world -Z after rotation
      arr[i * 3 + 2] =
        0.40 * Math.sin(lx * 0.04 + t * 0.70) * Math.cos(ly * 0.03 - t * 0.50) +
        0.25 * Math.sin(lx * 0.08 - t * 1.10) +
        0.18 * Math.cos(ly * 0.05 + t * 0.80) +
        0.10 * Math.sin((lx - ly) * 0.03 + t * 0.60)
    }
    attr.needsUpdate = true
    meshRef.current.geometry.computeVertexNormals()
  })

  // Center the ocean behind the city's -Z edge (z=0), extending to z ≈ -500
  // y=0.02 keeps it just above the ground plane to prevent z-fighting
  return (
    <mesh
      ref={meshRef}
      geometry={geo}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[gridW / 2, 0.02, -250]}
      receiveShadow
    >
      <meshStandardMaterial
        color="#0a1628"
        roughness={0.25}
        metalness={0.15}
        emissive="#0d2040"
        emissiveIntensity={0.30}
      />
    </mesh>
  )
}
