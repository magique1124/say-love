// 摄像头 + HandLandmarker 追踪 Hook：把每一帧检测到的手部骨骼点写入 ref，
// 渲染层用 rAF 直接读取，避免 60fps 的 setState。
import { useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'
import { getLandmarker } from '@/lib/tracker'

export interface Landmark {
  x: number
  y: number
  z: number
}

export function useHandTracking(active: boolean, videoRef: RefObject<HTMLVideoElement | null>) {
  const handsRef = useRef<Landmark[][]>([])
  const [count, setCount] = useState(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!active) {
      handsRef.current = []
      setCount(0)
      return
    }
    let cancelled = false
    let raf = 0
    let stream: MediaStream | null = null

    ;(async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        const video = videoRef.current
        if (!video) return
        video.srcObject = stream
        await video.play()

        const landmarker = await getLandmarker()
        if (cancelled) return
        setReady(true)

        const loop = () => {
          if (cancelled) return
          if (video.readyState >= 2) {
            try {
              const result = landmarker.detectForVideo(video, performance.now())
              handsRef.current = result.landmarks as Landmark[][]
              setCount((prev) => (prev === result.landmarks.length ? prev : result.landmarks.length))
            } catch {
              // 某一帧检测失败（如摄像头分辨率切换），跳过即可
            }
          }
          raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '无法访问摄像头')
        }
      }
    })()

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      if (videoRef.current) videoRef.current.srcObject = null
      handsRef.current = []
      setReady(false)
      setError(null)
    }
  }, [active, videoRef])

  return { handsRef, count, ready, error }
}
