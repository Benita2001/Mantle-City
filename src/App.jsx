import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useState, useRef, useEffect, useMemo } from 'react'
import CityGrid  from './CityGrid.jsx'
import Sky       from './Sky.jsx'
import Birds     from './Birds.jsx'
import Airplane  from './Airplane.jsx'
import { useDuneData } from './hooks/useDuneData.js'
import { formatAddress } from './utils/walletClassifier.js'
import LoadingScreen from './LoadingScreen.jsx'

// ── Slow auto-orbit — pauses on interaction, resumes after 3 s ───────────────
function CameraDrift() {
  const { controls } = useThree()
  const lastInteract = useRef(0)   // 0 → drift starts immediately on load

  useEffect(() => {
    if (!controls) return
    controls.autoRotateSpeed = 0.3
    const onStart = () => { lastInteract.current = Date.now() }
    controls.addEventListener('start', onStart)
    return () => controls.removeEventListener('start', onStart)
  }, [controls])

  useFrame(() => {
    if (!controls) return
    controls.autoRotate = Date.now() - lastInteract.current > 3000
  })

  return null
}

export default function App() {
  const { wallets, loading } = useDuneData()
  const [selected, setSelected] = useState(null)
  const stats = useMemo(() => {
    const totalWallets = wallets?.length || 0
    const totalTxCount = (wallets || []).reduce((sum, wallet) => sum + (wallet.tx_count || 0), 0)
    return { totalWallets, totalTxCount }
  }, [wallets])

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#050D20' }}>
      <LoadingScreen loading={loading} />

      <div style={{
        position: 'fixed',
        top: '18px',
        right: '18px',
        zIndex: 900,
        display: 'grid',
        gap: '10px',
        pointerEvents: 'none',
      }}>
        <div style={{
          minWidth: '150px',
          padding: '10px 14px',
          background: 'rgba(8, 16, 28, 0.82)',
          border: '1px solid rgba(101, 179, 174, 0.42)',
          borderRadius: '8px',
          boxShadow: '0 0 18px rgba(101, 179, 174, 0.10)',
          backdropFilter: 'blur(8px)',
          color: '#c9d1d9',
          fontFamily: "'Share Tech Mono', 'Courier New', monospace",
        }}>
          <div style={{ fontSize: '10px', letterSpacing: '0.14em', color: '#65B3AE', marginBottom: '4px' }}>
            TOTAL WALLETS
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>
            {stats.totalWallets.toLocaleString()}
          </div>
        </div>

        <div style={{
          minWidth: '170px',
          padding: '10px 14px',
          background: 'rgba(8, 16, 28, 0.82)',
          border: '1px solid rgba(101, 179, 174, 0.42)',
          borderRadius: '8px',
          boxShadow: '0 0 18px rgba(101, 179, 174, 0.10)',
          backdropFilter: 'blur(8px)',
          color: '#c9d1d9',
          fontFamily: "'Share Tech Mono', 'Courier New', monospace",
        }}>
          <div style={{ fontSize: '10px', letterSpacing: '0.14em', color: '#65B3AE', marginBottom: '4px' }}>
            TOTAL TX COUNT
          </div>
          <div style={{ fontSize: '18px', fontWeight: 700 }}>
            {stats.totalTxCount.toLocaleString()}
          </div>
        </div>
      </div>

      <a
        href="https://x.com/0x_beni_"
        target="_blank"
        rel="noreferrer"
        style={{
          position: 'fixed',
          left: '18px',
          bottom: '18px',
          zIndex: 900,
          padding: '8px 12px',
          background: 'rgba(8, 16, 28, 0.78)',
          border: '1px solid rgba(101, 179, 174, 0.34)',
          borderRadius: '999px',
          boxShadow: '0 0 14px rgba(101, 179, 174, 0.08)',
          backdropFilter: 'blur(8px)',
          color: '#65B3AE',
          fontFamily: "'Share Tech Mono', 'Courier New', monospace",
          fontSize: '11px',
          letterSpacing: '0.08em',
          textDecoration: 'none',
        }}
      >
        by Benita
      </a>

      <Canvas
        camera={{ position: [0, 80, 250], fov: 50 }}
        onCreated={({ camera, scene }) => { camera.lookAt(0, 0, 0); scene.background = new THREE.Color('#0d1b3e') }}
        gl={{ antialias: true, toneMapping: 4 /* ACESFilmic */ }}
        shadows
        onPointerMissed={() => setSelected(null)}
      >
        <ambientLight intensity={0.5} color="#c8d8f0" />
        {/* Night fill — deep blue sky, dark ground */}
        <hemisphereLight args={['#1a4a90', '#090e18', 0.22]} />
        <directionalLight
          position={[30, 60, 40]}
          intensity={0.65}
          color="#b8c8e8"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={1}
          shadow-camera-far={600}
          shadow-camera-left={-30}
          shadow-camera-right={240}
          shadow-camera-top={380}
          shadow-camera-bottom={-40}
        />

        <CameraDrift />
        <Sky />
        <CityGrid wallets={wallets} onBuildingClick={setSelected} hideLabels={selected !== null} />
        <Birds cx={84} cz={90} />
        <Airplane cx={84} cz={90} />

        <OrbitControls
          makeDefault
          target={[84, 0, 120]}
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minDistance={10}
          maxDistance={300}
          enableDamping
          dampingFactor={0.05}
          autoRotate
          autoRotateSpeed={0.3}
        />
      </Canvas>

      {/* ── Building popup modal ────────────────────────────────────────── */}
      {selected && (
        <>
          {/* Dim overlay — click to dismiss */}
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 999 }}
            onClick={() => setSelected(null)}
          />
          <div style={{
            position:      'fixed',
            top:           '50%',
            left:          '50%',
            transform:     'translate(-50%, -50%)',
            background:    '#0d1117',
            border:        '1px solid #65B3AE',
            borderRadius:  '10px',
            padding:       '24px 28px',
            color:         '#c9d1d9',
            fontFamily:    'monospace',
            fontSize:      '13px',
            lineHeight:    '1.8',
            zIndex:        1000,
            minWidth:      '320px',
            boxShadow:     '0 8px 48px rgba(0,0,0,0.9)',
            pointerEvents: 'auto',
          }}>
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
            <div>
              <div style={{ color: '#65B3AE', fontWeight: 700, fontSize: '14px' }}>
                {selected.label || formatAddress(selected.address)}
              </div>
              {selected.subtitle && (
                <div style={{ color: '#4a9490', fontSize: '11px' }}>{selected.subtitle}</div>
              )}
            </div>
            <button
              onClick={() => setSelected(null)}
              style={{ background: 'none', border: 'none', color: '#65B3AE', cursor: 'pointer', fontSize: '20px', lineHeight: 1, padding: '0 0 0 12px' }}
            >×</button>
          </div>
          {/* Fields */}
          <div><span style={{ color: '#6e7681' }}>Address  </span>{formatAddress(selected.address)}</div>
          <div style={{ marginBottom: '14px' }}><span style={{ color: '#6e7681' }}>Txns     </span>{(selected.txCount || 0).toLocaleString()}</div>
          {/* Explorer link */}
          <a
            href={`https://explorer.mantle.xyz/address/${selected.address}`}
            target="_blank"
            rel="noreferrer"
            style={{
              display:        'block',
              textAlign:      'center',
              color:          '#65B3AE',
              border:         '1px solid #65B3AE',
              borderRadius:   '4px',
              padding:        '6px 0',
              textDecoration: 'none',
              fontSize:       '12px',
              letterSpacing:  '0.04em',
            }}
          >
            View on Mantle Explorer →
          </a>
        </div>
        </>
      )}
    </div>
  )
}
