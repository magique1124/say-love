// 动态星空背景：星星闪烁 + 缓慢漂移 + 偶发流星，纯 Canvas 实现，无第三方依赖
import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  r: number
  base: number
  speed: number
  phase: number
  tint: string
}

interface Meteor {
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
}

const TINTS = ['255,255,255', '255,214,230', '205,225,255']

export default function Starfield() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    let w = 0
    let h = 0
    let raf = 0
    let nextMeteor = performance.now() + 2500
    const stars: Star[] = []
    const meteors: Meteor[] = []

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      w = canvas.clientWidth
      h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      if (!stars.length) {
        const count = Math.min(220, Math.max(80, Math.floor((w * h) / 9000)))
        for (let i = 0; i < count; i++) {
          stars.push({
            x: Math.random() * w,
            y: Math.random() * h,
            r: 0.4 + Math.random() * 1.2,
            base: 0.25 + Math.random() * 0.5,
            speed: 0.5 + Math.random() * 1.6,
            phase: Math.random() * Math.PI * 2,
            tint: TINTS[i % TINTS.length],
          })
        }
      }
    }
    resize()
    window.addEventListener('resize', resize)

    const loop = (t: number) => {
      ctx.clearRect(0, 0, w, h)

      for (const s of stars) {
        s.x -= 0.018 * s.speed
        if (s.x < -3) s.x = w + 3
        const tw = s.base + Math.sin((t / 1000) * s.speed + s.phase) * 0.35
        ctx.beginPath()
        ctx.fillStyle = `rgba(${s.tint},${Math.max(0, Math.min(1, tw))})`
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }

      if (t > nextMeteor) {
        nextMeteor = t + 4000 + Math.random() * 6000
        meteors.push({
          x: w * 0.25 + Math.random() * w * 0.65,
          y: -12,
          vx: -(2.4 + Math.random() * 2.2),
          vy: 2.4 + Math.random() * 1.4,
          life: 0,
          maxLife: 55 + Math.random() * 20,
        })
      }
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i]
        m.x += m.vx
        m.y += m.vy
        m.life++
        const fade = 1 - m.life / m.maxLife
        if (fade <= 0) {
          meteors.splice(i, 1)
          continue
        }
        const grad = ctx.createLinearGradient(m.x, m.y, m.x - m.vx * 14, m.y - m.vy * 14)
        grad.addColorStop(0, `rgba(255,255,255,${0.85 * fade})`)
        grad.addColorStop(1, 'rgba(255,255,255,0)')
        ctx.strokeStyle = grad
        ctx.lineWidth = 1.5
        ctx.beginPath()
        ctx.moveTo(m.x, m.y)
        ctx.lineTo(m.x - m.vx * 14, m.y - m.vy * 14)
        ctx.stroke()
      }

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={ref} className="pointer-events-none absolute inset-0 h-full w-full" />
}
