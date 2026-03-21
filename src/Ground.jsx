import { useMemo } from 'react'
import * as THREE from 'three'

// ── Layout constants ──────────────────────────────────────────────────────────
const IX = 10      // intersection center X
const IZ = 10      // intersection center Z
const RW = 5       // road width
const RL = 44      // road arm length (each direction)
const HW = RW / 2  // 2.5 — half road width
const CW = 2       // crosswalk crossing width (world units)

// ── Canvas helpers ────────────────────────────────────────────────────────────

function makeEWRoadTex() {
  // E-W road: 1024 × 128 px — dashes along horizontal center
  const W = 1024, H = 128
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#222222'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#ffffff'
  // Dashed center line
  const dashW = 44, gapW = 44
  for (let x = 0; x < W; x += dashW + gapW) {
    ctx.fillRect(x, H / 2 - 2, dashW, 4)
  }
  // Edge stripes
  ctx.fillRect(0, 5,      W, 4)
  ctx.fillRect(0, H - 9,  W, 4)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function makeNSRoadTex() {
  // N-S road: 128 × 1024 px — dashes along vertical center
  const W = 128, H = 1024
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#222222'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#ffffff'
  // Dashed center line
  const dashH = 44, gapH = 44
  for (let y = 0; y < H; y += dashH + gapH) {
    ctx.fillRect(W / 2 - 2, y, 4, dashH)
  }
  // Edge stripes
  ctx.fillRect(5,     0, 4, H)
  ctx.fillRect(W - 9, 0, 4, H)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function makeEWCrosswalkTex() {
  // Crosswalk on E-W road (pedestrians cross in X direction).
  // UV: U → world X (crossing), V → world Z (road width).
  // Stripes must be thin in U → vertical columns on canvas.
  const W = 128, H = 256
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#222222'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#ffffff'
  const stripeW = 16, gap = 12, n = 4
  const totalW  = n * stripeW + (n - 1) * gap
  const startX  = Math.round((W - totalW) / 2)
  for (let i = 0; i < n; i++) {
    ctx.fillRect(startX + i * (stripeW + gap), 0, stripeW, H)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function makeNSCrosswalkTex() {
  // Crosswalk on N-S road (pedestrians cross in Z direction).
  // UV: U → world X (road width), V → world Z (crossing).
  // Stripes must be thin in V → horizontal rows on canvas.
  const W = 256, H = 128
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#222222'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#ffffff'
  const stripeH = 16, gap = 12, n = 4
  const totalH  = n * stripeH + (n - 1) * gap
  const startY  = Math.round((H - totalH) / 2)
  for (let i = 0; i < n; i++) {
    ctx.fillRect(0, startY + i * (stripeH + gap), W, stripeH)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Ground() {
  const textures = useMemo(() => ({
    ewRoad: makeEWRoadTex(),
    nsRoad: makeNSRoadTex(),
    cwEW:   makeEWCrosswalkTex(),
    cwNS:   makeNSCrosswalkTex(),
  }), [])

  return (
    <group>

      {/* ── Base asphalt ground ───────────────────────────────────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.95} metalness={0} />
      </mesh>

      {/* ── E-W road ─────────────────────────────────────────────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[IX, 0.005, IZ]} receiveShadow>
        <planeGeometry args={[RL, RW]} />
        <meshStandardMaterial map={textures.ewRoad} roughness={0.9} metalness={0} />
      </mesh>

      {/* ── N-S road (slightly higher z-offset to win z-fight at center) ── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[IX, 0.006, IZ]} receiveShadow>
        <planeGeometry args={[RW, RL]} />
        <meshStandardMaterial map={textures.nsRoad} roughness={0.9} metalness={0} />
      </mesh>

      {/* ── Crosswalks ───────────────────────────────────────────────────── */}
      {/* West approach  — PlaneGeometry [CW, RW]: U→X (crossing), V→Z (road) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}
            position={[IX - HW - CW / 2, 0.009, IZ]} receiveShadow>
        <planeGeometry args={[CW, RW]} />
        <meshStandardMaterial map={textures.cwEW} roughness={0.9} metalness={0} />
      </mesh>

      {/* East approach */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}
            position={[IX + HW + CW / 2, 0.009, IZ]} receiveShadow>
        <planeGeometry args={[CW, RW]} />
        <meshStandardMaterial map={textures.cwEW} roughness={0.9} metalness={0} />
      </mesh>

      {/* North approach — PlaneGeometry [RW, CW]: U→X (road), V→Z (crossing) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}
            position={[IX, 0.009, IZ - HW - CW / 2]} receiveShadow>
        <planeGeometry args={[RW, CW]} />
        <meshStandardMaterial map={textures.cwNS} roughness={0.9} metalness={0} />
      </mesh>

      {/* South approach */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}
            position={[IX, 0.009, IZ + HW + CW / 2]} receiveShadow>
        <planeGeometry args={[RW, CW]} />
        <meshStandardMaterial map={textures.cwNS} roughness={0.9} metalness={0} />
      </mesh>

    </group>
  )
}
