import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 单页应用没有用路由嵌套，直接挂载；URL 参数（?to=名字）由 Home 自己解析。
// 不引入 BrowserRouter：这样无论部署在域名根路径还是 /仓库名/ 子路径都能正常渲染。
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
