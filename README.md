# GlazePress

基于 Node.js 的 Markdown 静态博客生成器，采用 Glassmorphism 毛玻璃设计风格。

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（构建 + 启动本地服务器）
npm run dev

# 生产构建
npm run build

# 清除构建产物
npm run clean
```

## 命令一览

| 命令 | 说明 |
|------|------|
| `npm run dev` | 构建并启动开发服务器（默认端口 3000） |
| `npm run build` | 生产环境构建（HTML 压缩） |
| `npm run build:watch` | 监听文件变更自动重建 |
| `npm run build:prod` | 同 `build`，显式指定生产环境 |
| `npm run clean` | 删除 `dist/` 目录 |

### 直接使用 node

```bash
node build.js                # 生产构建
node build.js --env=dev      # 开发构建（不压缩）
node build.js --watch        # 监听模式
node build.js --clean        # 清除 dist/
node dev-server.js           # 开发服务器
node dev-server.js --port=8080  # 指定端口
```

## 写文章

在 `src/posts/` 目录下创建 `.md` 文件：

```markdown
---
title: 文章标题
date: 2026-01-01
categories:
  - 前端开发
tags:
  - Vue
  - JavaScript
description: 文章简介
cover: ./cover.jpg
---

正文内容...
```

- 支持子目录嵌套（如 `src/posts/建站/halo.md`）
- 图片资源放在 `src/posts/files/` 或文章同名目录下
- 构建后文章按修改时间降序排列

## 配置

编辑 `blog.config.js`：

```js
export default {
  title: '我的博客',
  description: '博客描述',
  author: {
    name: '作者名',
    avatar: './assets/images/avatar.jpg',
    bio: '个人简介',
    social: {
      github: 'https://github.com/xxx',
      email: 'mailto:xxx@xx.com'
    }
  },
  baseUrl: '',          // 子目录路径，根部署留空
  theme: {
    primary: '#6366f1', // 主色
  },
  nav: [
    { label: '首页', url: '/' },
    { label: '标签', url: '/tags/' },
  ],
};
```

## 页面结构

| 路径 | 页面 |
|------|------|
| `/` | 着陆页（精简门户） |
| `/blog/` | 博客主页（文章列表） |
| `/posts/xxx/` | 文章详情 |
| `/tags/` | 标签云 |
| `/categories/` | 分类列表 |
| `/archive/` | 归档时间线 |
| `/friends/` | 友链页 |
| `/about/` | 关于页 |

## 部署

`dist/` 目录为纯静态文件，可部署到任意静态托管服务：

- GitHub Pages
- Vercel / Netlify
- Nginx / Caddy
- 腾讯云 COS / 阿里云 OSS

## 技术栈

- Markdown 解析：marked v12
- 前端框架：Vue 3 (CDN)
- CSS：Tailwind CSS (CDN) + 自定义毛玻璃样式
- 动画：GSAP (CDN)
- 代码高亮：PrismJS (CDN)
- 模板引擎：自定义字符串扫描解析器

## 许可

MIT
