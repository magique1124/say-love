// 主页面：星空背景 + 头部 + 舞台 + 控制面板
import { useEffect, useState } from 'react'
import ControlPanel from '@/components/ControlPanel'
import LoveStage from '@/components/LoveStage'
import type { StageMode } from '@/components/LoveStage'
import Starfield from '@/components/Starfield'
import { DEFAULT_NAME } from '@/config'
import { stopSpeaking } from '@/lib/speech'

function initName(): string {
  try {
    const params = new URLSearchParams(location.search)
    const fromUrl = params.get('to') ?? params.get('name')
    if (fromUrl) return fromUrl.slice(0, 12)
    return localStorage.getItem('say-love-name') ?? DEFAULT_NAME
  } catch {
    return DEFAULT_NAME
  }
}

export default function Home() {
  const [name, setName] = useState(initName)
  const [muted, setMuted] = useState(false)
  const [mode, setMode] = useState<StageMode>('idle')

  useEffect(() => {
    try {
      localStorage.setItem('say-love-name', name)
    } catch {
      // 隐私模式下忽略
    }
  }, [name])

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#04060f] text-white">
      {/* 动态星空背景 */}
      <Starfield />
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-20%,rgba(77,91,255,0.15),transparent_55%),radial-gradient(ellipse_at_90%_110%,rgba(255,46,136,0.12),transparent_55%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center gap-6 px-4 py-8">
        {/* 头部 */}
        <header className="flex flex-col items-center gap-2 text-center">
          <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1 text-[11px] tracking-[0.25em] text-white/55">
            SAY LOVE LAB · 04
          </div>
          <h1 className="bg-gradient-to-r from-pink-400 via-rose-300 to-cyan-300 bg-clip-text font-serif text-4xl font-bold italic tracking-tight text-transparent sm:text-5xl">
            Say Love
          </h1>
          <p className="max-w-md text-sm leading-relaxed text-white/55">动动手指，表达爱～</p>
        </header>

        {/* 舞台 */}
        <main className="aspect-video w-full">
          <LoveStage name={name} muted={muted} mode={mode} onModeChange={setMode} />
        </main>

        {/* 控制面板 */}
        <ControlPanel
          name={name}
          onNameChange={setName}
          muted={muted}
          onMuteChange={(m) => {
            if (m) stopSpeaking()
            setMuted(m)
          }}
          mode={mode}
          onModeChange={setMode}
        />

        <footer className="pb-4 text-center text-[11px] text-white/30">
          灵感来自 TOUCH DESIGN LAB 手势实验 · 本地识别，视频不出设备 · 想开源部署？改 config.ts 里的默认名字即可
        </footer>
      </div>
    </div>
  )
}
