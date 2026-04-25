---
title: "Web 性能优化实战：从 60 分到 Lighthouse 100"
date: "2026-04-10"
tags: ["性能", "优化", "Core Web Vitals"]
categories: ["前端开发", "性能"]
description: "系统性的 Web 性能优化方法论，涵盖 Core Web Vitals 指标解读、资源加载策略、渲染性能优化，以及 GlazePress 项目中的具体实践。"
author: ""
draft: false
---

# Web 性能优化实战

性能不是可选项，而是**基础设施**。本文将分享一套从理论到实践的完整性能优化体系。

## Core Web Vitals 理解

Google 定义的 **Core Web Vitals** 是衡量用户体验的三大核心指标：

| 指标 | 全称 | 目标值 | 测量什么 |
|------|------|--------|----------|
| **LCP** | Largest Contentful Paint | < 2.5s | 页面主要内容何时可见 |
| **INP** | Interaction to Next Paint | < 200ms | 页面对用户交互的响应速度 |
| **CLS** | Cumulative Layout Shift | < 0.1 | 视觉稳定性（是否发生布局偏移） |

> **注意**: FID (First Input Delay) 已在 2024 年被 INP 替代。

### LCP 优化策略

LCP 的候选元素通常是：

1. **大图/封面图**
2. **文本块（如 `<h1>`）**
3. **视频/Canvas 元素**

```html
<!-- 优化前：无尺寸提示，导致 CLS -->
<img src="hero.jpg" alt="Hero" loading="lazy">

<!-- 优化后：固定尺寸 + 懒加载 + 低质量占位 -->
<img src="lqip-hero.jpg"
     srcset="hero.jpg"
     width="1200" height="630"
     loading="lazy"
     decoding="async"
     class="fade-in-on-load">
```

### CLS 预防清单

> 布局偏移是用户体验中**最令人烦躁**的问题之一。

常见原因及解决方案：

| 原因 | 解决方案 |
|------|----------|
| 图片无尺寸属性 | 设置 `width` / `height` |
| 动态插入内容 | 为内容预留空间 |
| 字体加载导致 FOIT | 使用 `font-display: swap` |
| 网络广告注入 | 使用容器预留空间 |

## 资源加载策略

### 关键路径优化

```
HTML 解析
    ↓
关键 CSS (内联 <head>)
    ↓
首屏 HTML 渲染 (FCP)
    ↓
非关键 CSS (异步)
    ↓
JS (defer/async)
    ↓
图片 (lazy loading)
```

### CDN 资源预连接

```html
<!-- preconnect 提前建立连接 -->
<link rel="preconnect" href="https://unpkg.com" crossorigin>
<link rel="preconnect" href="https://cdn.tailwindcss.com" crossorigin>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="dns-prefetch" href="https://unpkg.com"> <!-- DNS 预解析 -->
```

### 字体加载优化

```css
/* font-display: swap — 先显示后备字体，自定义字体就绪后替换 */
@font-face {
  font-family: 'Inter';
  src: url('/fonts/inter.woff2') format('woff2');
  font-display: swap; /* 关键！ */
}
```

## JavaScript 性能

### Vue 3 最小化运行时开销

GlazePress 的核心原则：**Vue 只负责交互区域**，不挂载整个 body。

```javascript
// ✅ 正确做法：按需挂载交互组件
const app = createApp(ThemeToggle);
app.mount('#app-theme'); // 只挂载切换按钮

const searchApp = createApp(SearchModal);
searchApp.mount('#search-container'); // 只挂载搜索框

// ❌ 错误做法：全量挂载
// const app = createApp(App);
// app.mount('body'); // 性能灾难！
```

### 防抖与节流

```javascript
// 搜索输入防抖 (300ms)
const debouncedSearch = debounce((query) => {
  BlogAPI.search(query).then(renderResults);
}, 300);

// 滚动事件节流 (16ms ≈ 60fps)
const throttledScroll = throttle(() => {
  updateProgressBar();
}, 16);
```

## 动画性能黄金法则

> **永远只使用 `transform` 和 `opacity` 来做动画。**

这两个属性不会触发 **Layout（重排）** 或 **Paint（重绘）**，只触发 **Composite（合成）**，由 GPU 直接处理。

```css
/* ✅ 高性能动画 */
.card-hover {
  transition: transform 200ms ease, box-shadow 200ms ease;
}

.card-hover:hover {
  transform: translateY(-4px); /* 仅 transform */
}

/* ❌ 低性能动画（避免！）*/
.bad-animation {
  /* 这些会触发 Layout 重排 */
  top: 10px;        /* ❌ 触发重排 */
  width: 50%;       /* ❌ 触发重排 */
  left: calc(...);  /* ❌ 触发重排 */
}
```

## GlazePress 性能目标

| 维度 | 目标值 | 实现方式 |
|------|--------|----------|
| LCP | < 2.5s | 关键CSS内联 + CDN预连接 + 字体swap |
| INP | < 200ms | Vue按需挂载 + 事件委托 + 防抖搜索 |
| CLS | < 0.1 | 图片width/height + font-display:swap |
| TTFB | < 600ms | 纯静态文件 + Brotli/Gzip压缩 |
| FPS | 60 | 仅transform+opacity动画 |

---

性能优化是一个持续的过程。记住：**测量 > 优化 > 再测量**。没有数据支撑的优化只是猜测。
