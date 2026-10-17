// 舞台组件：视频层 + Canvas 覆盖层。
// 负责绘制手部骨架、指尖上的词、捏合触发（语音 + 弹跳 + 爱心粒子）、底部高亮句，
// 以及录制功能（把画面合成进 Canvas，经 MediaRecorder 导出视频）。
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  getWord,
  HEART_COLORS,
  INS_FILTER,
  INS_SOFT_FOCUS,
  LEFT_HAND_SLOTS,
  RIGHT_HAND_SLOTS,
  SENTENCE_KEYS,
} from '@/config'
import type { SlotKey } from '@/config'
import { useHandTracking } from '@/hooks/useHandTracking'
import type { Landmark } from '@/hooks/useHandTracking'
import { getDemoHands } from '@/lib/demoHands'
import { createRecordingDestination, setRecordingTap } from '@/lib/audio'
import { speakName, speakWord } from '@/lib/speech'
import { Button } from '@/components/ui/button'
import {
  Camera,
  Download,
  Loader2,
  RotateCcw,
  Sparkles,
  Square,
  VideoOff,
  X,
} from 'lucide-react'

export type StageMode = 'idle' | 'camera' | 'demo'

interface Particle {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  size: number
  life: number
  maxLife: number
  color: string
}

const CONNECTIONS: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17],
]

const TIP_INDEXES = new Set([4, 8, 12, 16, 20])

function dist(a: Landmark, b: Landmark) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function drawSkeleton(ctx: CanvasRenderingContext2D, lm: Landmark[], w: number, h: number) {
  ctx.save()
  ctx.strokeStyle = 'rgba(255, 90, 140, 0.5)'
  ctx.lineWidth = Math.max(1, w / 640)
  ctx.beginPath()
  for (const [a, b] of CONNECTIONS) {
    ctx.moveTo(lm[a].x * w, lm[a].y * h)
    ctx.lineTo(lm[b].x * w, lm[b].y * h)
  }
  ctx.stroke()

  for (let i = 0; i < lm.length; i++) {
    const isTip = TIP_INDEXES.has(i)
    ctx.beginPath()
    ctx.fillStyle = '#ff3b3b'
    ctx.arc(lm[i].x * w, lm[i].y * h, isTip ? Math.max(3.5, w / 220) : Math.max(2, w / 420), 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.restore()
}

function drawWord(
  ctx: CanvasRenderingContext2D,
  key: SlotKey,
  name: string,
  tip: Landmark,
  w: number,
  h: number,
  now: number,
  popAt: number | undefined,
  pinched: boolean,
) {
  const word = getWord(key, name)
  let scale = 1
  if (popAt !== undefined) {
    const age = now - popAt
    if (age < 500) scale += 0.6 * (1 - age / 500)
  }
  if (pinched) scale *= 1.12

  const px = tip.x * w
  const py = tip.y * h - Math.max(20, w / 28) * scale
  const size = Math.round(Math.max(22, w / 30) * scale)

  ctx.save()
  ctx.translate(px, py)
  ctx.scale(-1, 1) // 抵消画布的整体镜像，让文字正向可读
  ctx.rotate(-(word.tilt ?? 0))
  ctx.font = word.italic
    ? `italic 700 ${size}px Georgia, 'Times New Roman', serif`
    : `700 ${size}px 'Noto Serif SC', 'Songti SC', 'PingFang SC', serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (pinched) {
    ctx.shadowColor = word.color
    ctx.shadowBlur = 24
  }
  ctx.fillStyle = word.color
  ctx.fillText(word.display, 0, 0)
  ctx.restore()
}

function spawnHearts(parts: Particle[], x: number, y: number, w: number) {
  for (let i = 0; i < 16; i++) {
    const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.8
    const speed = (1.2 + Math.random() * 2.4) * (w / 900)
    parts.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.08,
      size: 14 + Math.random() * 14,
      life: 0,
      maxLife: 55 + Math.random() * 30,
      color: HEART_COLORS[i % HEART_COLORS.length],
    })
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, parts: Particle[]) {
  ctx.save()
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i]
    p.life++
    p.x += p.vx
    p.y += p.vy
    p.vy += 0.02
    p.rot += p.vr
    const remain = 1 - p.life / p.maxLife
    if (remain <= 0) {
      parts.splice(i, 1)
      continue
    }
    ctx.save()
    ctx.globalAlpha = Math.min(1, remain * 1.6)
    ctx.translate(p.x, p.y)
    ctx.rotate(p.rot)
    ctx.font = `${p.size}px serif`
    ctx.fillStyle = p.color
    ctx.fillText('❤', 0, 0)
    ctx.restore()
  }
  ctx.restore()
}

function formatTime(ms: number) {
  const s = Math.floor(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

const REC_MIME_CANDIDATES = [
  'video/mp4;codecs=avc1',
  'video/mp4',
  'video/webm;codecs=vp9',
  'video/webm;codecs=vp8',
  'video/webm',
]

interface LoveStageProps {
  name: string
  muted: boolean
  mode: StageMode
  onModeChange: (mode: StageMode) => void
}

export default function LoveStage({ name, muted, mode, onModeChange }: LoveStageProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const { handsRef, count, ready, error } = useHandTracking(mode === 'camera', videoRef)

  const [activeIdx, setActiveIdx] = useState(-1)
  const popRef = useRef(new Map<SlotKey, number>())
  const pinchRef = useRef(new Map<SlotKey, boolean>())
  const partsRef = useRef<Particle[]>([])
  const startAtRef = useRef(Date.now())

  // 录制状态
  const [isRecording, setIsRecording] = useState(false)
  const [recSeconds, setRecSeconds] = useState(0)
  const [recUrl, setRecUrl] = useState<string | null>(null)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const recExtRef = useRef('webm')
  const recTimerRef = useRef(0)
  const recordingRef = useRef(false)

  const nameRef = useRef(name)
  nameRef.current = name
  const mutedRef = useRef(muted)
  mutedRef.current = muted

  const trigger = useCallback((key: SlotKey, tip: Landmark, w: number, h: number) => {
    popRef.current.set(key, performance.now())
    const word = getWord(key, nameRef.current)
    if (key === 'name') {
      speakName(nameRef.current, mutedRef.current)
    } else {
      speakWord(word, mutedRef.current)
    }
    if (key === 'name' || key === 'so') spawnHearts(partsRef.current, tip.x * w, tip.y * h, w)
    setActiveIdx(SENTENCE_KEYS.indexOf(key))
  }, [])

  // 预载生成配音，避免首次捏词时才加载有延迟
  useEffect(() => {
    ;['voice/i.mp3', 'voice/love.mp3', 'voice/so.mp3', 'voice/so-much.mp3', 'voice/name.mp3'].forEach((p) => {
      const a = new Audio(`${import.meta.env.BASE_URL}${p}`)
      a.preload = 'auto'
      a.load()
    })
  }, [])

  const stopRecording = useCallback(() => {
    window.clearInterval(recTimerRef.current)
    recorderRef.current?.stop() // onstop 里收尾状态
  }, [])

  const startRecording = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas || typeof MediaRecorder === 'undefined') return
    const canvasStream = canvas.captureStream(30)
    // 音频分流：配音经 WebAudio 同时进扬声器和录制器
    const audioDest = createRecordingDestination()
    setRecordingTap(audioDest)
    const tracks = [
      ...canvasStream.getVideoTracks(),
      ...(audioDest ? audioDest.stream.getAudioTracks() : []),
    ]
    const stream = new MediaStream(tracks)
    const mime = REC_MIME_CANDIDATES.find((m) => MediaRecorder.isTypeSupported(m)) ?? ''
    const recorder = new MediaRecorder(
      stream,
      mime ? { mimeType: mime, videoBitsPerSecond: 5_000_000 } : undefined,
    )
    chunksRef.current = []
    recorder.ondataavailable = (e) => {
      if (e.data.size) chunksRef.current.push(e.data)
    }
    recorder.onstop = () => {
      setRecordingTap(null)
      const type = recorder.mimeType || mime || 'video/webm'
      recExtRef.current = type.includes('mp4') ? 'mp4' : 'webm'
      const blob = new Blob(chunksRef.current, { type })
      setRecUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return URL.createObjectURL(blob)
      })
      setIsRecording(false)
      recordingRef.current = false
    }
    recorderRef.current = recorder
    recordingRef.current = true
    setRecSeconds(0)
    setIsRecording(true)
    recTimerRef.current = window.setInterval(() => setRecSeconds((s) => s + 1), 1000)
    recorder.start(200)
  }, [])

  // 切换模式前停止录制并关闭预览
  const handleModeChange = useCallback(
    (next: StageMode) => {
      if (recordingRef.current) stopRecording()
      setRecUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      onModeChange(next)
    },
    [onModeChange, stopRecording],
  )

  // 主绘制循环（摄像头 & 演示模式共用）
  useEffect(() => {
    if (mode === 'idle') return
    let raf = 0
    const draw = () => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (canvas && ctx) {
        const w = canvas.width
        const h = canvas.height
        ctx.clearRect(0, 0, w, h)
        const now = performance.now()

        // 录制时把整帧画面按预览效果烘焙（镜像 + ins 滤镜），录出来和看到的一致
        const bake = recordingRef.current
        if (bake) {
          ctx.save()
          ctx.translate(w, 0)
          ctx.scale(-1, 1)
        }

        if (recordingRef.current) {
          ctx.fillStyle = '#0a0d18'
          ctx.fillRect(0, 0, w, h)
          const video = videoRef.current
          if (mode === 'camera' && video && video.readyState >= 2) {
            const canFilter = 'filter' in ctx
            if (canFilter) ctx.filter = `${INS_FILTER} ${INS_SOFT_FOCUS}`
            ctx.drawImage(video, 0, 0, w, h)
            if (canFilter) ctx.filter = 'none'
            ctx.save()
            ctx.globalCompositeOperation = 'soft-light'
            const warm = ctx.createLinearGradient(0, 0, w, h)
            // 与屏幕上 .warm-glow 图层等效的粉调柔光，避免发黄、保留 ins 暖皮感
            warm.addColorStop(0, 'rgba(255,150,150,0.28)')
            warm.addColorStop(1, 'rgba(255,120,170,0.22)')
            ctx.fillStyle = warm
            ctx.fillRect(0, 0, w, h)
            ctx.restore()
          }
        }

        const hands: Landmark[][] =
          mode === 'demo' ? getDemoHands(now / 1000) : (handsRef.current ?? [])

        for (const lm of hands) {
          drawSkeleton(ctx, lm, w, h)
          // 镜像显示后的水平中心：> 0.5 的手显示在屏幕左侧
          const cx = lm.reduce((acc, p) => acc + p.x, 0) / lm.length
          const slots = 1 - cx < 0.5 ? LEFT_HAND_SLOTS : RIGHT_HAND_SLOTS
          const handSize = dist(lm[0], lm[9])

          for (const slot of slots) {
            const tip = lm[slot.tip]
            const pinched = dist(lm[4], tip) < handSize * 0.42
            const wasPinched = pinchRef.current.get(slot.key) ?? false
            if (pinched && !wasPinched) trigger(slot.key, tip, w, h)
            pinchRef.current.set(slot.key, pinched)
            drawWord(ctx, slot.key, nameRef.current, tip, w, h, now, popRef.current.get(slot.key), pinched)
          }
        }
        drawParticles(ctx, partsRef.current)
        if (bake) ctx.restore()
      }
      raf = requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [mode, handsRef, trigger])

  // 卸载清理
  useEffect(
    () => () => {
      window.clearInterval(recTimerRef.current)
      if (recorderRef.current?.state === 'recording') recorderRef.current.stop()
      setRecordingTap(null)
    },
    [],
  )

  const showStart = mode === 'idle'
  const showLoading = mode === 'camera' && !ready && !error
  const showError = mode === 'camera' && !!error

  return (
    <div className="relative h-full min-h-[320px] w-full overflow-hidden rounded-3xl border border-white/10 bg-black/50 shadow-[0_0_80px_rgba(255,46,136,0.12)] backdrop-blur">
      {/* 视频层（镜像 + ins 滤镜，滤镜常量与录制共用） */}
      <video
        ref={videoRef}
        playsInline
        muted
        style={{ filter: INS_FILTER }}
        className={`absolute inset-0 h-full w-full -scale-x-100 object-cover transition-opacity duration-700 ${mode === 'camera' ? 'opacity-100' : 'opacity-0'}`}
      />
      {/* ins 风叠加层：粉调柔光 + 肤色柔焦 + 胶片颗粒（仅影响显示；录制时由画布滤镜等价实现） */}
      {mode === 'camera' && (
        <>
          <div className="soft-focus pointer-events-none absolute inset-0" />
          <div className="warm-glow pointer-events-none absolute inset-0" />
          <div className="grain pointer-events-none absolute inset-0" />
        </>
      )}
      {/* 演示模式背景 */}
      {mode === 'demo' && (
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_120%,rgba(255,46,136,0.18),transparent_60%),radial-gradient(ellipse_at_80%_-10%,rgba(25,211,197,0.12),transparent_50%)]" />
      )}
      {/* 覆盖画布（镜像，与视频对齐） */}
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        className={`absolute inset-0 h-full w-full -scale-x-100 ${mode === 'idle' ? 'opacity-0' : 'opacity-100'}`}
      />

      {/* 顶部 HUD */}
      {mode !== 'idle' && (
        <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-4 py-1.5 text-[11px] font-medium tracking-[0.18em] text-white/80 backdrop-blur">
            {isRecording && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500" />}
            <span className={`h-1.5 w-1.5 rounded-full ${!isRecording && (mode === 'demo' || count > 0) ? 'animate-pulse bg-red-500' : 'bg-white/30'}`} />
            {isRecording
              ? `REC · ${formatTime(recSeconds * 1000)}`
              : mode === 'demo'
                ? 'DEMO MODE · 自动演示中'
                : `TRACKING ${count} HAND${count === 1 ? '' : 'S'} · ${formatTime(Date.now() - startAtRef.current)}`}
          </div>
        </div>
      )}

      {/* 录制按钮 */}
      {mode !== 'idle' && typeof MediaRecorder !== 'undefined' && (
        <div className="absolute right-4 top-4 z-10">
          {isRecording ? (
            <button
              onClick={stopRecording}
              className="flex items-center gap-1.5 rounded-full bg-red-500/90 px-4 py-2 text-xs font-semibold text-white shadow-lg transition hover:bg-red-400"
            >
              <Square className="h-3 w-3 fill-current" /> 停止
            </button>
          ) : (
            <button
              onClick={startRecording}
              className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/50 px-4 py-2 text-xs font-semibold text-white backdrop-blur transition hover:bg-black/70"
            >
              <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> 录制
            </button>
          )}
        </div>
      )}

      {/* 录制完成预览 */}
      {recUrl && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/85 p-4 backdrop-blur-sm">
          <p className="text-sm text-white/85">录制完成 🎬 预览一下，满意就下载发给 TA：</p>
          <video
            src={recUrl}
            controls
            autoPlay
            loop
            className="max-h-[65%] w-auto max-w-[88%] rounded-xl border border-white/15 bg-black"
          />
          <div className="flex gap-3">
            <a
              href={recUrl}
              download={`say-love.${recExtRef.current}`}
              className="flex items-center gap-1.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-400 px-5 py-2 text-sm font-semibold text-white transition hover:from-pink-400 hover:to-rose-300"
            >
              <Download className="h-4 w-4" /> 下载视频
            </a>
            <Button
              variant="outline"
              className="border-white/20 bg-transparent text-white/80 hover:bg-white/10 hover:text-white"
              onClick={() =>
                setRecUrl((prev) => {
                  if (prev) URL.revokeObjectURL(prev)
                  return null
                })
              }
            >
              <X className="mr-1.5 h-4 w-4" /> 关闭
            </Button>
          </div>
          <p className="text-[11px] text-white/40">录制画面与你在屏幕上看到的完全一致</p>
        </div>
      )}

      {/* 底部高亮句 */}
      {mode !== 'idle' && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent pb-4 pt-10">
          <div className="flex flex-wrap items-end justify-center gap-x-3 px-4">
            {SENTENCE_KEYS.map((key, i) => {
              const word = getWord(key, name)
              const active = i === activeIdx
              return (
                <span
                  key={key}
                  className="font-serif transition-all duration-300"
                  style={{
                    color: active ? word.color : 'rgba(255,255,255,0.45)',
                    fontSize: active ? '2rem' : '1.15rem',
                    fontStyle: word.italic ? 'italic' : 'normal',
                    fontWeight: active ? 700 : 500,
                    textShadow: active ? `0 0 24px ${word.color}` : 'none',
                    transform: active ? 'translateY(-4px)' : 'none',
                  }}
                >
                  {word.display}
                </span>
              )
            })}
          </div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-white/40">
            pinch a finger to speak · 拇指捏住手指说出那个词
          </p>
        </div>
      )}

      {/* 开始遮罩 */}
      {showStart && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-5 bg-black/55 backdrop-blur-sm">
          <div className="text-center">
            <p className="mb-1 text-4xl">🖐️🤏</p>
            <h2 className="font-serif text-2xl font-bold text-white">伸出手，把爱说出来</h2>
            <p className="mt-2 text-sm text-white/55">举起双手，拇指捏住手指，逐个说出 I Love {name} so much</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Button
              size="lg"
              className="bg-gradient-to-r from-pink-500 to-rose-400 text-white hover:from-pink-400 hover:to-rose-300"
              onClick={() => handleModeChange('camera')}
            >
              <Camera className="mr-2 h-4 w-4" /> 开启摄像头
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white"
              onClick={() => handleModeChange('demo')}
            >
              <Sparkles className="mr-2 h-4 w-4" /> 先看看演示
            </Button>
          </div>
        </div>
      )}

      {/* 加载中 */}
      {showLoading && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/60 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-pink-400" />
          <p className="text-sm text-white/70">正在加载手部追踪模型…（首次约几秒）</p>
        </div>
      )}

      {/* 摄像头错误 */}
      {showError && (
        <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/60 px-6 text-center backdrop-blur-sm">
          <VideoOff className="h-8 w-8 text-white/50" />
          <p className="max-w-sm text-sm text-white/75">
            摄像头不可用或被拒绝（{error}）。需要 HTTPS 或 localhost 环境，也可以先看演示模式。
          </p>
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="border-white/20 bg-white/5 text-white hover:bg-white/15 hover:text-white"
              onClick={() => handleModeChange('idle')}
            >
              <RotateCcw className="mr-2 h-4 w-4" /> 重试
            </Button>
            <Button
              className="bg-gradient-to-r from-pink-500 to-rose-400 text-white hover:from-pink-400 hover:to-rose-300"
              onClick={() => handleModeChange('demo')}
            >
              <Sparkles className="mr-2 h-4 w-4" /> 进入演示模式
            </Button>
          </div>
        </div>
      )}

      {/* 右下角小提示 */}
      {mode === 'camera' && ready && (
        <div className="absolute bottom-16 right-4 z-10 max-w-[180px] rounded-xl border border-white/10 bg-black/40 p-2.5 text-[10px] leading-relaxed text-white/55 backdrop-blur">
          用拇指捏对应的食指 / 中指 / 无名指，只有捏住的手会发声
        </div>
      )}
    </div>
  )
}
