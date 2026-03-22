import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import Building    from './Building.jsx'
import StreetLight from './StreetLight.jsx'
import CityFlag    from './CityFlag.jsx'
import Ocean       from './Ocean.jsx'
import { getProtocolInfo, classifyWallet, WALLET_COLORS } from './utils/walletClassifier.js'

// ── Grid constants ─────────────────────────────────────────────────────────────
const BLOCK_W  = 9
const BLOCK_D  = 9
const STREET   = 3     // 2-lane road width (~1.5 units per lane)
const CW       = 2     // crosswalk depth (pedestrian crossing distance)
const SIDEWALK = 0.6   // pavement strip between road edge and building block

const CELL_W  = BLOCK_W + STREET   // 12
const CELL_D  = BLOCK_D + STREET   // 12

// ── Building facade tones ──────────────────────────────────────────────────────
const FACADE_COLORS = ['#1C1C1E', '#242428', '#2C2C30']

// ── Tree & car palette ─────────────────────────────────────────────────────────
const TREE_COLORS = ['#1A4A1A', '#1E5A1E', '#153515', '#1A4020', '#0F3A0F']
const CAR_COLORS  = ['#3060A0', '#A03030', '#F0C020', '#404048', '#208040', '#8040A0']

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

// Simple hash so each address gets a stable numeric seed
function hashAddress(addr = '') {
  let h = 0x811c9dc5
  for (let i = 0; i < addr.length; i++) {
    h ^= addr.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0) || 1
}

// ── Compute dynamic grid dimensions ───────────────────────────────────────────
function computeGrid(n) {
  const cols  = Math.max(4, Math.floor(Math.sqrt(n)))
  const rows  = Math.ceil(n / cols)
  const gridW = cols * CELL_W
  const gridD = rows * CELL_D
  // N-S road centers (between columns)
  const nsX   = Array.from({ length: cols - 1 }, (_, i) =>
    BLOCK_W + STREET / 2 + i * CELL_W)
  // E-W road centers (between rows)
  const ewZ   = Array.from({ length: rows - 1 }, (_, i) =>
    BLOCK_D + STREET / 2 + i * CELL_D)
  return { cols, rows, gridW, gridD, nsX, ewZ }
}

// ── Normalize live Dune rows into building data (tallest → center) ────────────
function normalizeWallets(rows, cols, rowCount) {
  const maxTx = Math.max(...rows.map(r => r.tx_count || 0), 1)

  // Build normalized objects, sort tallest first
  const normed = rows.map(row => {
    const addr    = (row.wallet_address || '').toLowerCase()
    const proto   = getProtocolInfo(addr)
    const type    = classifyWallet(row)
    const txNorm  = (row.tx_count || 0) / maxTx
    const isProto = type === 'protocol'
    const height  = isProto ? 40 : 8 + txNorm * 32
    const size    = isProto ? 8  : 3 + txNorm * 5
    const litPct  = isProto ? 0.9 : 0.1 + txNorm * 0.7
    const seed    = hashAddress(addr)
    const rnd     = mulberry32(seed)
    const facadeColor = isProto
      ? FACADE_COLORS[0]
      : FACADE_COLORS[Math.floor(rnd() * FACADE_COLORS.length)]
    return { row, addr, proto, type, height, size, litPct, seed, facadeColor,
             txCount: row.tx_count || 0, volume: row.total_volume_mnt || 0 }
  }).sort((a, b) => b.height - a.height)

  // Grid positions sorted closest-to-center first
  const centerC = (cols - 1) / 2
  const centerR = (rowCount - 1) / 2
  const positions = []
  for (let r = 0; r < rowCount; r++)
    for (let c = 0; c < cols; c++)
      positions.push({ c, r, dist: Math.hypot(c - centerC, r - centerR) })
  positions.sort((a, b) => a.dist - b.dist)

  return normed.map((n, idx) => {
    const { c, r } = positions[Math.min(idx, positions.length - 1)]
    return {
      id:          n.addr || `b_${idx}`,
      seed:        n.seed,
      width:       n.size,
      depth:       n.size,
      height:      n.height,
      facadeColor: n.facadeColor,
      litPct:      n.litPct,
      x:           c * CELL_W + BLOCK_W / 2,
      z:           r * CELL_D + BLOCK_D / 2,
      label:       n.proto ? n.proto.name    : null,
      subtitle:    n.proto ? n.proto.subtitle : null,
      type:        n.type,
      address:     n.row.wallet_address,
      txCount:     n.txCount,
      volume:      n.volume,
    }
  })
}

// ── Placeholder building data (tallest → center) ──────────────────────────────
function genPlaceholderData(cols, rows) {
  const out = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seed = (c * 97 + r * 31 + 3) * 19
      const rnd  = mulberry32(seed)
      out.push({ id: `b_${c}_${r}`, seed, width: 3 + rnd() * 5, depth: 3 + rnd() * 5,
        height: 8 + rnd() * 32, facadeColor: FACADE_COLORS[Math.floor(rnd() * 3)],
        litPct: 0.35, label: null, txCount: 0, volume: 0 })
    }
  }
  out.sort((a, b) => b.height - a.height)
  const centerC = (cols - 1) / 2
  const centerR = (rows - 1) / 2
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

// ── Texture factories ──────────────────────────────────────────────────────────
function makeNSRoadTex(gridD) {
  const W = 128
  const H = Math.min(Math.ceil(gridD * 12.8), 4096)
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#2a2a2a'
  ctx.fillRect(0, 0, W, H)
  // centre dashed divider only — no solid edge lines
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
  // centre dashed divider only — no solid edge lines
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  const dashW = 44, gapW = 52
  for (let x = 0; x < W; x += dashW + gapW) ctx.fillRect(x, H / 2 - 1, dashW, 2)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function makeCrosswalkTex(ewApproach) {
  // 5 stripes, 28% coverage — clean zebra, not parking-lot dense
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
    // stripes run in V (road-width direction); repeat in U (crossing direction)
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

// ── Tree ──────────────────────────────────────────────────────────────────────
function Tree({ position, colorIdx = 0 }) {
  const color = TREE_COLORS[colorIdx % TREE_COLORS.length]
  return (
    <group position={position}>
      <mesh position={[0, 0.65, 0]} castShadow>
        <cylinderGeometry args={[0.1, 0.18, 1.3, 6]} />
        <meshStandardMaterial color="#5C4033" roughness={0.9} metalness={0} />
      </mesh>
      <mesh position={[0, 2.1, 0]} castShadow>
        <coneGeometry args={[0.7, 2.0, 7]} />
        <meshStandardMaterial color={color} roughness={0.8} metalness={0} />
      </mesh>
    </group>
  )
}

// ── AnimatedCars — loop along roads every frame ───────────────────────────────
function AnimatedCars({ nsX, ewZ, gridW, gridD }) {
  const carData = useMemo(() => {
    const rnd = mulberry32(0xCAFE)
    const out = []
    nsX.forEach(x => {
      for (let n = 0; n < 3; n++) {
        const lane  = rnd() > 0.5 ? -0.72 : 0.72
        const speed = (5 + rnd() * 8) * (rnd() > 0.5 ? 1 : -1)
        out.push({ type: 'ns', x: x + lane, z: rnd() * gridD,
          speed, colorIdx: Math.floor(rnd() * CAR_COLORS.length),
          rotY: speed > 0 ? 0 : Math.PI })
      }
    })
    ewZ.forEach(z => {
      for (let n = 0; n < 3; n++) {
        const lane  = rnd() > 0.5 ? -0.72 : 0.72
        const speed = (5 + rnd() * 8) * (rnd() > 0.5 ? 1 : -1)
        out.push({ type: 'ew', x: rnd() * gridW, z: z + lane,
          speed, colorIdx: Math.floor(rnd() * CAR_COLORS.length),
          rotY: speed > 0 ? -Math.PI / 2 : Math.PI / 2 })
      }
    })
    return out
  }, [nsX, ewZ, gridW, gridD])

  const groupRefs = useRef([])
  const pos = useRef(carData.map(c => ({ x: c.x, z: c.z })))

  useFrame((_, dt) => {
    carData.forEach((car, i) => {
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
      const g = groupRefs.current[i]
      if (g) { g.position.x = p.x; g.position.z = p.z }
    })
  })

  return (
    <>
      {carData.map((car, i) => {
        const color = CAR_COLORS[car.colorIdx % CAR_COLORS.length]
        return (
          <group key={i} ref={el => groupRefs.current[i] = el}
                 position={[car.x, 0.175, car.z]} rotation={[0, car.rotY, 0]}>
            <mesh castShadow>
              <boxGeometry args={[0.9, 0.35, 1.8]} />
              <meshStandardMaterial color={color} roughness={0.4} metalness={0.4} />
            </mesh>
            <mesh position={[0, 0.33, 0.1]} castShadow>
              <boxGeometry args={[0.72, 0.3, 0.95]} />
              <meshStandardMaterial color={color} roughness={0.3} metalness={0.3} />
            </mesh>
          </group>
        )
      })}
    </>
  )
}

// LandmarkLabel removed — labels now rendered at absolute world positions outside building groups

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

  // Street light positions: NW corner of each intersection
  const lightPositions = useMemo(() =>
    nsX.flatMap(x => ewZ.map(z => [x - STREET / 2, 0, z - STREET / 2])),
    [nsX, ewZ]
  )

  // Tree positions: seeded random corners at each intersection
  const treePositions = useMemo(() => {
    const rnd = mulberry32(0xDEAD)
    const out = []
    nsX.forEach(x => ewZ.forEach(z => {
      const corners = [
        [x - STREET / 2 - 1.2, z - STREET / 2 - 1.2],
        [x + STREET / 2 + 1.2, z - STREET / 2 - 1.2],
        [x - STREET / 2 - 1.2, z + STREET / 2 + 1.2],
        [x + STREET / 2 + 1.2, z + STREET / 2 + 1.2],
      ]
      corners.forEach(([tx, tz]) => {
        if (rnd() > 0.35)
          out.push({ x: tx, z: tz, colorIdx: Math.floor(rnd() * TREE_COLORS.length) })
      })
    }))
    return out
  }, [nsX, ewZ])


  return (
    <group>

      {/* ── Ground plane (also dismisses popup on click) ──────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}
            position={[gridW / 2, 0, gridD / 2]}
            receiveShadow
            onClick={() => onBuildingClick?.(null)}>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.95} metalness={0} />
      </mesh>

      {/* ── Sidewalks: narrow pavement strip on each side of every road ────── */}
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

      {/* ── N-S roads ──────────────────────────────────────────────────────── */}
      {nsX.map((x, i) => (
        <mesh key={`ns-${i}`}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[x, 0.005, gridD / 2]}
              receiveShadow>
          <planeGeometry args={[STREET, gridD]} />
          <meshStandardMaterial map={tex.nsRoad} color="#2a2a2a" roughness={0.9} metalness={0} />
        </mesh>
      ))}

      {/* ── E-W roads ──────────────────────────────────────────────────────── */}
      {ewZ.map((z, i) => (
        <mesh key={`ew-${i}`}
              rotation={[-Math.PI / 2, 0, 0]}
              position={[gridW / 2, 0.006, z]}
              receiveShadow>
          <planeGeometry args={[gridW, STREET]} />
          <meshStandardMaterial map={tex.ewRoad} color="#2a2a2a" roughness={0.9} metalness={0} />
        </mesh>
      ))}

      {/* ── Intersection patches ─────────────────────────────────────────── */}
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

      {/* ── Crosswalks — only where a N-S road AND an E-W road both exist ── */}
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

      {/* ── Buildings (clickable) ────────────────────────────────────────── */}
      {buildings.map(b => (
        <group
          key={b.id}
          position={[b.x, 0, b.z]}
          onClick={(e) => { e.stopPropagation(); onBuildingClick?.(b) }}
        >
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

      {/* ── Protocol landmark labels — hidden when popup is open */}
      {!hideLabels && buildings.filter(b => b.label).map(b => (
        <Html
          key={`label-${b.id}`}
          position={[b.x, b.height + 4, b.z]}
          center
          style={{ pointerEvents: 'none', userSelect: 'none' }}
        >
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

      {/* ── Street lights at all intersections (NW corner each) ─────────── */}
      {lightPositions.map((pos, i) => (
        <StreetLight key={`sl-${i}`} position={pos} />
      ))}

      {/* ── Trees at intersection corners ────────────────────────────────── */}
      {treePositions.map((t, i) => (
        <Tree key={`tree-${i}`} position={[t.x, 0, t.z]} colorIdx={t.colorIdx} />
      ))}

      {/* ── Animated cars looping along roads ────────────────────────────── */}
      <AnimatedCars nsX={nsX} ewZ={ewZ} gridW={gridW} gridD={gridD} />

      {/* ── Waving flag on tallest building (always buildings[0]) ─────────── */}
      {buildings[0] && (
        <CityFlag
          position={[buildings[0].x, 0, buildings[0].z]}
          buildingHeight={buildings[0].height}
        />
      )}

      {/* ── Ocean along the city's -Z waterfront edge ────────────────────── */}
      <Ocean gridW={gridW} />

    </group>
  )
}
