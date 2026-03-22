import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Shaders ───────────────────────────────────────────────────────────────────
const VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`

const FRAG = /* glsl */`
  precision mediump float;
  uniform float uTime;
  varying vec2 vUv;

  float hash(vec2 p) {
    p = fract(p * vec2(234.34, 435.345));
    p += dot(p, p + 34.23);
    return fract(p.x * p.y);
  }

  float noise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  void main() {
    vec2 uv = vUv;

    // Base: dark navy #0a1a3a
    vec3 col = vec3(0.039, 0.102, 0.227);

    // Animated wave texture — two noise layers
    float n1 = noise(uv * vec2(8.0, 4.0) + vec2(uTime * 0.08, uTime * 0.05));
    float n2 = noise(uv * vec2(5.0, 3.0) - vec2(uTime * 0.06, uTime * 0.04));
    float waves = n1 * 0.6 + n2 * 0.4;

    // Wave highlights #1a4a7a blended in
    vec3 waveCol = vec3(0.102, 0.290, 0.478);
    col = mix(col, waveCol, waves * 0.35);

    // Teal city-light streaks — stronger near shore (low uv.y)
    float shore = pow(max(0.0, 1.0 - uv.y * 1.2), 2.0);
    float rip = sin(uv.y * 20.0 - uTime * 0.8) * 0.010
              + sin(uv.y * 11.0 + uTime * 0.5) * 0.006;
    float ux = uv.x + rip;

    float s = 0.0;
    s += exp(-pow((ux - 0.15) / 0.010, 2.0)) * (0.5 + 0.5 * abs(sin(uTime * 1.6 + uv.y * 8.0 + 0.0)));
    s += exp(-pow((ux - 0.35) / 0.015, 2.0)) * (0.5 + 0.5 * abs(sin(uTime * 1.3 + uv.y * 9.0 + 1.5)));
    s += exp(-pow((ux - 0.55) / 0.012, 2.0)) * (0.5 + 0.5 * abs(sin(uTime * 1.8 + uv.y * 7.0 + 2.8)));
    s += exp(-pow((ux - 0.75) / 0.009, 2.0)) * (0.5 + 0.5 * abs(sin(uTime * 1.4 + uv.y * 10.0 + 0.9)));
    s += exp(-pow((ux - 0.88) / 0.013, 2.0)) * (0.5 + 0.5 * abs(sin(uTime * 1.7 + uv.y * 8.5 + 3.2)));
    s = clamp(s, 0.0, 1.0) * shore;

    // #65B3AE teal at low opacity
    col += vec3(0.396, 0.702, 0.682) * s * 0.22;

    gl_FragColor = vec4(col, 1.0);
  }
`

// ── Materials ─────────────────────────────────────────────────────────────────
const boatMat   = new THREE.MeshStandardMaterial({ color: '#1a1e22', roughness: 0.85, metalness: 0.15 })
const canopyMat = new THREE.MeshStandardMaterial({ color: '#c8a240', roughness: 0.90, metalness: 0 })
const poleMat   = new THREE.MeshStandardMaterial({ color: '#7a5218', roughness: 0.95, metalness: 0 })

// ── Boat ─────────────────────────────────────────────────────────────────────
function Boat({ x, z, speed, dir }) {
  const ref = useRef()
  const px  = useRef(x)

  useFrame((_, dt) => {
    if (!ref.current) return
    px.current += dir * speed * dt
    if (px.current >  250) px.current = -100
    if (px.current < -100) px.current =  250
    ref.current.position.x = px.current
  })

  return (
    <group ref={ref} position={[x, 0.25, z]} rotation={[0, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
      <mesh material={boatMat}><boxGeometry args={[1.2, 0.5, 3.2]} /></mesh>
      <mesh material={boatMat} position={[0, 0.45, 0.3]}><boxGeometry args={[0.8, 0.55, 1.2]} /></mesh>
    </group>
  )
}

// ── Beach umbrella ────────────────────────────────────────────────────────────
function Umbrella({ x, z }) {
  return (
    <group position={[x, 0.03, z]}>
      <mesh material={poleMat} position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.08, 0.08, 2.4, 6]} />
      </mesh>
      <mesh material={canopyMat} position={[0, 2.8, 0]}>
        <coneGeometry args={[3, 2, 12]} />
      </mesh>
      <pointLight color="#ff9944" intensity={0.5} distance={8} decay={2} position={[0, 0.5, 0]} />
    </group>
  )
}

// ── Ocean ─────────────────────────────────────────────────────────────────────
export default function Ocean() {
  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  const matRef   = useRef()

  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <group>

      {/* Beach — fills entire gap: city south edge (z=0) → ground end (z=-160) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -80]}>
        <planeGeometry args={[600, 160]} />
        <meshStandardMaterial color="#c4935a" roughness={0.95} metalness={0} />
      </mesh>

      {/* Umbrellas near the shoreline (where beach meets ocean at z≈-150) */}
      <Umbrella x={-100} z={-140} />
      <Umbrella x={  10} z={-145} />
      <Umbrella x={ 120} z={-140} />
      <Umbrella x={ 220} z={-145} />

      {/* Ocean — starts at z=-160 where ground ends, extends to z=-460. No ground overlap. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -310]}>
        <planeGeometry args={[600, 300, 1, 1]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={VERT}
          fragmentShader={FRAG}
          uniforms={uniforms}
        />
      </mesh>

      {/* Boats — in the ocean past z=-160 */}
      <Boat x={  50} z={-210} speed={0.25} dir={ 1} />
      <Boat x={ -20} z={-300} speed={0.18} dir={-1} />
      <Boat x={ 150} z={-390} speed={0.14} dir={ 1} />

    </group>
  )
}
