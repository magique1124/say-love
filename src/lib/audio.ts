// WebAudio 引擎：生成配音统一从这里播放。
// 录制时通过 MediaStreamDestination 把声音分流进录制器——
// 注意：系统 TTS（speechSynthesis）走系统音频，录不进去，
// 所以想要被录进视频的声音，必须走这里（生成音频 mp3）。

let ctx: AudioContext | null = null
let master: GainNode | null = null
let recordingTap: MediaStreamAudioDestinationNode | null = null
let currentSource: AudioBufferSourceNode | null = null
const bufferCache = new Map<string, AudioBuffer>()

function ensureContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  if (!ctx) {
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 1
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

/** 播放一段生成配音；返回是否成功（失败时调用方可回退 TTS） */
export async function playClip(url: string): Promise<boolean> {
  const context = ensureContext()
  if (!context || !master) return false
  try {
    let buffer = bufferCache.get(url)
    if (!buffer) {
      const res = await fetch(url)
      if (!res.ok) return false
      buffer = await context.decodeAudioData(await res.arrayBuffer())
      bufferCache.set(url, buffer)
    }
    stopClip()
    const source = context.createBufferSource()
    source.buffer = buffer
    source.connect(master)
    source.start()
    currentSource = source
    source.onended = () => {
      if (currentSource === source) currentSource = null
    }
    return true
  } catch {
    return false
  }
}

/** 停止当前正在播放的配音 */
export function stopClip() {
  try {
    currentSource?.stop()
  } catch {
    // 已结束的 source 重复 stop 会抛错，忽略
  }
  currentSource = null
}

/** 创建录制用音频目的地（每段录制创建一个） */
export function createRecordingDestination(): MediaStreamAudioDestinationNode | null {
  const context = ensureContext()
  return context ? context.createMediaStreamDestination() : null
}

/** 开始/结束录制分流：把主增益同时接入（或断开）录制目的地 */
export function setRecordingTap(dest: MediaStreamAudioDestinationNode | null) {
  if (!master) return
  if (recordingTap) {
    try {
      master.disconnect(recordingTap)
    } catch {
      // 已断开，忽略
    }
  }
  recordingTap = dest
  if (dest) master.connect(dest)
}
