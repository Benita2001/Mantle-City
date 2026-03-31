import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import Building    from './Building.jsx'
import StreetLight from './StreetLight.jsx'
import CityFlag    from './CityFlag.jsx'
import { getProtocolInfo, classifyWallet } from './utils/walletClassifier.js'

// ── Grid constants ─────────────────────────────────────────────────────────────
const BLOCK_W  = 9
const BLOCK_D  = 9
const STREET   = 3     // 2-lane road width
const CW       = 2     // crosswalk depth
const SIDEWALK = 0.6   // pavement strip
const TREE_COUNT = 320

const CELL_W  = BLOCK_W + STREET   // 12
const CELL_D  = BLOCK_D + STREET   // 12

// ── Building facade tones ──────────────────────────────────────────────────────
const FACADE_COLORS = ['#1C1C1E', '#242428', '#2C2C30']

// ── Car palette ────────────────────────────────────────────────────────────────
// red, blue, silver, brown, green, orange, yellow — white spawned rarely
const CAR_COLORS = ['#C0392B', '#1B3A6B', '#A8A8A8', '#A0785A', '#2D6A4F', '#E67E22', '#F1C40F']
const CAR_WHITE  = '#E8E8E8'
const MOVING_CAR_COUNT = 150
const PARKED_CAR_COUNT = 40
const WALKER_COUNT = 60

// ── PRNG (mulberry32) ──────────────────────────────────────────────────────────
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

function hashAddress(addr = '') {
  let h = 0x811c9dc5
  for (let i = 0; i < addr.length; i++) {
    h ^= addr.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) || 1
}

// ── Grid dimensions ────────────────────────────────────────────────────────────
function computeGrid(n) {
  const cols  = Math.max(4, Math.floor(Math.sqrt(n)))
  const rows  = Math.ceil(n / cols)
  const gridW = cols * CELL_W
  const gridD = rows * CELL_D
  const nsX   = Array.from({ length: cols - 1 }, (_, i) =>
    BLOCK_W + STREET / 2 + i * CELL_W)
  const ewZ   = Array.from({ length: rows - 1 }, (_, i) =>
    BLOCK_D + STREET / 2 + i * CELL_D)
  return { cols, rows, gridW, gridD, nsX, ewZ }
}

// ── Tier-based building height + width ─────────────────────────────────────────
// Tier 1 (rank 0)      → h=40, w=7  — dead centre
// Tier 2 (ranks 1-50)  → h=25-35, w=5
// Tier 3 (ranks 51-125)  → h=18-22, w=5
// Tier 4 (ranks 126-225) → h=14-17, w=5
// Tier 5 (ranks 226-350) → h=10-13, w=5
// Tier 6 (ranks 351-499) → h=7-9,   w=5
// Seeded variation is intentionally clamped by tier so outer buildings never
// visually rival the dominant center cluster.
function getTierSpecs(rank, seed) {
  const rnd  = mulberry32(seed)

  if (rank === 0) {
    const vary = 0.98 + rnd() * 0.04
    return { height: 42 * vary, width: 7.2, depth: 7.2 }
  }

  let baseH
  let minH
  let maxH
  let width
  let depth
  let varyMin
  let varyMax

  if (rank <= 50) {
    const t = rank - 1
    baseH = 27 + 7 * (1 - Math.log(t + 1) / Math.log(50))
    minH = 27
    maxH = 35
    width = 5.3
    depth = 5.3
    varyMin = 0.95
    varyMax = 1.04
  } else if (rank <= 125) {
    const t = rank - 51
    baseH = 19 + 3.5 * (1 - Math.log(t + 1) / Math.log(75))
    minH = 18.5
    maxH = 23
    width = 4.9
    depth = 4.9
    varyMin = 0.96
    varyMax = 1.03
  } else if (rank <= 225) {
    const t = rank - 126
    baseH = 14 + 3 * (1 - Math.log(t + 1) / Math.log(100))
    minH = 14
    maxH = 17.5
    width = 4.7
    depth = 4.7
    varyMin = 0.97
    varyMax = 1.025
  } else if (rank <= 350) {
    const t = rank - 226
    baseH = 10 + 3 * (1 - Math.log(t + 1) / Math.log(125))
    minH = 10
    maxH = 13.2
    width = 4.5
    depth = 4.5
    varyMin = 0.975
    varyMax = 1.02
  } else {
    const t = rank - 351
    baseH = 7 + 2 * (1 - Math.log(t + 1) / Math.log(149))
    minH = 7
    maxH = 9.2
    width = 4.25
    depth = 4.25
    varyMin = 0.98
    varyMax = 1.015
  }

  const vary = varyMin + rnd() * (varyMax - varyMin)
  const height = Math.min(maxH, Math.max(minH, baseH * vary))
  return { height, width, depth }
}

// ── Normalise Dune rows → buildings (sorted by MNT volume, tallest to centre) ─
function normalizeWallets(rows, cols, rowCount) {
  const sorted = [...rows].sort(
    (a, b) => (b.total_volume_mnt || 0) - (a.total_volume_mnt || 0)
  )

  const centerC = (cols - 1) / 2
  const centerR = (rowCount - 1) / 2
  const positions = []
  for (let r = 0; r < rowCount; r++)
    for (let c = 0; c < cols; c++)
      positions.push({ c, r, dist: Math.hypot(c - centerC, r - centerR) })
  positions.sort((a, b) => a.dist - b.dist)

  return sorted.map((row, rank) => {
    const addr  = (row.wallet_address || '').toLowerCase()
    const proto = getProtocolInfo(addr)
    const type  = classifyWallet(row)
    const seed  = hashAddress(addr)
    const { height, width, depth } = getTierSpecs(rank, seed)

    // Facade colour — second call on same seed stream (first was variation inside getTierSpecs)
    const rnd = mulberry32(seed)
    rnd()  // skip variation slot
    const facadeColor = rank === 0
      ? FACADE_COLORS[0]
      : FACADE_COLORS[Math.floor(rnd() * FACADE_COLORS.length)]

    const litPct = rank === 0 ? 0.9 : Math.max(0.15, 0.65 - rank / sorted.length * 0.4)

    const { c, r } = positions[Math.min(rank, positions.length - 1)]

    return {
      id:          addr || `b_${rank}`,
      seed, width, depth, height,
      facadeColor, litPct,
      x:           c * CELL_W + BLOCK_W / 2,
      z:           r * CELL_D + BLOCK_D / 2,
      label:       proto ? proto.name    : null,
      subtitle:    proto ? proto.subtitle : null,
      type,
      address:     row.wallet_address,
      txCount:     row.tx_count || 0,
      volume:      row.total_volume_mnt || 0,
    }
  })
}

// ── Placeholder building data ──────────────────────────────────────────────────
function genPlaceholderData(cols, rows) {
  const out = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seed = (c * 97 + r * 31 + 3) * 19
      const rnd  = mulberry32(seed)
      out.push({
        id: `b_${c}_${r}`, seed,
        width: 5, depth: 5,
        height: 8 + rnd() * 24,
        facadeColor: FACADE_COLORS[Math.floor(mulberry32(seed + 1)() * 3)],
        litPct: 0.35, label: null, txCount: 0, volume: 0,
      })
    }
  }
  out.sort((a, b) => b.height - a.height)
  const centerC = (cols - 1) / 2
  const centerR = (rows  - 1) / 2
  const positions = []
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      positions.push({ c, r, dist: Math.hypot(c - centerC, r - centerR) })
  positions.sort((a, b) => a.dist - b.dist)
  return out.map((b, idx) => {
    const { c, r } = positions[idx]
    return { ...b, x: c * CELL_W + BLOCK_W / 2, z: r * CELL_D + BLOCK_D / 2 }
  })
}

// ── Road textures ──────────────────────────────────────────────────────────────
function makeNSRoadTex(gridD) {
  const W = 128
  const H = Math.min(Math.ceil(gridD * 12.8), 4096)
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#2a2a2a'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  const dashH = 44, gapH = 52
  for (let y = 0; y < H; y += dashH + gapH) ctx.fillRect(W / 2 - 1, y, 2, dashH)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function makeEWRoadTex(gridW) {
  const W = Math.min(Math.ceil(gridW * 9.14), 4096)
  const H = 64
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#2a2a2a'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  const dashW = 44, gapW = 52
  for (let x = 0; x < W; x += dashW + gapW) ctx.fillRect(x, H / 2 - 1, dashW, 2)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function makeCrosswalkTex(ewApproach) {
  const [W, H] = ewApproach ? [256, 128] : [128, 256]
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#2a2a2a'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = 'rgba(255,255,255,0.82)'
  const n = 5, stripe = 12, gap = 20
  const total = n * stripe + (n - 1) * gap
  if (ewApproach) {
    const sx = Math.round((W - total) / 2)
    for (let i = 0; i < n; i++) ctx.fillRect(sx + i * (stripe + gap), 0, stripe, H)
  } else {
    const sy = Math.round((H - total) / 2)
    for (let i = 0; i < n; i++) ctx.fillRect(0, sy + i * (stripe + gap), W, stripe)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// ── Tree — fixed size, #4CAF50 always, never scaled by building data ──────────
function Tree({ position }) {
  return (
    <group position={position}>
      {/* Trunk: height 0.8 */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <cylinderGeometry args={[0.08, 0.12, 0.8, 6]} />
        <meshStandardMaterial color="#5C4033" roughness={0.9} metalness={0} />
      </mesh>
      {/* Canopy: cone radius 0.4, height 1.2, base sits atop trunk */}
      <mesh position={[0, 1.4, 0]} castShadow>
        <coneGeometry args={[0.4, 1.2, 7]} />
        <meshStandardMaterial color="#4CAF50" roughness={0.8} metalness={0} />
      </mesh>
    </group>
  )
}

function WalkerFigure({ color = '#d0d4db' }) {
  return (
    <group>
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.09, 0.11, 0.64, 6]} />
        <meshStandardMaterial color={color} roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[0, 0.8, 0]}>
        <sphereGeometry args={[0.12, 8, 8]} />
        <meshStandardMaterial color="#d9c2a0" roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[0, 0.56, 0.09]}>
        <boxGeometry args={[0.22, 0.26, 0.12]} />
        <meshStandardMaterial color={color} roughness={0.95} metalness={0} />
      </mesh>
      <mesh position={[-0.055, 0.07, 0]}>
        <boxGeometry args={[0.06, 0.14, 0.06]} />
        <meshStandardMaterial color="#2b2f36" roughness={1} metalness={0} />
      </mesh>
      <mesh position={[0.055, 0.07, 0]}>
        <boxGeometry args={[0.06, 0.14, 0.06]} />
        <meshStandardMaterial color="#2b2f36" roughness={1} metalness={0} />
      </mesh>
    </group>
  )
}

function AnimatedWalkers({ nsX, ewZ, gridW, gridD }) {
  const walkers = useMemo(() => {
    const rnd = mulberry32(0x1eedbeef)
    const walkerColors = ['#b8c0cc', '#8f9baa', '#7c8a98', '#a9b4bf', '#6f7c88']
    const sidewalkOffset = STREET / 2 + SIDEWALK / 2
    const paths = [
      ...nsX.flatMap((x) => ([
        { type: 'ns', coord: x - sidewalkOffset, min: 0, max: gridD },
        { type: 'ns', coord: x + sidewalkOffset, min: 0, max: gridD },
      ])),
      ...ewZ.flatMap((z) => ([
        { type: 'ew', coord: z - sidewalkOffset, min: 0, max: gridW },
        { type: 'ew', coord: z + sidewalkOffset, min: 0, max: gridW },
      ])),
    ]

    const shuffledPaths = paths
      .map((path, index) => ({ ...path, sort: rnd(), index }))
      .sort((a, b) => a.sort - b.sort || a.index - b.index)

    return Array.from({ length: Math.min(WALKER_COUNT, shuffledPaths.length) }, (_, i) => {
      const path = shuffledPaths[i]
      const span = Math.max(6, path.max - path.min)
      const trim = Math.min(3.5, span * 0.18)
      const min = path.min + trim
      const max = path.max - trim
      const start = min + rnd() * Math.max(0.001, max - min)
      return {
        path,
        min,
        max,
        progress: start,
        dir: rnd() > 0.5 ? 1 : -1,
        speed: 0.8 + rnd() * 0.9,
        bob: rnd() * Math.PI * 2,
        color: walkerColors[Math.floor(rnd() * walkerColors.length)],
      }
    })
  }, [nsX, ewZ, gridW, gridD])

  const walkerRefs = useRef([])
  const motion = useRef(walkers.map((w) => ({ progress: w.progress, dir: w.dir })))

  useFrame(({ clock }, dt) => {
    const t = clock.getElapsedTime()
    walkers.forEach((walker, i) => {
      const state = motion.current[i]
      const ref = walkerRefs.current[i]
      if (!state || !ref) return

      state.progress += walker.speed * dt * state.dir
      if (state.progress > walker.max) {
        state.progress = walker.max
        state.dir = -1
      } else if (state.progress < walker.min) {
        state.progress = walker.min
        state.dir = 1
      }

      if (walker.path.type === 'ns') {
        ref.position.x = walker.path.coord
        ref.position.z = state.progress
        ref.rotation.y = state.dir > 0 ? 0 : Math.PI
      } else {
        ref.position.x = state.progress
        ref.position.z = walker.path.coord
        ref.rotation.y = state.dir > 0 ? -Math.PI / 2 : Math.PI / 2
      }
      ref.position.y = 0.01 + Math.sin(t * 5 + walker.bob) * 0.015
    })
  })

  return (
    <>
      {walkers.map((walker, i) => (
        <group key={`walker-${i}`} ref={(el) => (walkerRefs.current[i] = el)}>
          <WalkerFigure color={walker.color} />
        </group>
      ))}
    </>
  )
}

// ── AnimatedCars — 190 total: 150 moving + 40 parked ──────────────────────────
function AnimatedCars({ nsX, ewZ, gridW, gridD, buildings }) {
  const { movingCars, parkedCars } = useMemo(() => {
    const rnd = mulberry32(0xCAFE1234)

    const pickColor = () => {
      if (rnd() > 0.92) return CAR_WHITE   // white ~8 % of the time
      return CAR_COLORS[Math.floor(rnd() * CAR_COLORS.length)]
    }

    // ── Moving cars distributed across all roads in the city ──
    const moving = []
    const allRoads = [
      ...nsX.map(x => ({ type: 'ns', coord: x })),
      ...ewZ.map(z => ({ type: 'ew', coord: z })),
    ]

    const roadOrder = [
      ...nsX.map((x, index) => ({ type: 'ns', coord: x, index })),
      ...ewZ.map((z, index) => ({ type: 'ew', coord: z, index })),
    ]

    const baseCarsPerRoad = Math.floor(MOVING_CAR_COUNT / Math.max(1, roadOrder.length))
    const extraCars = MOVING_CAR_COUNT % Math.max(1, roadOrder.length)

    roadOrder.forEach((road, roadIndex) => {
      const targetCount = baseCarsPerRoad + (roadIndex < extraCars ? 1 : 0)
      if (targetCount === 0) return

      const lanePlans = [
        { lane: -0.72, dir: 1, count: Math.ceil(targetCount / 2) },
        { lane:  0.72, dir: -1, count: Math.floor(targetCount / 2) },
      ]

      lanePlans.forEach(({ lane, dir, count }, laneIndex) => {
        if (count === 0) return
        const roadLen = road.type === 'ns' ? gridD : gridW
        const spacing = roadLen / count
        const offset = ((roadIndex * 0.37 + laneIndex * 0.19) % 1) * Math.max(1, spacing * 0.45)
        const speed = (4.9 + (roadIndex % 3) * 0.35 + laneIndex * 0.15) * dir

        for (let n = 0; n < count; n++) {
          const progress = (offset + n * spacing) % roadLen
          if (road.type === 'ns') {
            moving.push({
              type: 'ns',
              x: road.coord + lane,
              z: progress,
              speed,
              color: pickColor(),
              rotY: dir > 0 ? 0 : Math.PI,
            })
          } else {
            moving.push({
              type: 'ew',
              x: progress,
              z: road.coord + lane,
              speed,
              color: pickColor(),
              rotY: dir > 0 ? -Math.PI / 2 : Math.PI / 2,
            })
          }
        }
      })
    })

    // ── Parked cars spread across buildings city-wide (skip rank 0 landmark) ──
    const parked = []
    const parkingCandidates = buildings
      .slice(1)
      .sort((a, b) => (a.z - b.z) || (a.x - b.x))

    const usableParkedCount = Math.min(PARKED_CAR_COUNT, parkingCandidates.length)
    const parkedStep = Math.max(1, Math.floor(parkingCandidates.length / usableParkedCount))
    for (let i = 0; i < usableParkedCount; i++) {
      const b = parkingCandidates[Math.min(i * parkedStep, parkingCandidates.length - 1)]
      const side   = rnd() > 0.5 ? 1 : -1
      const offset = b.depth / 2 + 0.75
      parked.push({
        x:    b.x + (rnd() - 0.5) * (b.width * 0.4),
        z:    b.z + side * offset,
        rotY: rnd() > 0.5 ? 0 : Math.PI,
        color: pickColor(),
      })
    }

    return { movingCars: moving, parkedCars: parked }
  }, [nsX, ewZ, gridW, gridD, buildings])

  const movingRefs = useRef([])
  const pos = useRef(movingCars.map(c => ({ x: c.x, z: c.z })))

  useFrame((_, dt) => {
    movingCars.forEach((car, i) => {
      const p = pos.current[i]
      if (car.type === 'ns') {
        p.z += car.speed * dt
        if (p.z > gridD) p.z -= gridD
        if (p.z < 0)     p.z += gridD
      } else {
        p.x += car.speed * dt
        if (p.x > gridW) p.x -= gridW
        if (p.x < 0)     p.x += gridW
      }
      const g = movingRefs.current[i]
      if (g) { g.position.x = p.x; g.position.z = p.z }
    })
  })

  return (
    <>
      {movingCars.map((car, i) => (
        <group key={`mc-${i}`}
               ref={el => movingRefs.current[i] = el}
               position={[car.x, 0.175, car.z]}
               rotation={[0, car.rotY, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.9, 0.35, 1.8]} />
            <meshStandardMaterial color={car.color} roughness={0.4} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0.33, 0.1]} castShadow>
            <boxGeometry args={[0.72, 0.3, 0.95]} />
            <meshStandardMaterial color={car.color} roughness={0.3} metalness={0.3} />
          </mesh>
        </group>
      ))}
      {parkedCars.map((car, i) => (
        <group key={`pc-${i}`}
               position={[car.x, 0.175, car.z]}
               rotation={[0, car.rotY, 0]}>
          <mesh castShadow>
            <boxGeometry args={[0.9, 0.35, 1.8]} />
            <meshStandardMaterial color={car.color} roughness={0.4} metalness={0.4} />
          </mesh>
          <mesh position={[0, 0.33, 0.1]} castShadow>
            <boxGeometry args={[0.72, 0.3, 0.95]} />
            <meshStandardMaterial color={car.color} roughness={0.3} metalness={0.3} />
          </mesh>
        </group>
      ))}
    </>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function CityGrid({ wallets = null, onBuildingClick = null, hideLabels = false }) {
  const { cols, rows, gridW, gridD, nsX, ewZ } = useMemo(() => {
    const n = wallets ? wallets.length : 20
    return computeGrid(n)
  }, [wallets])

  const buildings = useMemo(() => {
    if (wallets && wallets.length > 0) {
      return normalizeWallets(wallets, cols, rows)
    }
    return genPlaceholderData(cols, rows)
  }, [wallets, cols, rows])

  const tex = useMemo(() => ({
    nsRoad: makeNSRoadTex(gridD),
    ewRoad: makeEWRoadTex(gridW),
    cwEW:   makeCrosswalkTex(true),
    cwNS:   makeCrosswalkTex(false),
  }), [gridW, gridD])

  const lightPositions = useMemo(() =>
    nsX.flatMap(x => ewZ.map(z => [x - STREET / 2, 0, z - STREET / 2])),
    [nsX, ewZ]
  )

  // ── Trees across corners, street edges, and sidewalk-adjacent spaces ──────
  const treePositions = useMemo(() => {
    const rnd = mulberry32(0xBEEF1234)
    const off = STREET / 2 + SIDEWALK + 0.5  // offset from road centre
    const candidates = []

    // 4 corners per intersection
    nsX.forEach(x => ewZ.forEach(z => {
      candidates.push([x - off, 0, z - off])
      candidates.push([x + off, 0, z - off])
      candidates.push([x - off, 0, z + off])
      candidates.push([x + off, 0, z + off])
    }))

    // Mid-block along N-S streets
    nsX.forEach(x => {
      for (let i = 0; i < ewZ.length - 1; i++) {
        const mz = (ewZ[i] + ewZ[i + 1]) / 2
        candidates.push([x - off, 0, mz])
        candidates.push([x + off, 0, mz])
        candidates.push([x - off, 0, mz - CELL_D * 0.22])
        candidates.push([x + off, 0, mz - CELL_D * 0.22])
        candidates.push([x - off, 0, mz + CELL_D * 0.22])
        candidates.push([x + off, 0, mz + CELL_D * 0.22])
      }
    })

    // Mid-block along E-W streets
    ewZ.forEach(z => {
      for (let i = 0; i < nsX.length - 1; i++) {
        const mx = (nsX[i] + nsX[i + 1]) / 2
        candidates.push([mx, 0, z - off])
        candidates.push([mx, 0, z + off])
        candidates.push([mx - CELL_W * 0.22, 0, z - off])
        candidates.push([mx - CELL_W * 0.22, 0, z + off])
        candidates.push([mx + CELL_W * 0.22, 0, z - off])
        candidates.push([mx + CELL_W * 0.22, 0, z + off])
      }
    })

    // Sidewalk-adjacent placements along outer edges of building blocks
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const blockX = c * CELL_W + BLOCK_W / 2
        const blockZ = r * CELL_D + BLOCK_D / 2
        const edgeX = BLOCK_W * 0.34
        const edgeZ = BLOCK_D * 0.34

        candidates.push([blockX - edgeX, 0, blockZ - off])
        candidates.push([blockX + edgeX, 0, blockZ - off])
        candidates.push([blockX - edgeX, 0, blockZ + off])
        candidates.push([blockX + edgeX, 0, blockZ + off])
        candidates.push([blockX - off,   0, blockZ - edgeZ])
        candidates.push([blockX - off,   0, blockZ + edgeZ])
        candidates.push([blockX + off,   0, blockZ - edgeZ])
        candidates.push([blockX + off,   0, blockZ + edgeZ])
      }
    }

    // Outer-edge trees at the start/end of each street
    nsX.forEach(x => {
      candidates.push([x - off, 0, BLOCK_D / 2])
      candidates.push([x + off, 0, BLOCK_D / 2])
      candidates.push([x - off, 0, rows * CELL_D - BLOCK_D / 2])
      candidates.push([x + off, 0, rows * CELL_D - BLOCK_D / 2])
    })
    ewZ.forEach(z => {
      candidates.push([BLOCK_W / 2,              0, z - off])
      candidates.push([BLOCK_W / 2,              0, z + off])
      candidates.push([cols * CELL_W - BLOCK_W / 2, 0, z - off])
      candidates.push([cols * CELL_W - BLOCK_W / 2, 0, z + off])
    })

    // Deterministic shuffle → take exactly 150
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1))
      ;[candidates[i], candidates[j]] = [candidates[j], candidates[i]]
    }
    return candidates.slice(0, TREE_COUNT)
  }, [nsX, ewZ, rows, cols])


  return (
    <group>

      {/* ── Ground plane ──────────────────────────────────────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}
            position={[gridW / 2, 0, gridD / 2]}
            receiveShadow
            onClick={() => onBuildingClick?.(null)}>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial color="#2a2a35" roughness={0.95} metalness={0} />
      </mesh>

      {/* ── Sidewalks ─────────────────────────────────────────────────── */}
      {nsX.flatMap((x, i) => [
        <mesh key={`sw-nsl-${i}`} rotation={[-Math.PI / 2, 0, 0]}
              position={[x - STREET / 2 - SIDEWALK / 2, 0.003, gridD / 2]} receiveShadow>
          <planeGeometry args={[SIDEWALK, gridD]} />
          <meshStandardMaterial color="#3a3a3a" roughness={0.95} metalness={0} />
        </mesh>,
        <mesh key={`sw-nsr-${i}`} rotation={[-Math.PI / 2, 0, 0]}
              position={[x + STREET / 2 + SIDEWALK / 2, 0.003, gridD / 2]} receiveShadow>
          <planeGeometry args={[SIDEWALK, gridD]} />
          <meshStandardMaterial color="#3a3a3a" roughness={0.95} metalness={0} />
        </mesh>,
      ])}
      {ewZ.flatMap((z, j) => [
        <mesh key={`sw-ewt-${j}`} rotation={[-Math.PI / 2, 0, 0]}
              position={[gridW / 2, 0.003, z - STREET / 2 - SIDEWALK / 2]} receiveShadow>
          <planeGeometry args={[gridW, SIDEWALK]} />
          <meshStandardMaterial color="#3a3a3a" roughness={0.95} metalness={0} />
        </mesh>,
        <mesh key={`sw-ewb-${j}`} rotation={[-Math.PI / 2, 0, 0]}
              position={[gridW / 2, 0.003, z + STREET / 2 + SIDEWALK / 2]} receiveShadow>
          <planeGeometry args={[gridW, SIDEWALK]} />
          <meshStandardMaterial color="#3a3a3a" roughness={0.95} metalness={0} />
        </mesh>,
      ])}

      {/* ── N-S roads ─────────────────────────────────────────────────── */}
      {nsX.map((x, i) => (
        <mesh key={`ns-${i}`}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[x, 0.005, gridD / 2]}
              receiveShadow>
          <planeGeometry args={[STREET, gridD]} />
          <meshStandardMaterial map={tex.nsRoad} color="#2a2a2a" roughness={0.9} metalness={0} />
        </mesh>
      ))}

      {/* ── E-W roads ─────────────────────────────────────────────────── */}
      {ewZ.map((z, i) => (
        <mesh key={`ew-${i}`}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[gridW / 2, 0.006, z]}
              receiveShadow>
          <planeGeometry args={[gridW, STREET]} />
          <meshStandardMaterial map={tex.ewRoad} color="#2a2a2a" roughness={0.9} metalness={0} />
        </mesh>
      ))}

      {/* ── Intersection patches ──────────────────────────────────────── */}
      {nsX.flatMap((x, i) =>
        ewZ.map((z, j) => (
          <mesh key={`ix-${i}-${j}`}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[x, 0.007, z]}
                receiveShadow>
            <planeGeometry args={[STREET, STREET]} />
            <meshStandardMaterial color="#2a2a2a" roughness={0.9} metalness={0} />
          </mesh>
        ))
      )}

      {/* ── Crosswalks (every other intersection) ────────────────────── */}
      {nsX.flatMap((x, i) =>
        ewZ.flatMap((z, j) => {
          if (i % 2 !== 0 || j % 2 !== 0) return []
          const hw = STREET / 2
          return [
            <mesh key={`cw-w-${i}-${j}`} rotation={[-Math.PI / 2, 0, 0]}
                  position={[x - hw - CW / 2, 0.009, z]} receiveShadow>
              <planeGeometry args={[CW, STREET]} />
              <meshStandardMaterial map={tex.cwEW} roughness={0.9} metalness={0} />
            </mesh>,
            <mesh key={`cw-e-${i}-${j}`} rotation={[-Math.PI / 2, 0, 0]}
                  position={[x + hw + CW / 2, 0.009, z]} receiveShadow>
              <planeGeometry args={[CW, STREET]} />
              <meshStandardMaterial map={tex.cwEW} roughness={0.9} metalness={0} />
            </mesh>,
            <mesh key={`cw-n-${i}-${j}`} rotation={[-Math.PI / 2, 0, 0]}
                  position={[x, 0.009, z - hw - CW / 2]} receiveShadow>
              <planeGeometry args={[STREET, CW]} />
              <meshStandardMaterial map={tex.cwNS} roughness={0.9} metalness={0} />
            </mesh>,
            <mesh key={`cw-s-${i}-${j}`} rotation={[-Math.PI / 2, 0, 0]}
                  position={[x, 0.009, z + hw + CW / 2]} receiveShadow>
              <planeGeometry args={[STREET, CW]} />
              <meshStandardMaterial map={tex.cwNS} roughness={0.9} metalness={0} />
            </mesh>,
          ]
        })
      )}

      {/* ── Buildings (clickable) ─────────────────────────────────────── */}
      {buildings.map(b => (
        <group key={b.id}
               position={[b.x, 0, b.z]}
               onClick={(e) => { e.stopPropagation(); onBuildingClick?.(b) }}>
          <Building
            width={b.width}
            depth={b.depth}
            height={b.height}
            seed={b.seed}
            facadeColor={b.facadeColor}
            litPct={b.litPct}
          />
        </group>
      ))}

      {/* ── Protocol landmark labels ───────────────────────────────────── */}
      {!hideLabels && buildings.filter(b => b.label).map(b => (
        <Html key={`label-${b.id}`}
              position={[b.x, b.height + 4, b.z]}
              center
              style={{ pointerEvents: 'none', userSelect: 'none' }}>
          <div style={{
            background:   'rgba(5,13,32,0.88)',
            border:       '1px solid #65B3AE',
            borderRadius: '4px',
            padding:      '4px 10px',
            color:        '#65B3AE',
            fontFamily:   'monospace',
            fontSize:     '11px',
            lineHeight:   '1.4',
            whiteSpace:   'nowrap',
            textAlign:    'center',
          }}>
            <div style={{ fontWeight: 700 }}>{b.label}</div>
            {b.subtitle && <div style={{ color: '#a0c4c2', fontSize: '10px' }}>{b.subtitle}</div>}
          </div>
        </Html>
      ))}

      {/* ── Street lights at all intersections ────────────────────────── */}
      {lightPositions.map((lp, i) => (
        <StreetLight key={`sl-${i}`} position={lp} />
      ))}

      {/* ── Trees along street edges, corners, and sidewalks ─────────── */}
      {treePositions.map((tp, i) => (
        <Tree key={`tree-${i}`} position={tp} />
      ))}

      {/* ── 190 cars: 150 moving + 40 parked in front of buildings ───── */}
      <AnimatedCars nsX={nsX} ewZ={ewZ} gridW={gridW} gridD={gridD} buildings={buildings} />

      {/* ── 60 simple walkers on sidewalks across the city ────────────── */}
      <AnimatedWalkers nsX={nsX} ewZ={ewZ} gridW={gridW} gridD={gridD} />

      {/* ── Waving flag on tallest building (rank 0, dead centre) ────── */}
      {buildings[0] && (
        <CityFlag
          position={[buildings[0].x, 0, buildings[0].z]}
          buildingHeight={buildings[0].height}
        />
      )}

    </group>
  )
}
