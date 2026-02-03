import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

type CelebrationType = 'eagle' | 'birdie' | null

interface CelebrationProps {
  type: CelebrationType
  onComplete?: () => void
}

interface Particle {
  id: number
  x: number
  y: number
  color: string
  angle: number
  velocity: number
  rotation: number
  rotationSpeed: number
  size: number
}

// Golf-themed colors
const EAGLE_COLORS = ['#fbbf24', '#f59e0b', '#d97706', '#fcd34d', '#fef3c7'] // Gold/amber
const BIRDIE_COLORS = ['#22c55e', '#16a34a', '#15803d', '#86efac', '#dcfce7'] // Green

export function Celebration({ type, onComplete }: CelebrationProps) {
  const [particles, setParticles] = useState<Particle[]>([])
  const [showGlow, setShowGlow] = useState(false)

  const createParticles = useCallback((count: number, colors: string[]) => {
    const newParticles: Particle[] = []
    for (let i = 0; i < count; i++) {
      newParticles.push({
        id: i,
        x: 50, // Start from center (%)
        y: 50,
        color: colors[Math.floor(Math.random() * colors.length)],
        angle: (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.5,
        velocity: 8 + Math.random() * 8,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 20,
        size: 8 + Math.random() * 8,
      })
    }
    return newParticles
  }, [])

  useEffect(() => {
    if (!type) {
      setParticles([])
      setShowGlow(false)
      return
    }

    if (type === 'eagle') {
      // Big confetti burst for eagle
      setParticles(createParticles(40, EAGLE_COLORS))
      setShowGlow(true)
    } else if (type === 'birdie') {
      // Smaller celebration for birdie
      setParticles(createParticles(20, BIRDIE_COLORS))
      setShowGlow(true)
    }

    // Clear after animation
    const timer = setTimeout(() => {
      setParticles([])
      setShowGlow(false)
      onComplete?.()
    }, type === 'eagle' ? 2000 : 1500)

    return () => clearTimeout(timer)
  }, [type, createParticles, onComplete])

  if (!type && particles.length === 0) return null

  // Use portal to render at body level, escaping any transform contexts
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-50 overflow-hidden">
      {/* Glow effect */}
      {showGlow && (
        <div
          className={cn(
            "absolute inset-0 animate-pulse-glow",
            type === 'eagle' ? "bg-amber-500/20" : "bg-green-500/15"
          )}
        />
      )}

      {/* Particles */}
      {particles.map((particle) => (
        <ConfettiParticle key={particle.id} particle={particle} type={type} />
      ))}

      {/* Score flash text */}
      {showGlow && (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className={cn(
              "animate-score-pop rounded-2xl px-8 py-4 text-5xl font-black tracking-tight shadow-2xl",
              type === 'eagle'
                ? "bg-amber-500 text-white"
                : "bg-green-500 text-white"
            )}
          >
            {type === 'eagle' ? '🦅 EAGLE!' : '🐦 BIRDIE!'}
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

function ConfettiParticle({ particle, type }: { particle: Particle; type: CelebrationType }) {
  const [position, setPosition] = useState({ x: particle.x, y: particle.y, rotation: particle.rotation, opacity: 1 })

  useEffect(() => {
    let frame: number
    let startTime = Date.now()
    const duration = type === 'eagle' ? 2000 : 1500
    const gravity = 0.15

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = elapsed / duration

      if (progress >= 1) return

      const t = elapsed / 16 // Normalize to ~60fps
      const newX = particle.x + Math.cos(particle.angle) * particle.velocity * progress * 30
      const newY = particle.y + Math.sin(particle.angle) * particle.velocity * progress * 30 + gravity * t * t * 0.5
      const newRotation = particle.rotation + particle.rotationSpeed * t
      const newOpacity = 1 - progress * progress // Ease out opacity

      setPosition({
        x: newX,
        y: newY,
        rotation: newRotation,
        opacity: newOpacity,
      })

      frame = requestAnimationFrame(animate)
    }

    frame = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(frame)
  }, [particle, type])

  // Different shapes for variety
  const shapes = ['■', '●', '▲', '★', '◆']
  const shape = shapes[particle.id % shapes.length]

  return (
    <div
      className="absolute text-lg font-bold transition-none"
      style={{
        left: `${position.x}%`,
        top: `${position.y}%`,
        transform: `translate(-50%, -50%) rotate(${position.rotation}deg)`,
        color: particle.color,
        opacity: position.opacity,
        fontSize: particle.size,
        textShadow: `0 0 ${particle.size / 2}px ${particle.color}`,
      }}
    >
      {shape}
    </div>
  )
}
