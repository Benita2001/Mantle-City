import { useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Constants ─────────────────────────────────────────────────────────────────
const STAR_COUNT = 2000
const SKY_R      = 1950     // star sphere radius, just inside the 2000-unit dome
const MOON_POS   = [58, 132, -25]

// ── Seeded PRNG (mulberry32) — reproducible star field ────────────────────────
function mulberry32(seed) {
  let s = seed >>> 0
  return () => {
    s += 0x6d2b79f5
    let t = s
    t  = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 0x100000000
  }
}

// ── Star BufferGeometry ───────────────────────────────────────────────────────
function buildStarGeometry() {
  const rnd    = mulberry32(0xBEEF)
  const pos    = new Float32Array(STAR_COUNT * 3)
  const sizes  = new Float32Array(STAR_COUNT)
  const phases = new Float32Array(STAR_COUNT)

  for (let i = 0; i < STAR_COUNT; i++) {
    // Uniform sampling on the upper hemisphere (y ≥ 0)
    const phi   = Math.acos(rnd())       // 0 → PI/2
    const theta = rnd() * Math.PI * 2
    pos[i*3]   = SKY_R * Math.sin(phi) * Math.cos(theta)
    pos[i*3+1] = SKY_R * Math.cos(phi)  // always positive
    pos[i*3+2] = SKY_R * Math.sin(phi) * Math.sin(theta)
    sizes[i]   = 1.5 + rnd() * 2.0      // 1.5 – 3.5 px
    phases[i]  = rnd() * Math.PI * 2    // random twinkle phase
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(pos,    3))
  geo.setAttribute('aSize',    new THREE.BufferAttribute(sizes,  1))
  geo.setAttribute('aPhase',   new THREE.BufferAttribute(phases, 1))
  return geo
}

// ── Star shader — circular points with per-star twinkle ───────────────────────
const STAR_VERT = /* glsl */`
  attribute float aSize;
  attribute float aPhase;
  varying  float vPhase;
  void main() {
    vPhase       = aPhase;
    gl_PointSize = aSize;
    gl_Position  = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const STAR_FRAG = /* glsl */`
  uniform float uTime;
  varying float vPhase;
  void main() {
    float d       = length(gl_PointCoord - vec2(0.5)) * 2.0;
    if (d > 1.0) discard;
    float twinkle = 0.85 + 0.15 * sin(uTime * 2.0 + vPhase);
    float alpha   = smoothstep(1.0, 0.2, d) * twinkle;
    gl_FragColor  = vec4(1.0, 1.0, 1.0, alpha);
  }
`

// ── Component ─────────────────────────────────────────────────────────────────
export default function Sky() {

  const starGeo = useMemo(buildStarGeometry, [])

  const starMat = useMemo(() => new THREE.ShaderMaterial({
    vertexShader:   STAR_VERT,
    fragmentShader: STAR_FRAG,
    uniforms:       { uTime: { value: 0 } },
    transparent:    true,
    depthWrite:     false,
  }), [])

  // Advance twinkle uniform every frame
  useFrame(({ clock }) => {
    starMat.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <>
      {/* Dark navy fog — matches horizon, zero teal */}
      <fogExp2 attach="fog" args={['#050D20', 0.008]} />

      {/* 2000 twinkling star points */}
      <points renderOrder={-1} geometry={starGeo} material={starMat} />

      {/* Moon body — emissive pale sphere */}
      <mesh position={MOON_POS} renderOrder={-1}>
        <sphereGeometry args={[5, 24, 16]} />
        <meshStandardMaterial
          color="#d8d0c0"
          emissive="#F5F0E8"
          emissiveIntensity={1.2}
          roughness={0.9}
          metalness={0}
        />
      </mesh>

      {/* Moon atmospheric halo — faint larger sphere */}
      <mesh position={MOON_POS} renderOrder={-1}>
        <sphereGeometry args={[9, 16, 12]} />
        <meshBasicMaterial
          color="#c8d8f0"
          transparent
          opacity={0.06}
          depthWrite={false}
        />
      </mesh>
    </>
  )
}
