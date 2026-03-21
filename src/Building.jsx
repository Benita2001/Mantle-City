import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Mantle brand palette ──────────────────────────────────────────────────────
const FACADE    = '#8A9BAE'   // daytime concrete base
const LIT_TEAL  = '#C8D8E8'   // sky-reflected glass   (30%)
const LIT_GREEN = '#E8D8A0'   // warm interior light   (15%)
const WIN_DARK  = '#3A4050'   // dark tinted glass     (55%)
const FLOOR_LINE = '#B0AAAA'  // horizontal floor dividers
const MULLION    = '#909090'  // vertical mullions

const COLS = 8
const ROWS = 24

// ── Deterministic PRNG (mulberry32) ──────────────────────────────────────────
function makePrng(seed) {
  let s = seed >>> 0
  return () => {
    s += 0x6d2b79f5
    let t = s
    t  = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

/**
 * Paint one building face onto a canvas.
 *  - 8 cols × 24 rows window grid
 *  - litPct controls total lit fraction; 70% teal, 30% green of lit windows
 *  - floor lines + mullions
 */
function paintFace(canvasW, canvasH, seed, facadeColor, litPct = 0.35) {
  const canvas = document.createElement('canvas')
  canvas.width  = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')
  const rnd = makePrng(seed)

  // Base facade
  ctx.fillStyle = facadeColor
  ctx.fillRect(0, 0, canvasW, canvasH)

  const cellW = canvasW / COLS
  const cellH = canvasH / ROWS
  // window = 60% of cell → 20% padding per side in each axis
  const px = Math.max(2, cellW * 0.20)
  const py = Math.max(2, cellH * 0.20)

  for (let row = 0; row < ROWS; row++) {
    for (let col = 0; col < COLS; col++) {
      const x = col * cellW + px
      const y = row * cellH + py
      const w = cellW - px * 2
      const h = cellH - py * 2
      const r           = rnd()
      const tealThresh  = litPct * 0.7   // 70% of lit budget → teal
      const greenThresh = litPct         // remaining 30% → green

      if (r < tealThresh) {
        // teal lit
        ctx.globalAlpha = 0.82 + rnd() * 0.14
        ctx.fillStyle = LIT_TEAL
        ctx.fillRect(x, y, w, h)

        // inner radial glow — clamped within window bounds, no bleed into gutter
        const gx = x + w * 0.5
        const gy = y + h * 0.5
        const gr = ctx.createRadialGradient(gx, gy, 0, gx, gy, Math.max(w, h) * 0.7)
        gr.addColorStop(0, 'rgba(101,179,174,0.35)')
        gr.addColorStop(1, 'rgba(101,179,174,0)')
        ctx.fillStyle = gr
        ctx.fillRect(x, y, w, h)

      } else if (r < greenThresh) {
        // green lit
        ctx.globalAlpha = 0.65 + rnd() * 0.25
        ctx.fillStyle = LIT_GREEN
        ctx.fillRect(x, y, w, h)

      } else {
        // dark (55%)
        ctx.globalAlpha = 1.0
        ctx.fillStyle = WIN_DARK
        ctx.fillRect(x, y, w, h)
        // faint reflective sheen on dark glass
        ctx.fillStyle = 'rgba(101,179,174,0.04)'
        ctx.fillRect(x, y, w * 0.38, h)
      }

      ctx.globalAlpha = 1.0
    }
  }

  // Horizontal floor lines (between every row)
  ctx.fillStyle = FLOOR_LINE
  for (let row = 1; row < ROWS; row++) {
    ctx.fillRect(0, Math.round(row * cellH) - 1, canvasW, 2)
  }

  // Vertical mullions (between every column)
  ctx.fillStyle = MULLION
  for (let col = 1; col < COLS; col++) {
    ctx.fillRect(Math.round(col * cellW) - 1, 0, 2, canvasH)
  }

  return canvas
}

/**
 * Create a CanvasTexture for one face, aspect-ratio matched to (faceW × height).
 * We fix canvas width at 512px and scale height to match the face's W:H ratio.
 */
function makeTex(faceW, height, seed, facadeColor, litPct) {
  const canvasW = 128
  const canvasH = Math.min(Math.round(128 * (height / faceW)), 512)
  const canvas  = paintFace(canvasW, Math.max(canvasH, 256), seed, facadeColor, litPct)
  const tex     = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.needsUpdate = true
  return tex
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function Building({
  width       = 2,
  depth       = 2,
  height      = 8,
  seed        = 42,
  facadeColor = '#1C1C1E',
  litPct      = 0.35,
  rotate      = false,
}) {
  const ref = useRef()

  useFrame((_, delta) => {
    if (rotate && ref.current) ref.current.rotation.y += delta * 0.25
  })

  const materials = useMemo(() => {
    const texPX = makeTex(width,  height, seed * 1,  facadeColor, litPct)
    const texNX = makeTex(width,  height, seed * 3,  facadeColor, litPct)
    const texPZ = makeTex(depth,  height, seed * 7,  facadeColor, litPct)
    const texNZ = makeTex(depth,  height, seed * 13, facadeColor, litPct)

    const side = (tex) => new THREE.MeshStandardMaterial({
      map:               tex,
      emissiveMap:       tex,
      emissive:          new THREE.Color('#ffffff'), // white: lets texture color control glow directly
      emissiveIntensity: 0.08,                       // subtle day glow — windows show colour, no bloom
      roughness:         0.8,
      metalness:         0.0,
    })

    const roof = new THREE.MeshStandardMaterial({
      color:     new THREE.Color('#E0DCD0'),
      roughness: 0.85,
      metalness: 0.15,
    })

    const bottom = new THREE.MeshStandardMaterial({ visible: false })

    // BoxGeometry face order: +X, -X, +Y(top), -Y(bottom), +Z, -Z
    return [side(texPX), side(texNX), roof, bottom, side(texPZ), side(texNZ)]
  }, [width, depth, height, seed, facadeColor, litPct])

  return (
    <mesh
      ref={ref}
      position={[0, height / 2, 0]}
      castShadow
    >
      <boxGeometry args={[width, height, depth]} />
      {materials.map((mat, i) => (
        <primitive key={i} object={mat} attach={`material-${i}`} />
      ))}
    </mesh>
  )
}
