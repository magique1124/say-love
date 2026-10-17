# Say Love · 手势表白 🖐️❤️

对朋友、家人、crush，或者你自己 —— 举起双手，拇指捏住手指，把 **"I Love {名字} so much"** 一个个词说出口，录成视频发给 TA。

灵感来自 TOUCH DESIGN LAB 的手势实验：摄像头实时追踪双手骨骼，手指上挂着彩色的词，捏一捏，词就会弹起来、被"说"出来；捏到名字和 so 还会炸出一把爱心。

![stack](https://img.shields.io/badge/React-18-61dafb) ![stack](https://img.shields.io/badge/TypeScript-5-blue) ![stack](https://img.shields.io/badge/MediaPipe-Hands-pink)

## ✨ 功能

- 🖐️ **实时手势追踪**：MediaPipe HandLandmarker 本地推理，最多同时追踪 2 只手，视频**不会上传**
- 🤏 **捏合发声**：拇指捏食指/中指/无名指，对应词弹出并语音播报（I/Love/so/much 为预生成配音，名字见下）
- 💥 **爱心粒子**：捏到名字和 so 的瞬间炸出满屏爱心
- 🎬 **一键录制**：把画面（含 ins 滤镜）和声音一起录成 mp4/webm，预览后下载发给 TA
- ✏️ **名字自定义**：输入框随手改，支持 `?to=名字` URL 参数分享专属链接
- 🎙️ **云端名字配音（可选）**：部署附带 Worker 后，**任意名字**都能实时合成语音并录进视频
- 🎭 **演示模式**：没有摄像头也能自动演示完整效果
- 🔇 声音开关、⏱️ 追踪 HUD、底部高亮句同步

## 🚀 快速开始

```bash
npm install
npm run dev        # http://localhost:7100
npm run build      # 产物在 dist/，纯静态，任意静态托管即可（含 GitHub Pages）
```

> 摄像头需要 `localhost` 或 HTTPS 环境。

## 🌐 部署到 GitHub Pages

`vite.config.ts` 已设置 `base: './'`（相对路径），构建产物是自包含的（WASM、模型、配音都在包里，不依赖任何 CDN）：

1. 把代码推到 GitHub 仓库
2. 仓库 Settings → Pages → Source 选 GitHub Actions（或把 `npm run build` 的 `dist/` 推到 `gh-pages` 分支）
3. 得到一个 `https://你的用户名.github.io/仓库名/` 的网址，发给任何人都能直接用

## ☁️ 云端名字配音 Worker（推荐，约 5 分钟）

部署后，使用者输入**任意名字**都能实时配音并录进视频；不部署也能用（回退到预生成 + 系统 TTS）。

1. 注册 [Cloudflare](https://dash.cloudflare.com)（免费，Workers 免费额度 10 万次请求/天）
2. Workers & Pages → Create Worker → 先 Deploy 默认代码
3. Edit code → 把 [`worker/tts-proxy.js`](worker/tts-proxy.js) 全部粘贴进去 → Deploy
4. 把 Worker 地址填入 [`src/config.ts`](src/config.ts) 的 `TTS_PROXY_URL`，重新构建部署

> 名字文本会经你的 Worker 转发给上游 TTS 服务换取音频（见 Worker 文件头注释）。

## 🎨 自定义

只动 [`src/config.ts`](src/config.ts)：

```ts
export const DEFAULT_NAME = '欢欢'    // 默认名字
export const RECORDED_NAME = '欢欢'   // 本地预生成配音（public/voice/name.mp3）对应的名字
export const TTS_PROXY_URL = ''       // 云端配音 Worker 地址，留空禁用

// 每个词的文案、颜色、语音、倾斜角度
case 'much':
  return { display: 'much.', speech: 'much', lang: 'en-US', color: '#ff2e88', ... }

// 统一的 ins 滤镜：屏幕显示与录制视频共用
export const INS_FILTER = 'brightness(1.09) saturate(1.32) contrast(1.05)'
```

名字优先级：URL 参数 `?to=` > 访问者 localStorage > `DEFAULT_NAME`。

**给名字加预生成配音**：把任意 TTS 工具生成的 mp3 放到 `public/voice/name.mp3`，
并把 `RECORDED_NAME` 改成对应的名字即可（输入名匹配时优先使用，可录进视频）。

## 🧠 原理

| 模块 | 实现 |
| --- | --- |
| 手部追踪 | `@mediapipe/tasks-vision` HandLandmarker，`VIDEO` 模式逐帧检测，GPU 不可用时自动回退 CPU |
| 捏合识别 | 拇指尖(4)与目标指尖(8/12/16)归一化距离 < 手掌尺寸 × 0.42，边沿触发（按下沿才触发一次） |
| 配音播放 | 生成 mp3 经 WebAudio 播放；**录制时经 `MediaStreamDestination` 分流进录制器**，所以能录进视频 |
| 名字配音 | 三级回退：云端 TTS Worker → 本地预生成 mp3（名字匹配时）→ 系统 TTS（实时但不可录制） |
| 录制 | Canvas `captureStream` + 音频轨合并为 `MediaStream`，`MediaRecorder` 导出；录制帧按预览效果烘焙（镜像 + ins 滤镜） |
| 渲染 | 单 Canvas 覆盖层与视频一起 CSS 镜像，rAF 直接绘制，不经 React 状态 |
| 演示模式 | 程序生成 21 点虚拟手掌，套用同一套捏合检测与渲染逻辑 |

## 🔒 隐私

手势识别完全在浏览器本地完成，视频不上传；名字文本仅在启用云端 Worker 时经你的 Worker 转发换取音频。

## 📄 License

MIT —— 拿去改、拿去爱。
