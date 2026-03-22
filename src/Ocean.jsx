import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ── Shaders (ocean — unchanged) ───────────────────────────────────────────────
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
    vec3 col = vec3(0.039, 0.102, 0.227);
    float n1 = noise(uv * vec2(8.0, 4.0) + vec2(uTime * 0.08, uTime * 0.05));
    float n2 = noise(uv * vec2(5.0, 3.0) - vec2(uTime * 0.06, uTime * 0.04));
    float waves = n1 * 0.6 + n2 * 0.4;
    vec3 waveCol = vec3(0.102, 0.290, 0.478);
    col = mix(col, waveCol, waves * 0.35);
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
    col += vec3(0.396, 0.702, 0.682) * s * 0.22;
    gl_FragColor = vec4(col, 1.0);
  }
`

// ── Materials ─────────────────────────────────────────────────────────────────
const boatMat  = new THREE.MeshStandardMaterial({ color: '#1a1e22', roughness: 0.85, metalness: 0.15 })
const trunkMat = new THREE.MeshStandardMaterial({ color: '#5c3210', roughness: 0.95, metalness: 0 })
const frondMat = new THREE.MeshStandardMaterial({ color: '#163808', roughness: 0.90, metalness: 0 })
const rockMat  = new THREE.MeshStandardMaterial({ color: '#2a2a2a', roughness: 0.90, metalness: 0.05 })
const moonMat  = new THREE.MeshBasicMaterial({ color: '#fffce8' })
const haloMat  = new THREE.MeshBasicMaterial({ color: '#c8c8a0', transparent: true, opacity: 0.12, side: THREE.BackSide })

// ── Boat (unchanged) ─────────────────────────────────────────────────────────
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

// ── Palm tree ─────────────────────────────────────────────────────────────────
function PalmTree({ x, z, h = 12, leanZ = 0, leanX = 0, rotY = 0 }) {
  return (
    <group position={[x, 0.03, z]} rotation={[leanX, rotY, leanZ]}>
      {/* Trunk — slightly tapered */}
      <mesh material={trunkMat} position={[0, h / 2, 0]}>
        <cylinderGeometry args={[0.28, 0.48, h, 7]} />
      </mesh>
      {/* Frond canopy */}
      <mesh material={frondMat} position={[0, h + 1.5, 0]}>
        <sphereGeometry args={[3.0, 8, 6]} />
      </mesh>
    </group>
  )
}

// ── Beach rock ────────────────────────────────────────────────────────────────
function Rock({ x, z, r }) {
  return (
    <mesh material={rockMat} position={[x, 0.03 + r * 0.55, z]}>
      <sphereGeometry args={[r, 6, 5]} />
    </mesh>
  )
}

// ── Ocean foam line (animated) ────────────────────────────────────────────────
function OceanFoam() {
  const ref = useRef()
  useFrame(({ clock }) => {
    if (ref.current) ref.current.material.opacity = 0.28 + 0.22 * Math.sin(clock.getElapsedTime() * 0.9)
  })
  return (
    <mesh ref={ref} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.04, -162]}>
      <planeGeometry args={[600, 5]} />
      <meshBasicMaterial color="#b8dff0" transparent opacity={0.4} />
    </mesh>
  )
}

// ── Moon with halo ────────────────────────────────────────────────────────────
function Moon() {
  return (
    <group position={[80, 90, -320]}>
      <mesh material={moonMat}>
        <sphereGeometry args={[5, 20, 20]} />
      </mesh>
      {/* Soft glow halo — slightly larger backside sphere */}
      <mesh material={haloMat}>
        <sphereGeometry args={[10, 20, 20]} />
      </mesh>
      {/* Moonlight — soft cool fill */}
      <pointLight color="#d0e8ff" intensity={0.35} distance={600} decay={1} />
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

      {/* Moon in the night sky */}
      <Moon />

      {/* ── Beach: z=0 → z=-160, warm golden sand ─────────────────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, -80]}>
        <planeGeometry args={[600, 160]} />
        <meshStandardMaterial color="#c4813a" roughness={0.95} metalness={0} />
      </mesh>

      {/* Warm orange point lights casting glow on sand */}
      <pointLight color="#ff6010" intensity={1.2} distance={30} decay={2} position={[-90,  4, -138]} />
      <pointLight color="#ff6a18" intensity={1.0} distance={28} decay={2} position={[ 20,  4, -143]} />
      <pointLight color="#ff5c08" intensity={1.1} distance={30} decay={2} position={[130,  4, -140]} />
      <pointLight color="#ff6a18" intensity={0.9} distance={26} decay={2} position={[230,  4, -135]} />

      {/* Palm trees — 7 scattered near the shoreline, slightly leaning */}
      <PalmTree x={-140} z={-128} h={13} leanZ={-0.14} leanX={ 0.05} rotY={0.4} />
      <PalmTree x={ -80} z={-143} h={11} leanZ={ 0.18} leanX={-0.04} rotY={1.3} />
      <PalmTree x={ -20} z={-132} h={14} leanZ={-0.10} leanX={ 0.06} rotY={2.2} />
      <PalmTree x={  45} z={-148} h={12} leanZ={ 0.15} leanX={-0.05} rotY={0.9} />
      <PalmTree x={ 115} z={-136} h={13} leanZ={-0.12} leanX={ 0.04} rotY={1.8} />
      <PalmTree x={ 175} z={-145} h={11} leanZ={ 0.16} leanX={-0.06} rotY={2.6} />
      <PalmTree x={ 235} z={-130} h={15} leanZ={-0.08} leanX={ 0.03} rotY={0.6} />

      {/* Rocks — scattered across sand */}
      <Rock x={-180} z={ -85} r={1.1} />
      <Rock x={-160} z={-110} r={0.7} />
      <Rock x={-130} z={ -95} r={1.4} />
      <Rock x={ -95} z={-120} r={0.5} />
      <Rock x={ -60} z={ -75} r={0.9} />
      <Rock x={ -30} z={-105} r={0.6} />
      <Rock x={  10} z={ -90} r={1.2} />
      <Rock x={  55} z={-118} r={0.8} />
      <Rock x={  90} z={ -80} r={1.0} />
      <Rock x={ 140} z={-100} r={0.5} />
      <Rock x={ 165} z={ -72} r={1.3} />
      <Rock x={ 200} z={-112} r={0.7} />
      <Rock x={ 240} z={ -88} r={0.9} />

      {/* Ocean foam — animated white line where water meets sand */}
      <OceanFoam />

      {/* ── Ocean: z=-160 → z=-460 ─────────────────────────────────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, -310]}>
        <planeGeometry args={[600, 300, 1, 1]} />
        <shaderMaterial
          ref={matRef}
          vertexShader={VERT}
          fragmentShader={FRAG}
          uniforms={uniforms}
        />
      </mesh>

      {/* Boats */}
      <Boat x={  50} z={-210} speed={0.25} dir={ 1} />
      <Boat x={ -20} z={-300} speed={0.18} dir={-1} />
      <Boat x={ 150} z={-390} speed={0.14} dir={ 1} />

    </group>
  )
}
