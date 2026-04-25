---
title: "欢迎来到 GlazePress"
date: "2026-04-20"
tags: ["入门", "GlazePress"]
categories: ["博客"]
description: "这是 GlazePress 的第一篇文章，带你了解这个现代化静态博客生成器的核心特性与设计理念。"
cover: ""
author: "GlazePress"
draft: false
---

# 欢迎来到 GlazePress

这是你的 **GlazePress** 博客的第一篇文章！如果你能看到这篇内容，说明构建流程已经成功运行。

## GlazePress 是什么？

GlazePress 是一个基于 **Vue 3** 的现代化静态博客站点生成器 (SSG)，采用 **Glassmorphism（毛玻璃）** 设计语言。它将 Markdown 文件编译为纯静态 HTML，所有运行时依赖通过 CDN 引入。

## 核心特性一览

- 🎨 **Glassmorphism 设计** — 毛玻璃效果贯穿全局（导航栏、卡片、搜索框、代码块）
- ⚡ **极致性能** — 目标 Lighthouse 95+，纯静态部署
- 🔌 **插件系统** — 可扩展的钩子 API，支持自定义 shortcode
- 🌓 **暗色模式** — CSS 变量驱动的主题切换
- 📱 **响应式设计** — 移动端 / 平板 / 桌面端完美适配
- 🔍 **本地搜索** — 基于 manifest.json 的即时搜索
- 📖 **目录导航 (TOC)** — 自动生成并支持滚动高亮

## 快速开始

```bash
# 安装依赖
npm install

# 开发模式（带热重载）
npm run dev

# 生产构建
npm run build
```

## 写作指南

所有文章存放在 `src/posts/` 目录下，使用标准 Markdown 格式 + YAML Frontmatter：

```markdown
---
title: "文章标题"
date: "2026-04-24"
tags: ["标签1", "标签2"]
description: "文章摘要描述"
---

# 正文内容开始...
```

## 接下来？

你可以：

1. 编辑 `blog.config.js` 自定义站点信息
2. 在 `src/posts/` 目录下创建新的 `.md` 文件
3. 运行 `npm run dev` 启动开发服务器预览效果
4. 将 `dist/` 目录部署到任意静态服务器

> **提示**: 草稿文章只需在 frontmatter 中设置 `draft: true` 即可跳过构建。

---

感谢选择 GlazePress，祝你写作愉快！ ✨
