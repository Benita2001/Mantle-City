import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const POLE_H = 10    // pole height above building roof
const FLAG_W = 4.2   // flag width (horizontal extent)
const FLAG_H = 2.2   // flag height
const SEG_X  = 24    // horizontal subdivisions for wave
const SEG_Y  = 10    // vertical subdivisions

// ── Canvas texture: teal bg, darker M stripe, MANTLE CITY text ────────────────
function makeFlagTex() {
  const W = 512, H = 256
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')

  // Teal field
  ctx.fillStyle = '#65B3AE'
  ctx.fillRect(0, 0, W, H)

  // Darker left stripe (logo band)
  ctx.fillStyle = '#4A9490'
  ctx.fillRect(0, 0, Math.round(W * 0.23), H)

  // White "M" glyph centred in stripe
  ctx.fillStyle = '#ffffff'
  ctx.font = `900 ${Math.round(H * 0.72)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('M', Math.round(W * 0.115), H * 0.5)

  // "MANTLE CITY" on the right field
  ctx.font = `bold ${Math.round(H * 0.26)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('MANTLE', Math.round(W * 0.625), H * 0.34)
  ctx.fillText('CITY',   Math.round(W * 0.625), H * 0.68)

  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function CityFlag({ position = [0, 0, 0], buildingHeight = 40 }) {
  const meshRef = useRef()

  const { geo, origPos, mat } = useMemo(() => {
    const geo = new THREE.PlaneGeometry(FLAG_W, FLAG_H, SEG_X, SEG_Y)
    // Snapshot flat positions so wave offsets are always relative to rest state
    const origPos = Float32Array.from(geo.attributes.position.array)
    const mat = new THREE.MeshBasicMaterial({
      map:  makeFlagTex(),
      side: THREE.DoubleSide,
    })
    return { geo, origPos, mat }
  }, [])

  // Vertex wave animation — runs every frame via ref mutation (no state)
  useFrame(({ clock }) => {
    if (!meshRef.current) return
    const attr = meshRef.current.geometry.attributes.position
    const arr  = attr.array
    const t    = clock.getElapsedTime()

    for (let i = 0; i < arr.length / 3; i++) {
      const x = origPos[i * 3]
      // u = 0 at pole (left), 1 at free end (right) — amplitude grows with u
      const u = (x + FLAG_W / 2) / FLAG_W
      // Primary Z wave (in/out) — main fabric ripple
      arr[i * 3 + 2] = origPos[i * 3 + 2] + u * 0.60 * Math.sin(u * 5.0 - t * 3.6)
      // Secondary Y wave (vertical droop) — subtle secondary motion
      arr[i * 3 + 1] = origPos[i * 3 + 1] + u * 0.09 * Math.sin(u * 3.2 - t * 2.7)
    }
    attr.needsUpdate = true
  })

  const [px, , pz] = position
  const poleBaseY   = buildingHeight
  const poleTipY    = poleBaseY + POLE_H

  return (
    <group position={[px, 0, pz]}>

      {/* Slim metal pole */}
      <mesh position={[0, poleBaseY + POLE_H / 2, 0]} castShadow>
        <cylinderGeometry args={[0.055, 0.075, POLE_H, 6]} />
        <meshStandardMaterial color="#cccccc" roughness={0.35} metalness={0.9} />
      </mesh>

      {/* Flag — left edge anchored to pole tip, waves rightward */}
      <mesh
        ref={meshRef}
        geometry={geo}
        material={mat}
        position={[FLAG_W / 2 + 0.06, poleTipY - FLAG_H / 2 - 0.2, 0]}
      />

    </group>
  )
}
