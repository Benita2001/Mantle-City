import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Water shader ─────────────────────────────────────────────────────────────
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

  float snoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(
      mix(hash(i),             hash(i + vec2(1.0, 0.0)), f.x),
      mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
      f.y
    );
  }

  // Gaussian column streak at xPos with half-width w
  float gs(float ux, float xPos, float w) {
    float d = (ux - xPos) / w;
    return exp(-d * d);
  }

  void main() {
    vec2 uv = vUv;

    // Base: dark navy #0a1a3a — deep blue ocean at night
    vec3 col = vec3(0.039, 0.102, 0.227);

    // Shore falloff — reflections are strongest nearest the city (uv.y ≈ 0)
    float shore = pow(max(0.0, 1.0 - uv.y * 1.05), 1.5);

    // Ripple distortion — makes the vertical streaks shimmy side to side
    float rip = sin(uv.y * 28.0 - uTime * 1.00) * 0.008
              + sin(uv.y * 13.0 + uTime * 0.55) * 0.004
              + sin(uv.y * 55.0 - uTime * 1.80) * 0.002;
    float ux = uv.x + rip;

    // 8 city-light reflection columns (vertical streaks of teal)
    // Each shimmers independently in brightness
    float t = uTime;
    float s = 0.0;
    s += gs(ux, 0.07, 0.008) * (0.4 + 0.6 * abs(sin(t * 1.8 + uv.y * 10.0 + 0.0)));
    s += gs(ux, 0.17, 0.013) * (0.4 + 0.6 * abs(sin(t * 1.4 + uv.y * 12.0 + 1.2)));
    s += gs(ux, 0.29, 0.009) * (0.4 + 0.6 * abs(sin(t * 2.1 + uv.y *  9.0 + 2.4)));
    s += gs(ux, 0.42, 0.016) * (0.4 + 0.6 * abs(sin(t * 1.6 + uv.y * 11.0 + 3.1)));
    s += gs(ux, 0.54, 0.010) * (0.4 + 0.6 * abs(sin(t * 1.9 + uv.y * 13.0 + 0.7)));
    s += gs(ux, 0.65, 0.012) * (0.4 + 0.6 * abs(sin(t * 1.3 + uv.y *  8.0 + 1.9)));
    s += gs(ux, 0.77, 0.008) * (0.4 + 0.6 * abs(sin(t * 2.2 + uv.y * 10.0 + 3.5)));
    s += gs(ux, 0.88, 0.011) * (0.4 + 0.6 * abs(sin(t * 1.7 + uv.y * 12.0 + 2.1)));
    s = clamp(s, 0.0, 1.0) * shore;

    // Teal city-light reflections at 30% — subtle, blue dominates
    vec3 teal = vec3(0.396, 0.702, 0.682);  // #65B3AE
    col += teal * s * 0.30;

    // Wave highlights — blue ripple shimmer (#1a4a7a) from two noise layers
    float n1 = snoise(uv * vec2(90.0, 35.0) + vec2(t * 0.05,  t * 0.07));
    float n2 = snoise(uv * vec2(55.0, 22.0) - vec2(t * 0.04,  t * 0.06));
    vec3 waveBlue = vec3(0.102, 0.290, 0.478);  // #1a4a7a
    col += waveBlue * (n1 * 0.14 + n2 * 0.09);

    // Faint blue ambient near shore
    col += vec3(0.003, 0.008, 0.020) * shore;

    gl_FragColor = vec4(col, 1.0);
  }
`

// ── Shared boat material ──────────────────────────────────────────────────────
const boatMat = new THREE.MeshStandardMaterial({ color: '#181c20', roughness: 0.85, metalness: 0.15 })

// ── Beach furniture materials ─────────────────────────────────────────────────
const canopyMat = new THREE.MeshStandardMaterial({ color: '#c8a240', roughness: 0.92, metalness: 0 })
const poleMat   = new THREE.MeshStandardMaterial({ color: '#7a5218', roughness: 0.95, metalness: 0 })
const chairMat  = new THREE.MeshStandardMaterial({ color: '#7a4e24', roughness: 0.90, metalness: 0 })

// ── Beach umbrella: cone canopy + pole + two loungers + warm point light ──────
function BeachUmbrella({ x, z }) {
  return (
    <group position={[x, 0.03, z]}>
      {/* Pole */}
      <mesh material={poleMat} position={[0, 1.1, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 2.2, 6]} />
      </mesh>
      {/* Canopy — wide flat cone */}
      <mesh material={canopyMat} position={[0, 2.55, 0]}>
        <coneGeometry args={[1.75, 0.72, 12]} />
      </mesh>
      {/* Lounger left */}
      <mesh material={chairMat} position={[-0.58, 0.07, 0.35]}>
        <boxGeometry args={[0.44, 0.09, 0.85]} />
      </mesh>
      {/* Lounger right */}
      <mesh material={chairMat} position={[ 0.58, 0.07, 0.35]}>
        <boxGeometry args={[0.44, 0.09, 0.85]} />
      </mesh>
      {/* Warm golden point light — low, casts glow on sand */}
      <pointLight color="#ff9944" intensity={0.55} distance={5.5} decay={2} position={[0, 0.4, 0]} />
    </group>
  )
}

// ── Drifting boat silhouette ──────────────────────────────────────────────────
function DriftBoat({ initX, z, speed, dir, rotY }) {
  const ref  = useRef()
  const posX = useRef(initX)

  useFrame((_, dt) => {
    if (!ref.current) return
    posX.current += dir * speed * dt
    if (posX.current >  200) posX.current = -30
    if (posX.current < -30)  posX.current =  200
    ref.current.position.x = posX.current
  })

  return (
    <group ref={ref} position={[initX, -0.28, z]} rotation={[0, rotY, 0]}>
      {/* Hull */}
      <mesh material={boatMat}>
        <boxGeometry args={[1.1, 0.45, 2.8]} />
      </mesh>
      {/* Cabin */}
      <mesh material={boatMat} position={[0, 0.42, 0.25]}>
        <boxGeometry args={[0.72, 0.50, 1.1]} />
      </mesh>
    </group>
  )
}

// ── Ocean ─────────────────────────────────────────────────────────────────────
export default function Ocean({ gridW = 108 }) {
  const CX = gridW / 2

  const uniforms = useMemo(() => ({ uTime: { value: 0 } }), [])
  const matRef   = useRef()

  useFrame(({ clock }) => {
    if (matRef.current) matRef.current.uniforms.uTime.value = clock.getElapsedTime()
  })

  return (
    <group>

      {/* Sandy beach strip — z = 0 → z = -5, 5 units wide, right at city edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CX, 0.03, -2.5]}>
        <planeGeometry args={[gridW + 40, 5]} />
        <meshStandardMaterial color="#c4935a" roughness={0.95} metalness={0} />
      </mesh>

      {/* Beach umbrellas — within the 5-unit strip (z = 0 → z = -5) */}
      <BeachUmbrella x={12}  z={-2.0} />
      <BeachUmbrella x={30}  z={-3.5} />
      <BeachUmbrella x={52}  z={-2.0} />
      <BeachUmbrella x={74}  z={-3.5} />
      <BeachUmbrella x={94}  z={-2.0} />

      {/* Ocean plane — near edge at z = 0, y=0.02 just above ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[CX, 0.02, -300]}>
        <planeGeometry args={[gridW + 700, 600, 1, 1]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={VERT}
          fragmentShader={FRAG}
          uniforms={uniforms}
        />
      </mesh>

      {/* Boat silhouettes — sit on ocean surface (y = -0.5 + hull) */}
      <DriftBoat initX={55}  z={-20}  speed={0.28} dir={ 1} rotY={ Math.PI / 2} />
      <DriftBoat initX={100} z={-55}  speed={0.18} dir={-1} rotY={-Math.PI / 2} />
      <DriftBoat initX={35}  z={-140} speed={0.12} dir={ 1} rotY={ Math.PI / 2} />

    </group>
  )
}
