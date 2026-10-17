// 演示模式：生成两只"虚拟手"的 21 个骨骼点，无需摄像头即可预览效果。
// 虚拟手会按节奏轮流做捏合动作，触发与真实手完全相同的词效与语音。
import type { Landmark } from '@/hooks/useHandTracking'

/** 一只摊开的右手掌（图像坐标系，y 向下），作为虚拟手的模板 */
const OPEN_PALM: [number, number][] = [
  [0.5, 0.98], // 0 手腕
  [0.36, 0.86], [0.26, 0.74], [0.18, 0.63], [0.11, 0.53], // 1-4 拇指
  [0.39, 0.56], [0.35, 0.4], [0.32, 0.27], [0.3, 0.15], // 5-8 食指
  [0.5, 0.53], [0.49, 0.35], [0.485, 0.2], [0.48, 0.07], // 9-12 中指
  [0.61, 0.56], [0.63, 0.4], [0.645, 0.27], [0.655, 0.16], // 13-16 无名指
  [0.7, 0.6], [0.75, 0.5], [0.79, 0.42], [0.82, 0.35], // 17-20 小指
]

/** 捏合动作编排：[手(0=屏幕左侧那只,1=右侧), 指尖索引, 句子序号] */
const PINCH_SCRIPT: { hand: number; tip: number; at: number }[] = [
  { hand: 0, tip: 8, at: 1.0 }, // I
  { hand: 0, tip: 12, at: 3.4 }, // Love
  { hand: 0, tip: 16, at: 5.8 }, // 名字
  { hand: 1, tip: 8, at: 8.2 }, // so
  { hand: 1, tip: 12, at: 10.6 }, // much
]
const LOOP = 13
const PINCH_LEN = 1.1

function smooth(x: number) {
  const c = Math.min(1, Math.max(0, x))
  return c * c * (3 - 2 * c)
}

function buildHand(cx: number, cy: number, s: number, rot: number): Landmark[] {
  const cos = Math.cos(rot)
  const sin = Math.sin(rot)
  return OPEN_PALM.map(([x, y]) => {
    const dx = (x - 0.5) * s
    const dy = (y - 0.62) * s
    return {
      x: cx + dx * cos - dy * sin,
      y: cy + dx * sin + dy * cos,
      z: 0,
    }
  })
}

function applyPinch(hand: Landmark[], tip: number, k: number) {
  if (k <= 0) return
  const pull = (idx: number, amount: number) => {
    hand[idx] = {
      ...hand[idx],
      x: hand[idx].x + (hand[4].x - hand[idx].x) * amount * k,
      y: hand[idx].y + (hand[4].y - hand[idx].y) * amount * k,
    }
  }
  pull(tip, 1)
  pull(tip - 1, 0.55)
  pull(tip - 2, 0.2)
}

/** 返回某一时刻的两只虚拟手（图像坐标系，与真实检测格式一致） */
export function getDemoHands(t: number): Landmark[][] {
  const sway = Math.sin(t * 0.7) * 0.015
  const bob = Math.sin(t * 1.4) * 0.012
  const rotL = Math.sin(t * 0.9) * 0.08
  const rotR = Math.sin(t * 0.9 + 1.3) * 0.08

  // 图像坐标里 x>0.5 的手，镜像后显示在屏幕左侧 —— 与真实追踪的左右分配一致
  const left = buildHand(0.7 + sway, 0.52 + bob, 0.42, rotL + 0.05)
  const right = buildHand(0.3 - sway, 0.55 - bob, 0.38, rotR - 0.05)

  const phase = t % LOOP
  for (const step of PINCH_SCRIPT) {
    const local = phase - step.at
    if (local >= 0 && local <= PINCH_LEN) {
      const env = smooth(local / 0.25) * (1 - smooth((local - (PINCH_LEN - 0.25)) / 0.25))
      applyPinch(step.hand === 0 ? left : right, step.tip, env)
    }
  }
  return [left, right]
}
