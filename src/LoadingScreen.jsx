import { useState, useEffect } from 'react'

const TEAL = '#65B3AE'
const BG   = '#050d2e'

// City silhouette — [x, width, height] in 1280×200 viewBox
const BUILDINGS = [
  [0,40,55],[45,25,80],[75,55,45],[135,20,105],[160,35,65],
  [200,30,130],[235,25,75],[265,50,55],[320,18,95],[343,40,50],
  [390,28,145],[423,22,70],[450,45,85],[500,38,115],[543,28,60],
  [576,22,140],[603,42,52],[650,32,80],[687,48,95],[740,22,65],
  [768,38,125],[812,28,58],[845,50,70],[900,20,105],[926,38,48],
  [969,32,85],[1006,42,115],[1053,28,65],[1086,48,80],
  [1140,25,100],[1170,38,60],[1213,42,75],[1260,20,50],
]

export default function LoadingScreen({ loading }) {
  const [progress, setProgress] = useState(0)
  const [fading,   setFading]   = useState(false)
  const [gone,     setGone]     = useState(false)

  // Crawl to 85 while loading; sprint to 100 when done
  useEffect(() => {
    const id = setInterval(() => {
      setProgress(p => {
        if (loading) return Math.min(p + 0.9, 85)
        const next = Math.min(p + 5, 100)
        if (next >= 100) clearInterval(id)
        return next
      })
    }, 40)
    return () => clearInterval(id)
  }, [loading])

  // Fade out once at 100%
  useEffect(() => {
    if (progress >= 100 && !fading) {
      setFading(true)
      setTimeout(() => setGone(true), 750)
    }
  }, [progress, fading])

  if (gone) return null

  return (
    <div style={{
      position:       'fixed',
      inset:          0,
      background:     BG,
      display:        'flex',
      flexDirection:  'column',
      alignItems:     'center',
      justifyContent: 'center',
      zIndex:         9999,
      fontFamily:     "'Share Tech Mono', 'Courier New', monospace",
      opacity:        fading ? 0 : 1,
      transition:     'opacity 0.75s ease',
      overflow:       'hidden',
      userSelect:     'none',
    }}>

      {/* ── Title ───────────────────────────────────────── */}
      <div style={{
        fontSize:      '38px',
        fontWeight:    700,
        color:         TEAL,
        letterSpacing: '0.32em',
        marginBottom:  '20px',
      }}>
        MANTLE CITY
      </div>

      {/* ── Loading line ─────────────────────────────────── */}
      <div style={{
        fontSize:      '12px',
        color:         TEAL,
        letterSpacing: '0.22em',
        marginBottom:  '20px',
        opacity:       0.82,
      }}>
        FETCHING WALLETS...
      </div>

      {/* ── Progress bar ─────────────────────────────────── */}
      <div style={{
        width:        '240px',
        height:       '7px',
        background:   '#091828',
        border:       '1px solid #1a3860',
        overflow:     'hidden',
      }}>
        <div style={{
          height:     '100%',
          width:      `${progress}%`,
          background: TEAL,
          transition: 'width 0.04s linear',
        }} />
      </div>

      {/* ── Tagline ──────────────────────────────────────── */}
      <div style={{
        position:      'absolute',
        bottom:        '130px',
        color:         TEAL,
        opacity:       0.42,
        fontSize:      '10px',
        letterSpacing: '0.16em',
        textAlign:     'center',
        maxWidth:      '500px',
        lineHeight:    '1.9',
        fontVariant:   'small-caps',
      }}>
        CLICK ANY BUILDING TO SEE THE TOP 500 WALLETS ON THE MANTLE BLOCKCHAIN
      </div>

      {/* ── City silhouette ──────────────────────────────── */}
      <svg
        viewBox="0 0 1280 200"
        preserveAspectRatio="xMidYMax slice"
        style={{ position: 'absolute', bottom: 0, left: 0, width: '100%', height: '200px' }}
      >
        {BUILDINGS.map(([x, w, h], i) => (
          <rect key={i} x={x} y={200 - h} width={w} height={h} fill="#0c1e42" />
        ))}
      </svg>

    </div>
  )
}
