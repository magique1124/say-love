// MediaPipe HandLandmarker 加载器（模型与 WASM 均打包在 public/ 下，自包含、可上 GitHub Pages）
import { FilesetResolver, HandLandmarker } from '@mediapipe/tasks-vision'

let landmarker: HandLandmarker | null = null
let pending: Promise<HandLandmarker> | null = null

export function getLandmarker(): Promise<HandLandmarker> {
  if (landmarker) return Promise.resolve(landmarker)
  if (pending) return pending

  pending = (async () => {
    const base = import.meta.env.BASE_URL
    const fileset = await FilesetResolver.forVisionTasks(`${base}wasm`)
    const options = (delegate: 'GPU' | 'CPU') => ({
      baseOptions: {
        modelAssetPath: `${base}models/hand_landmarker.task`,
        delegate,
      },
      runningMode: 'VIDEO' as const,
      numHands: 2,
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    })
    try {
      landmarker = await HandLandmarker.createFromOptions(fileset, options('GPU'))
    } catch {
      // 部分机器 WebGL/GPU 不可用，回退 CPU
      landmarker = await HandLandmarker.createFromOptions(fileset, options('CPU'))
    }
    return landmarker
  })()

  return pending
}

export function disposeLandmarker() {
  landmarker?.close()
  landmarker = null
  pending = null
}
