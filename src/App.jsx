import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import CityGrid from './CityGrid.jsx'
import Sky      from './Sky.jsx'
import { useDuneData } from './hooks/useDuneData.js'

const spinnerStyle = `
  @keyframes _spin { to { transform: rotate(360deg); } }
`

export default function App() {
  const { wallets, loading } = useDuneData()

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#000008' }}>
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
      >
        <ambientLight intensity={0.5} color="#ffffff" />
        {/* Replaces the 80 per-lamp point lights — single teal fill across the whole scene */}
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
        <CityGrid wallets={wallets} />

        <OrbitControls
          makeDefault
          target={[54, 0, 66]}
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 2 - 0.05}
          minDistance={5}
          maxDistance={500}
          enableDamping={false}
        />
      </Canvas>
    </div>
  )
}
