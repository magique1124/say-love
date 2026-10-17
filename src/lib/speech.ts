// 基于 Web Speech API 的语音播报。
// 每次说话时实时重新匹配嗓音（嗓音列表是异步加载的，首次说话经常还没就绪，
// 导致 "I" 被中文嗓音读成"爱"——这就是之前发音不对的原因）。
const ZH_VOICE_HINTS = ['Tingting', 'Meijia', 'Xiaoxiao', 'Google 普通话', 'Yaoyao']
const EN_VOICE_HINTS = ['Samantha', 'Google US English', 'Microsoft Aria', 'Zira', 'Karen']

function pickVoice(lang: string): SpeechSynthesisVoice | null {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  if (!voices.length) return null
  const prefix = lang.split('-')[0].toLowerCase()
  const sameLang = voices.filter((v) => v.lang.replace('_', '-').toLowerCase().startsWith(prefix))
  if (!sameLang.length) return null
  const hints = prefix === 'zh' ? ZH_VOICE_HINTS : EN_VOICE_HINTS
  for (const h of hints) {
    const hit = sameLang.find((v) => v.name.includes(h))
    if (hit) return hit
  }
  return sameLang[0]
}

import { playClip, stopClip } from '@/lib/audio'
import { RECORDED_NAME, TTS_PROXY_URL } from '@/config'

export interface Speakable {
  speech: string
  lang: string
  audio?: string
}

/** 停止当前一切发声（TTS 与生成配音） */
export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel()
  }
  stopClip()
}

/**
 * 播放一个词：优先使用生成配音（经 WebAudio，可被录制捕获），失败时回退系统 TTS。
 */
export async function speakWord(word: Speakable, muted: boolean) {
  if (muted || typeof window === 'undefined') return
  if (word.audio) {
    stopSpeaking()
    const ok = await playClip(word.audio)
    if (!ok) speak(word.speech, word.lang, false)
    return
  }
  speak(word.speech, word.lang, false)
}

// ============ 名字的三级配音回退 ============
// 1. 云端 TTS 代理（TTS_PROXY_URL 已配置）→ 任意名字，实时合成，可录进视频
// 2. 本地预生成（输入名 === RECORDED_NAME）→ 固定名字，可录进视频
// 3. 系统 TTS → 任意名字实时念，但录不进视频
export type NameAudioMode = 'cloud' | 'recorded' | 'live-only'

export function getNameAudioMode(name: string): NameAudioMode {
  if (TTS_PROXY_URL) return 'cloud'
  if (name.trim() === RECORDED_NAME) return 'recorded'
  return 'live-only'
}

const nameAudioCache = new Map<string, string>()

/** 播放名字配音（按上面的三级回退） */
export async function speakName(name: string, muted: boolean) {
  if (muted || typeof window === 'undefined') return
  const trimmed = name.trim()
  if (!trimmed) return

  if (TTS_PROXY_URL) {
    try {
      let url = nameAudioCache.get(trimmed)
      if (!url) {
        const isLatin = /^[a-zA-Z\s.'-]+$/.test(trimmed)
        const res = await fetch(
          `${TTS_PROXY_URL}?text=${encodeURIComponent(trimmed)}&lang=${isLatin ? 'en' : 'zh'}`,
        )
        if (!res.ok) throw new Error(`tts proxy ${res.status}`)
        url = URL.createObjectURL(await res.blob())
        nameAudioCache.set(trimmed, url)
      }
      stopSpeaking()
      if (await playClip(url)) return
    } catch {
      // 云端失败，继续往下回退
    }
  }

  if (trimmed === RECORDED_NAME) {
    stopSpeaking()
    const ok = await playClip(`${import.meta.env.BASE_URL}voice/name.mp3`)
    if (ok) return
  }

  speak(trimmed, 'zh-CN', false)
}

export function speak(text: string, lang: string, muted: boolean) {
  if (muted || typeof window === 'undefined' || !('speechSynthesis' in window)) return

  let voice = pickVoice(lang)
  let finalText = text
  if (!voice && lang.toLowerCase().startsWith('en')) {
    // 系统没有英文嗓音时，单字母 "I" 会被读成"爱"，用拼读兜底
    finalText = text === 'I' ? 'eye' : text
    voice = pickVoice('zh-CN')
  }

  const utterance = new SpeechSynthesisUtterance(finalText)
  if (voice) {
    utterance.voice = voice
    utterance.lang = voice.lang
  } else {
    utterance.lang = lang
  }
  utterance.rate = 0.92
  utterance.pitch = 1.0
  window.speechSynthesis.cancel()
  window.speechSynthesis.speak(utterance)
}
