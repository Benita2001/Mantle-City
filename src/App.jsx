import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { useState } from 'react'
import CityGrid from './CityGrid.jsx'
import Sky      from './Sky.jsx'
import { useDuneData } from './hooks/useDuneData.js'
import { formatAddress, formatVolume } from './utils/walletClassifier.js'

const spinnerStyle = `
  @keyframes _spin { to { transform: rotate(360deg); } }
`

export default function App() {
  const { wallets, loading } = useDuneData()
  const [selected, setSelected] = useState(null)

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#050D20' }}>
      <style>{spinnerStyle}</style>

      {loading && (
        <div style={{
          position:       'absolute',
          inset:          0,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          zIndex:         10,
          background:     'rgba(0,0,8,0.85)',
          color:          '#65B3AE',
          fontFamily:     'monospace',
          gap:            '16px',
        }}>
          <div style={{
            width:           '40px',
            height:          '40px',
            border:          '3px solid #0d2030',
            borderTop:       '3px solid #65B3AE',
            borderRadius:    '50%',
            animation:       '_spin 0.9s linear infinite',
          }} />
          <div style={{ fontSize: '13px', letterSpacing: '0.08em' }}>
            Loading Mantle City...
          </div>
        </div>
      )}

      <Canvas
        camera={{ position: [54, 70, 160], fov: 50 }}
        onCreated={({ camera, scene }) => { camera.lookAt(54, 0, 66); scene.background = new THREE.Color('#050D20') }}
        gl={{ antialias: true, toneMapping: 4 /* ACESFilmic */ }}
        shadows
        onPointerMissed={() => setSelected(null)}
      >
        <ambientLight intensity={0.5} color="#ffffff" />
        {/* Night fill — teal sky, dark ground */}
        <hemisphereLight args={['#65B3AE', '#0d1117', 0.18]} />
        <directionalLight
          position={[30, 60, 40]}
          intensity={0.8}
          color="#d0e0ff"
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-near={1}
          shadow-camera-far={600}
          shadow-camera-left={-30}
          shadow-camera-right={240}
          shadow-camera-top={280}
          shadow-camera-bottom={-40}
        />

        <Sky />
        <CityGrid wallets={wallets} onBuildingClick={setSelected} />

        <OrbitControls
          makeDefault
          target={[54, 0, 66]}
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minDistance={10}
          maxDistance={150}
          enableDamping={false}
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
          <div><span style={{ color: '#6e7681' }}>Txns     </span>{(selected.txCount || 0).toLocaleString()}</div>
          <div style={{ marginBottom: '14px' }}><span style={{ color: '#6e7681' }}>Volume   </span>{formatVolume(selected.volume || 0)}</div>
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
