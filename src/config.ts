// ============================================================
// Say Love · 全局配置
// 想改默认名字 / 配色 / 文案？只动这一个文件就够了。
// ============================================================

/** 默认出现在手心的名字（也会被 ?to= 链接参数和 localStorage 覆盖） */
export const DEFAULT_NAME = '欢欢'

/** 本地预生成配音（public/voice/name.mp3）对应的名字；输入名与它一致时优先使用，可录进视频 */
export const RECORDED_NAME = '欢欢'

/**
 * 云端名字配音代理（Cloudflare Worker 地址，部署方法见 worker/tts-proxy.js 与 README）。
 * 配置后：输入任意名字都会实时合成可录制的配音；留空则只用预生成 + 系统 TTS。
 * 例：'https://tts-proxy.your-name.workers.dev'
 */
export const TTS_PROXY_URL = ''

/** 一句话的五个词，按顺序组成 "I Love {name} so much" */
export const SENTENCE_KEYS = ['i', 'love', 'name', 'so', 'much'] as const
export type SlotKey = (typeof SENTENCE_KEYS)[number]

export interface WordStyle {
  /** 画布上显示的文本 */
  display: string
  /** 语音播报的文本 */
  speech: string
  /** 语音语言 */
  lang: string
  /** 颜色 */
  color: string
  /** 是否斜体（英文花字） */
  italic?: boolean
  /** 绘制时的微小旋转（弧度） */
  tilt?: number
  /** 生成配音文件路径（优先于系统 TTS 播放） */
  audio?: string
}

const asset = (p: string) => `${import.meta.env.BASE_URL}${p}`

/**
 * 统一的"微甜 ins"滤镜配方：屏幕显示（视频元素内联样式）与录制（画布 drawImage）
 * 必须使用同一个常量，保证录出来的和看到的一致。
 * 肤色柔焦（blur）单独加：屏幕上用 backdrop-blur 叠加层，录制时画进 ctx.filter。
 */
export const INS_FILTER = 'brightness(1.09) saturate(1.32) contrast(1.05)'
export const INS_SOFT_FOCUS = 'blur(0.8px)'

/** 每个词的样式；name 的词由运行时名字动态生成 */
export function getWord(key: SlotKey, name: string): WordStyle {
  switch (key) {
    case 'i':
      return { display: 'I', speech: 'eye', lang: 'en-US', color: '#4d5bff', italic: true, tilt: -0.12, audio: asset('voice/i.mp3') }
    case 'love':
      return { display: 'Love', speech: 'love', lang: 'en-US', color: '#6cff4d', italic: true, tilt: -0.06, audio: asset('voice/love.mp3') }
    case 'name':
      // 名字的配音不走 audio 字段：由 speakName() 按「云端生成 → 预生成匹配 → 系统 TTS」三级回退处理
      return { display: name, speech: name, lang: 'zh-CN', color: '#4d5bff', tilt: 0 }
    case 'so':
      return { display: 'so', speech: 'so', lang: 'en-US', color: '#19d3c5', italic: true, tilt: 0.1, audio: asset('voice/so.mp3') }
    case 'much':
      return { display: 'much.', speech: 'much', lang: 'en-US', color: '#ff2e88', italic: true, tilt: -0.14, audio: asset('voice/so-much.mp3') }
  }
}

/** 左手（屏幕左侧）手指上挂的词：食指 I · 中指 Love · 无名指 名字 */
export const LEFT_HAND_SLOTS: { key: SlotKey; tip: number }[] = [
  { key: 'i', tip: 8 },
  { key: 'love', tip: 12 },
  { key: 'name', tip: 16 },
]

/** 右手（屏幕右侧）手指上挂的词：食指 so · 中指 much */
export const RIGHT_HAND_SLOTS: { key: SlotKey; tip: number }[] = [
  { key: 'so', tip: 8 },
  { key: 'much', tip: 12 },
]

/** 捏出爱心时的心形粒子配色 */
export const HEART_COLORS = ['#ff2e88', '#ff5c8a', '#ff8fb3', '#ffd166', '#ff77c8']
