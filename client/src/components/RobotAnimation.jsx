import { useEffect, useState } from 'react'
import './RobotAnimation.css'

const CONVEYOR_ITEMS = [
  { color: '#E8537A', width: 18 },
  { color: '#3498DB', width: 14 },
  { color: '#2ECC71', width: 16 },
  { color: '#F39C12', width: 12 },
  { color: '#9B59B6', width: 15 },
  { color: '#E74C3C', width: 13 },
  { color: '#1ABC9C', width: 17 },
]

export default function RobotAnimation({ isComplete }) {
  const [showStars, setShowStars] = useState(false)

  useEffect(() => {
    if (isComplete) {
      const t = setTimeout(() => setShowStars(true), 200)
      return () => clearTimeout(t)
    }
    setShowStars(false)
  }, [isComplete])

  return (
    <div className={`robot ${isComplete ? 'robot--complete' : ''}`} aria-hidden="true">
      <svg viewBox="0 0 200 180" width="200" height="180" className="robot__svg">
        {/* Antenna */}
        <line x1="100" y1="16" x2="100" y2="30" stroke="#2C023B" strokeWidth="2" strokeLinecap="round" />
        <circle cx="100" cy="12" r="4" fill="#E8537A" className="robot__antenna-tip" />

        {/* Head */}
        <rect x="70" y="30" width="60" height="44" rx="10" fill="#E8537A" className="robot__head" />

        {/* Eyes */}
        {showStars ? (
          <>
            {/* Star eyes */}
            <polygon points="88,48 90,53 95,53 91,56 92,61 88,58 84,61 85,56 81,53 86,53" fill="#FFD700" className="robot__star-eye" />
            <polygon points="112,48 114,53 119,53 115,56 116,61 112,58 108,61 109,56 105,53 110,53" fill="#FFD700" className="robot__star-eye" />
          </>
        ) : (
          <>
            <circle cx="88" cy="52" r="6" fill="#2C023B" className="robot__eye robot__eye--left" />
            <circle cx="112" cy="52" r="6" fill="#2C023B" className="robot__eye robot__eye--right" />
            {/* Eye shine */}
            <circle cx="90" cy="50" r="2" fill="#fff" opacity="0.7" />
            <circle cx="114" cy="50" r="2" fill="#fff" opacity="0.7" />
          </>
        )}

        {/* Mouth */}
        {isComplete ? (
          <path d="M90 64 Q100 72 110 64" stroke="#2C023B" strokeWidth="2" fill="none" strokeLinecap="round" />
        ) : (
          <rect x="92" y="64" width="16" height="3" rx="1.5" fill="#2C023B" opacity="0.6" />
        )}

        {/* Body */}
        <rect x="65" y="78" width="70" height="50" rx="8" fill="#E8537A" />
        {/* Body detail lines */}
        <rect x="80" y="88" width="40" height="4" rx="2" fill="#C7345A" opacity="0.4" />
        <rect x="85" y="96" width="30" height="4" rx="2" fill="#C7345A" opacity="0.4" />
        <rect x="80" y="104" width="40" height="4" rx="2" fill="#C7345A" opacity="0.4" />

        {/* Left Arm */}
        <g className="robot__arm robot__arm--left">
          <rect x="42" y="82" width="20" height="10" rx="5" fill="#C7345A" />
          <rect x="36" y="80" width="10" height="14" rx="5" fill="#C7345A" />
        </g>

        {/* Right Arm */}
        <g className="robot__arm robot__arm--right">
          <rect x="138" y="82" width="20" height="10" rx="5" fill="#C7345A" />
          <rect x="154" y="80" width="10" height="14" rx="5" fill="#C7345A" />
        </g>

        {/* Legs */}
        <rect x="78" y="128" width="14" height="16" rx="4" fill="#C7345A" />
        <rect x="108" y="128" width="14" height="16" rx="4" fill="#C7345A" />

        {/* Feet */}
        <rect x="74" y="140" width="22" height="8" rx="4" fill="#2C023B" />
        <rect x="104" y="140" width="22" height="8" rx="4" fill="#2C023B" />

        {/* Conveyor Belt */}
        <rect x="10" y="155" width="180" height="8" rx="4" fill="#EDE8F2" />
        <rect x="10" y="155" width="180" height="8" rx="4" fill="url(#conveyorGrad)" opacity="0.5" />

        {/* Conveyor items */}
        <g className="robot__conveyor">
          {CONVEYOR_ITEMS.map((item, i) => (
            <rect
              key={i}
              x={i * 30}
              y={150 - (item.width / 2)}
              width={item.width}
              height={item.width}
              rx={3}
              fill={item.color}
              opacity="0.8"
              className="robot__conveyor-item"
              style={{ animationDelay: `${i * 0.2}s` }}
            />
          ))}
        </g>

        <defs>
          <linearGradient id="conveyorGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#D4CBDF" />
            <stop offset="50%" stopColor="#EDE8F2" />
            <stop offset="100%" stopColor="#D4CBDF" />
          </linearGradient>
        </defs>
      </svg>
    </div>
  )
}
