/**
 * Say Love · 云端名字配音代理（Cloudflare Worker）
 *
 * 作用：把"名字"文本转成语音 mp3，让网页端输入任意名字都能获得
 *      「可播放、可录进视频」的配音（系统 TTS 无法被录制，见 README）。
 *
 * 部署（约 5 分钟，免费，无需绑卡）：
 *   1. 注册 https://dash.cloudflare.com （Workers 免费额度：10 万次请求/天）
 *   2. 左侧 Workers & Pages → Create Worker → Deploy（先部署默认代码）
 *   3. Edit code → 把本文件全部内容粘贴进去 → Deploy
 *   4. 记下 Worker 地址（https://xxx.你的用户名.workers.dev），
 *      填入网站的 src/config.ts 里 TTS_PROXY_URL，重新构建部署即可
 *
 * 接口：GET https://你的worker/?text=欢欢          → 中文语音 mp3
 *       GET https://你的worker/?text=Jessica&lang=en → 英文语音 mp3
 *       可选参数 spd=1..7（语速，默认 4）
 *
 * 上游是百度翻译的公开朗读接口（免费、无需 key）。
 * 如果上游失效，这里返回 502，网站会自动回退到预生成配音 / 系统 TTS。
 */

export default {
  async fetch(request) {
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
    }
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors })
    }

    const { searchParams } = new URL(request.url)
    const text = (searchParams.get('text') || '').trim().slice(0, 20)
    const lang = searchParams.get('lang') === 'en' ? 'en' : 'zh'
    const spd = Math.min(7, Math.max(1, Number(searchParams.get('spd')) || 4))

    if (!text) {
      return Response.json({ error: 'missing text' }, { status: 400, headers: cors })
    }

    try {
      const upstream = await fetch(
        `https://fanyi.baidu.com/gettts?lan=${lang}&text=${encodeURIComponent(text)}&spd=${spd}&source=web`,
        { headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' } },
      )
      if (!upstream.ok || !upstream.body) {
        return Response.json({ error: 'tts upstream failed' }, { status: 502, headers: cors })
      }
      return new Response(upstream.body, {
        headers: {
          ...cors,
          'Content-Type': 'audio/mpeg',
          // 同名缓存一周：重复的名字不重复请求上游
          'Cache-Control': 'public, max-age=604800',
        },
      })
    } catch (e) {
      return Response.json({ error: String(e) }, { status: 502, headers: cors })
    }
  },
}
