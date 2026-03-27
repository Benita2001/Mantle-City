import { useMemo } from 'react'
import * as THREE from 'three'

const SKY_R = 490
const CX = 84, CZ = 90   // city center

// Gradient from zenith (dark navy) → horizon (bright cyan-blue)
// Canvas Y=0 → UV V=1 → sphere north pole (zenith)
// Canvas Y=H → UV V=0 → sphere south pole (nadir/horizon)
function makeSkyGradient() {
  const c = document.createElement('canvas')
  c.width = 2; c.height = 512
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 0, 512)
  g.addColorStop(0.00, '#0a1640')  // zenith — deep navy
  g.addColorStop(0.28, '#0c2258')  // upper sky
  g.addColorStop(0.56, '#163c78')  // mid sky — royal blue
  g.addColorStop(0.76, '#2468a8')  // near horizon
  g.addColorStop(0.91, '#3a7fc4')  // horizon glow
  g.addColorStop(1.00, '#4898d0')  // very bottom
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 2, 512)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export default function Sky() {
  const { skyTex, smallGeo, brightGeo } = useMemo(() => {
    const skyTex = makeSkyGradient()

    // Seeded PRNG
    let s = 0xc0ffee42 >>> 0
    const rand = () => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0
      return s / 0x100000000
    }

    // ── 580 small stars — white to blue-white ─────────────────────────────────
    const sCnt = 580
    const sPos = new Float32Array(sCnt * 3)
    const sCol = new Float32Array(sCnt * 3)
    for (let i = 0; i < sCnt; i++) {
      const az = rand() * Math.PI * 2
      const el = (0.10 + rand() * 0.88) * Math.PI / 2   // ~6° to 90° elevation
      sPos[i*3]   = SKY_R * Math.cos(el) * Math.cos(az)
      sPos[i*3+1] = SKY_R * Math.sin(el)
      sPos[i*3+2] = SKY_R * Math.cos(el) * Math.sin(az)
      const b = 0.86 + rand() * 0.14   // white to near-white
      sCol[i*3] = b; sCol[i*3+1] = b; sCol[i*3+2] = 1.0
    }
    const smallGeo = new THREE.BufferGeometry()
    smallGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3))
    smallGeo.setAttribute('color',    new THREE.BufferAttribute(sCol, 3))

    // ── 130 bright accent stars — white + teal (matches reference photo) ───────
    const lCnt = 130
    const lPos = new Float32Array(lCnt * 3)
    const lCol = new Float32Array(lCnt * 3)
    for (let i = 0; i < lCnt; i++) {
      const az = rand() * Math.PI * 2
      const el = (0.07 + rand() * 0.90) * Math.PI / 2
      lPos[i*3]   = SKY_R * Math.cos(el) * Math.cos(az)
      lPos[i*3+1] = SKY_R * Math.sin(el)
      lPos[i*3+2] = SKY_R * Math.cos(el) * Math.sin(az)
      if (rand() > 0.70) {
        // Teal/cyan accent — the few distinctly colored bright stars in the ref
        lCol[i*3] = 0.44; lCol[i*3+1] = 0.86; lCol[i*3+2] = 1.0
      } else {
        // Pure bright white
        lCol[i*3] = 1.0; lCol[i*3+1] = 1.0; lCol[i*3+2] = 1.0
      }
    }
    const brightGeo = new THREE.BufferGeometry()
    brightGeo.setAttribute('position', new THREE.BufferAttribute(lPos, 3))
    brightGeo.setAttribute('color',    new THREE.BufferAttribute(lCol, 3))

    return { skyTex, smallGeo, brightGeo }
  }, [])

  return (
    <>
      {/* Very subtle far-distance fade — invisible up close, softens ground edges */}
      <fogExp2 attach="fog" args={['#050d2e', 0.002]} />

      {/* Sky gradient dome — fog:false so sphere isn't fogged out */}
      <mesh position={[CX, 0, CZ]} renderOrder={-1}>
        <sphereGeometry args={[SKY_R, 32, 16]} />
        <meshBasicMaterial
          map={skyTex}
          side={THREE.BackSide}
          fog={false}
          depthWrite={false}
        />
      </mesh>

      {/* Small stars */}
      <points geometry={smallGeo} position={[CX, 0, CZ]} renderOrder={0}>
        <pointsMaterial
          vertexColors
          sizeAttenuation={false}
          size={2.2}
          transparent
          opacity={1.0}
          fog={false}
          depthWrite={false}
        />
      </points>

      {/* Large / bright stars */}
      <points geometry={brightGeo} position={[CX, 0, CZ]} renderOrder={0}>
        <pointsMaterial
          vertexColors
          sizeAttenuation={false}
          size={4.5}
          transparent
          opacity={1.0}
          fog={false}
          depthWrite={false}
        />
      </points>
    </>
  )
}
