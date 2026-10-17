// 控制面板：改名字、复制专属链接、声音与模式切换
import { useState } from 'react'
import { Check, Heart, Link2, Volume2, VolumeX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { StageMode } from '@/components/LoveStage'
import { DEFAULT_NAME } from '@/config'
import { getNameAudioMode } from '@/lib/speech'

interface ControlPanelProps {
  name: string
  onNameChange: (name: string) => void
  muted: boolean
  onMuteChange: (muted: boolean) => void
  mode: StageMode
  onModeChange: (mode: StageMode) => void
}

export default function ControlPanel({
  name,
  onNameChange,
  muted,
  onMuteChange,
  mode,
  onModeChange,
}: ControlPanelProps) {
  const [copied, setCopied] = useState(false)
  const nameAudioMode = getNameAudioMode(name)

  const copyLink = async () => {
    const url = `${location.origin}${location.pathname}?to=${encodeURIComponent(name || DEFAULT_NAME)}`
    try {
      await navigator.clipboard.writeText(url)
    } catch {
      // 剪贴板 API 不可用时退化为选中文本复制
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="w-full rounded-3xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="flex shrink-0 items-center gap-2 text-sm font-medium text-white/70">
            <Heart className="h-4 w-4 text-pink-400" /> 对谁说：
          </label>
          <Input
            value={name}
            maxLength={12}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="输入 TA 的名字"
            className="border-white/15 bg-black/30 text-white placeholder:text-white/30 focus-visible:ring-pink-400/60"
          />
          <Button
            onClick={copyLink}
            className="shrink-0 bg-white/10 text-white hover:bg-white/20"
            variant="secondary"
          >
            {copied ? <Check className="mr-2 h-4 w-4 text-emerald-400" /> : <Link2 className="mr-2 h-4 w-4" />}
            {copied ? '已复制！' : '复制专属链接'}
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          {nameAudioMode === 'cloud' && (
            <span className="text-[11px] text-emerald-300/80">
              ✓ 已接入云端配音：任意名字都能实时朗读，并录进视频
            </span>
          )}
          {nameAudioMode === 'recorded' && (
            <span className="text-[11px] text-pink-300/80">
              ✓ 当前名字带预生成配音，可完整录制
            </span>
          )}
          {nameAudioMode === 'live-only' && (
            <span className="text-[11px] text-amber-300/80">
              ⚠️ 该名字没有预生成配音：网页会实时朗读，但录制视频里不会有名字声音
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          <Button
            size="sm"
            variant="outline"
            className="border-white/15 bg-transparent text-white/75 hover:bg-white/10 hover:text-white"
            onClick={() => onMuteChange(!muted)}
          >
            {muted ? <VolumeX className="mr-2 h-4 w-4" /> : <Volume2 className="mr-2 h-4 w-4" />}
            声音{muted ? '关' : '开'}
          </Button>
          {mode !== 'idle' && (
            <Button
              size="sm"
              variant="outline"
              className="border-white/15 bg-transparent text-white/75 hover:bg-white/10 hover:text-white"
              onClick={() => onModeChange('idle')}
            >
              退出{mode === 'demo' ? '演示' : '摄像头'}
            </Button>
          )}
          <span className="ml-auto text-[11px] text-white/35">
            链接带 ?to=名字 参数，发给 TA 打开就是专属版本 · 手势识别在本地完成
          </span>
        </div>
      </div>
    </div>
  )
}
