import { useMemo } from 'react'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import Building    from './Building.jsx'
import StreetLight from './StreetLight.jsx'
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

// ── Normalize live Dune rows into building data ────────────────────────────────
function normalizeWallets(rows, cols, rows_count) {
  const maxTx  = Math.max(...rows.map(r => r.tx_count || 0), 1)
  const maxVol = Math.max(...rows.map(r => r.total_volume_mnt || 0), 0)

  return rows.map((row, idx) => {
    const addr    = (row.wallet_address || '').toLowerCase()
    const proto   = getProtocolInfo(addr)
    const type    = classifyWallet(row)
    const txNorm  = (row.tx_count || 0) / maxTx
    const volNorm = maxVol > 0.001 ? (row.total_volume_mnt || 0) / maxVol : txNorm

    const isProto = type === 'protocol'
    const height  = isProto ? 40 : 8  + txNorm  * 32
    const size    = isProto ? 8  : 3  + txNorm  * 5
    const litPct  = isProto ? 0.9 : 0.1 + txNorm * 0.7
    const seed    = hashAddress(addr)
    const rnd     = mulberry32(seed)
    const facadeColor = isProto
      ? FACADE_COLORS[0]
      : FACADE_COLORS[Math.floor(rnd() * FACADE_COLORS.length)]

    const c = idx % cols
    const r = Math.floor(idx / cols)

    return {
      id:          addr || `b_${idx}`,
      seed,
      width:       size,
      depth:       size,
      height,
      facadeColor,
      litPct,
      x:           c * CELL_W + BLOCK_W / 2,
      z:           r * CELL_D + BLOCK_D / 2,
      label:       proto ? proto.name    : null,
      subtitle:    proto ? proto.subtitle : null,
      type,
      address:     row.wallet_address,
    }
  })
}

// ── Placeholder building data (used when no live data) ────────────────────────
function genPlaceholderData(cols, rows) {
  const out = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const seed = (c * 97 + r * 31 + 3) * 19
      const rnd  = mulberry32(seed)
      out.push({
        id:          `b_${c}_${r}`,
        seed,
        width:       3 + rnd() * 5,
        depth:       3 + rnd() * 5,
        height:      8 + rnd() * 32,
        facadeColor: FACADE_COLORS[Math.floor(rnd() * 3)],
        litPct:      0.35,
        x:           c * CELL_W + BLOCK_W / 2,
        z:           r * CELL_D + BLOCK_D / 2,
        label:       null,
      })
    }
  }
  return out
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

// ── Landmark label (floating above protocol buildings) ────────────────────────
function LandmarkLabel({ label, subtitle, height }) {
  return (
    <Html
      position={[0, height + 2.5, 0]}
      center
      style={{ pointerEvents: 'none', userSelect: 'none' }}
    >
      <div style={{
        background:   'rgba(5,13,32,0.82)',
        border:       '1px solid #65B3AE',
        borderRadius: '4px',
        padding:      '4px 8px',
        color:        '#65B3AE',
        fontFamily:   'monospace',
        fontSize:     '11px',
        lineHeight:   '1.4',
        whiteSpace:   'nowrap',
        textAlign:    'center',
      }}>
        <div style={{ fontWeight: 700 }}>{label}</div>
        {subtitle && <div style={{ color: '#a0c4c2', fontSize: '10px' }}>{subtitle}</div>}
      </div>
    </Html>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────
export default function CityGrid({ wallets = null }) {
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

  return (
    <group>

      {/* ── Ground plane ──────────────────────────────────────────────────── */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}
            position={[gridW / 2, 0, gridD / 2]}
            receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial color="#1e1e1e" roughness={0.95} metalness={0} />
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

      {/* ── Buildings ────────────────────────────────────────────────────── */}
      {buildings.map(b => (
        <group key={b.id} position={[b.x, 0, b.z]}>
          <Building
            width={b.width}
            depth={b.depth}
            height={b.height}
            seed={b.seed}
            facadeColor={b.facadeColor}
            litPct={b.litPct}
          />
          {b.label && (
            <LandmarkLabel label={b.label} subtitle={b.subtitle} height={b.height} />
          )}
        </group>
      ))}

      {/* ── Street lights at all intersections (NW corner each) ─────────── */}
      {lightPositions.map((pos, i) => (
        <StreetLight key={`sl-${i}`} position={pos} />
      ))}

    </group>
  )
}
