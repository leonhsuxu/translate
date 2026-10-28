# 免费翻译 · Free Translate

一个可一键部署到 **Vercel** 的零密钥翻译 Web 工具。调用公开翻译接口（Google `gtx` 优先，MyMemory 备用），**无需 API Key、无需登录、无需 VPS / Docker**。

## 特性

- ✅ 部署简单：纯 Next.js 项目，Vercel 自动识别，零配置
- ✅ 零密钥：使用 Google 翻译公开接口 + MyMemory 公共 API，均不需要注册或 Key
- ✅ 服务端代理：翻译请求走 Next.js Serverless API Route，规避浏览器跨域（CORS）限制
- ✅ 自动检测语言：Google 引擎支持源语言「自动检测」
- ✅ 多语言：内置 20+ 常用语言，可自由扩展
- ✅ 轻量：无数据库、无第三方翻译 SDK，仅 React + Next.js

## 本地运行

```bash
npm install
npm run dev
# 打开 http://localhost:3000
```

## 部署到 Vercel

### 方式一：Git 导入（推荐）

1. 将此项目推送到 GitHub / GitLab / Bitbucket
2. 打开 [vercel.com/new](https://vercel.com/new) → Import 你的仓库
3. Framework 选择 **Next.js**，其余默认 → Deploy

### 方式二：Vercel CLI

```bash
npm i -g vercel
vercel login
vercel
```

部署后 Vercel 会分配一个 `*.vercel.app` 域名，直接可用。

## 工作原理

前端 `/api/translate` 是 Next.js Route Handler（Serverless Function），在服务端发起翻译请求：

1. 优先请求 Google 翻译公开接口 `translate.googleapis.com/translate_a/single?client=gtx`
2. 若 Google 失败（限流 / 网络），自动回退到 MyMemory `api.mymemory.translated.net`
3. 返回翻译结果、检测到的语言、使用的引擎

由于请求在服务端完成，浏览器无需直连 Google，避免 CORS 与密钥暴露问题。

## 扩展语言

编辑 `lib/languages.ts`，按 ISO-639-1 代码追加即可（如 `{ code: "sv", name: "瑞典语" }`）。

## 限制说明

- Google 公开接口属于非官方端点，Vercel 默认美区部署一般可访问；如所在网络无法直连，会自动回退 MyMemory。
- MyMemory 免费额度约每日 5000 字符/IP，适合个人轻度使用。
- 单次翻译文本上限 5000 字符（可在 `app/api/translate/route.ts` 调整）。
