import { useState, useEffect } from 'react'

const TEAL = '#65B3AE'
const BG   = '#0c1a1a'

// Mantle spoke-wheel logo — 20 alternating long/short spokes
function MantleLogo() {
  const spokes = Array.from({ length: 20 }, (_, i) => {
    const angle = (i / 20) * 360
    const oR    = i % 2 === 0 ? 36 : 28
    const iR    = i % 2 === 0 ? 14 : 18
    return (
      <rect
        key={i}
        x={38} y={40 - oR}
        width={4} height={oR - iR}
        rx={1.5}
        fill={TEAL}
        transform={`rotate(${angle} 40 40)`}
      />
    )
  })
  return (
    <svg viewBox="0 0 80 80" width="80" height="80"
         style={{ animation: 'mantleSpin 3s linear infinite', display: 'block' }}>
      {spokes}
    </svg>
  )
}

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

      <style>{`
        @keyframes mantleSpin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>

      {/* ── Spinning Mantle logo ─────────────────────────── */}
      <div style={{ marginBottom: '28px' }}>
        <MantleLogo />
      </div>

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
        bottom:        '40px',
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

    </div>
  )
}
