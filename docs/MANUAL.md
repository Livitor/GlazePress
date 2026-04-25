# GlazePress 使用手册

> 基于 Node.js 的 Markdown 静态博客生成器，Glassmorphism 毛玻璃设计风格

---

## 目录

- [环境要求](#环境要求)
- [安装与启动](#安装与启动)
- [命令详解](#命令详解)
- [项目结构](#项目结构)
- [写文章](#写文章)
- [配置文件](#配置文件)
- [页面路由](#页面路由)
- [主题定制](#主题定制)
- [插件系统](#插件系统)
- [部署指南](#部署指南)
- [模板语法参考](#模板语法参考)
- [常见问题](#常见问题)

---

## 环境要求

- **Node.js** >= 18.0.0
- **npm** >= 8.0.0

---

## 安装与启动

```bash
# 克隆项目
git clone https://github.com/your-username/GlazePress.git
cd GlazePress

# 安装依赖
npm install

# 开发模式（首次构建 + 启动本地服务器）
npm run dev
# 访问 http://localhost:3000

# 仅构建
npm run build

# 清除构建产物
npm run clean
```

---

## 命令详解

### npm scripts

| 命令 | 完整命令 | 说明 |
|------|----------|------|
| `npm run dev` | `node dev-server.js` | 构建并启动开发服务器，支持 LiveReload |
| `npm run build` | `node build.js` | 生产环境构建（HTML 压缩） |
| `npm run build:watch` | `node build.js --watch` | 监听文件变更，自动重建 |
| `npm run build:prod` | `node build.js --env=production` | 显式指定生产环境 |
| `npm run clean` | `node build.js --clean` | 删除 `dist/` 目录 |

### 直接使用 node

```bash
# 构建
node build.js                  # 生产构建（默认）
node build.js --env=dev        # 开发构建（不压缩 HTML）
node build.js --env=production # 生产构建

# 监听模式
node build.js --watch          # 文件变更后 300ms 防抖重建

# 清理
node build.js --clean          # 删除 dist/ 目录

# 开发服务器
node dev-server.js             # 默认端口 3000
node dev-server.js --port=8080 # 自定义端口
```

### 构建流程

```
读取 blog.config.js
  → 扫描 src/posts/**/*.md
    → 解析 frontmatter
    → Markdown → HTML（marked v12）
    → HTML 清洗（防 XSS，保留白名单事件）
  → 渲染文章页模板
  → 生成 manifest.json
  → 渲染聚合页面（着陆页、博客、标签、归档等）
  → 复制静态资源（CSS/JS/图片）
  → 注入运行时配置
  → 运行插件钩子（sitemap、rss）
```

---

## 项目结构

```
GlazePress/
├── blog.config.js          # 站点配置（核心）
├── build.js                # 构建入口脚本
├── dev-server.js           # 开发服务器
├── package.json            # 项目依赖
│
├── src/
│   ├── core/               # 核心模块
│   │   ├── builder.js      #   构建主控器
│   │   ├── markdown.js     #   Markdown 解析 + 自定义渲染器
│   │   ├── template-engine.js  # 模板引擎（{{}}语法）
│   │   ├── manifest-generator.js # manifest.json 生成
│   │   └── plugin-manager.js    # 插件管理器
│   │
│   ├── plugins/            # 插件目录
│   │   ├── sitemap.js      #   sitemap.xml 生成
│   │   └── rss.js          #   RSS feed.xml 生成
│   │
│   ├── posts/              # 文章目录（Markdown）
│   │   ├── hello-world.md
│   │   ├── 建站/           #   支持子目录嵌套
│   │   │   └── halo.md
│   │   └── files/          #   文章图片资源
│   │
│   ├── assets/             # 全局静态资源
│   │   └── images/         #   头像、背景图等
│   │
│   └── themes/default/     # 默认主题
│       ├── templates/      #   页面模板
│       │   ├── layout.html       # 主布局（包裹所有页面）
│       │   ├── landing.html      # 着陆页（/ 路径）
│       │   ├── index.html        # 博客主页（/blog/ 路径）
│       │   ├── post.html         # 文章详情页
│       │   ├── tags.html         # 标签聚合页
│       │   ├── categories.html   # 分类聚合页
│       │   ├── archive.html      # 归档时间线页
│       │   ├── about.html        # 关于页
│       │   ├── friends.html      # 友链页
│       │   ├── 404.html          # 404 页
│       │   └── partials/         # 局部模板
│       │       ├── navbar.html   #   导航栏
│       │       ├── footer.html   #   页脚
│       │       ├── post-card.html#   文章卡片
│       │       └── toc.html      #   文章目录
│       ├── css/            #   样式文件
│       │   ├── base.css          #   基础样式
│       │   ├── glassmorphism.css #   毛玻璃效果
│       │   └── animations.css    #   动画效果
│       └── js/             #   脚本文件
│           ├── app.js            #   Vue 3 主应用
│           ├── blog-api.js       #   数据接口
│           └── utils.js          #   工具函数
│
└── dist/                   # 构建输出（npm run clean 删除）
    ├── index.html          #   着陆页
    ├── blog/index.html     #   博客主页
    ├── posts/              #   文章页
    ├── tags/               #   标签页
    ├── data/manifest.json  #   站点数据
    └── assets/             #   静态资源
```

---

## 写文章

### 文件命名与位置

- 文件放在 `src/posts/` 目录下，扩展名 `.md`
- 支持子目录嵌套，如 `src/posts/建站/halo.md`
- 构建后 URL 路径：`/posts/建站/halo/`（保留中文目录结构）
- 构建后文件名取自源 md 文件名，不受 frontmatter 中 title 影响

### Frontmatter 格式

在文章头部使用 YAML 格式：

```markdown
---
title: 文章标题           # 必填，显示在页面和卡片上
date: 2026-01-01          # 必填，格式 YYYY-MM-DD
categories:               # 分类（数组）
  - 前端开发
tags:                     # 标签（数组）
  - Vue
  - JavaScript
description: 文章简介     # 可选，用于卡片摘要
cover: ./cover.jpg        # 可选，封面图
author: 作者名            # 可选，默认取配置中 author.name
---

正文内容，支持标准 Markdown 语法。
```

### 图片资源

**推荐方式**：将图片放在 `src/posts/files/` 目录下：

```markdown
![图片描述](/posts/files/image-name.png)
```

**嵌套目录**：如 `src/posts/建站/halo.md`，图片可放在 `src/posts/建站/file/` 下。

构建时文章关联的图片会自动复制到 `dist/posts/` 对应目录。

### 文章排序

文章按**文件修改时间**降序排列（最新修改的排在最前）。

---

## 配置文件

编辑根目录 `blog.config.js`，所有配置集中管理：

### 站点信息

```js
{
  title: 'GlazePress',           // 站点标题
  description: '站点描述',        // 站点描述
  baseUrl: '',                    // 部署子目录，根部署留空
  author: {
    name: '作者名',
    avatar: './assets/images/avatar.jpg',  // 头像路径
    bio: '个人简介',
    social: {
      github: 'https://github.com/xxx',
      gitee: 'https://gitee.com/xxx',
      bilibili: 'https://space.bilibili.com/xxx',
      email: 'mailto:xxx@xx.com'
    }
  }
}
```

### 主题配置

```js
{
  theme: {
    primary: '#6366f1',           // 主色
    success: '#34d399',           // 成功色
    danger: '#fb7185',            // 危险色
    glassOpacity: {
      light: 0.7,                 // 亮模式毛玻璃不透明度
      dark: 0.6                   // 暗模式毛玻璃不透明度
    },
    font: {
      heading: ['Inter', 'Noto Sans SC', 'sans-serif'],
      body: ['Inter', 'Noto Sans SC', 'sans-serif'],
      code: ['JetBrains Mono', 'Fira Code', 'monospace']
    },
    background: {
      image: './assets/images/bg.jpg',  // 首页背景图
      overlayColor: 'rgba(2, 6, 23, 0.6)'  // 背景遮罩
    }
  }
}
```

### 功能开关

```js
{
  features: {
    darkMode: true,               // 暗色模式切换
    toc: true,                    // 文章目录导航
    search: { provider: 'local' },// 本地搜索
    comments: { provider: 'giscus', repo: '' }, // 评论
    pwa: false,                   // PWA
    math: false,                  // 数学公式
    mermaid: false,               // Mermaid 图表
    readingTime: true,            // 阅读时长
    lightbox: true,               // 图片灯箱
    share: true,                  // 分享按钮
    rss: true                     // RSS 订阅
  }
}
```

### 导航菜单

```js
{
  nav: [
    { label: '首页', url: '/' },
    { label: '归档', url: '/archive/' },
    { label: '分类', url: '/categories/' },
    { label: '标签', url: '/tags/' },
    { label: '友链', url: '/friends/' },
    { label: '关于', url: '/about/' }
  ]
}
```

### 文章配置

```js
{
  posts: {
    postsPerPage: 9,              // 每页文章数
    excerptLength: 150,           // 摘要截取长度
    dateFormat: 'YYYY-MM-DD'     // 日期格式
  }
}
```

### 自定义

```js
{
  custom: {
    googleAnalytics: '',          // GA 跟踪 ID
    baiduTongji: ''              // 百度统计 ID
  }
}
```

---

## 页面路由

| URL 路径 | 模板文件 | 说明 |
|----------|----------|------|
| `/` | `landing.html` | 着陆页（精简门户，无导航栏/页脚） |
| `/blog/` | `index.html` | 博客主页（文章列表 + 导航栏 + 页脚） |
| `/posts/<slug>/` | `post.html` | 文章详情页 |
| `/tags/` | `tags.html` | 标签云 + 按标签分组列表 |
| `/categories/` | `categories.html` | 分类列表 |
| `/archive/` | `archive.html` | 按年月归档时间线 |
| `/friends/` | `friends.html` | 友链页 |
| `/about/` | `about.html` | 关于页 |
| `/404.html` | `404.html` | 404 页面 |

**着陆页 vs 博客页**：
- 着陆页 `/`：仅展示头像、名字、简介、社交链接和"博客"按钮
- 博客页 `/blog/`：完整的博客功能（导航栏、文章卡片、页脚）

---

## 主题定制

### CSS 变量

主题使用 CSS 自定义属性，定义在 `src/themes/default/css/base.css`：

```css
:root {
  --color-primary: #6366f1;
  --color-accent: #ec4899;
  --color-success: #34d399;
  --text-primary: #1e1b4b;
  --text-secondary: #6b7280;
  --bg-glass: rgba(255, 255, 255, 0.7);
  /* ... 更多变量 */
}
```

### 修改样式

- **全局样式**：编辑 `src/themes/default/css/base.css`
- **毛玻璃效果**：编辑 `src/themes/default/css/glassmorphism.css`
- **动画效果**：编辑 `src/themes/default/css/animations.css`

### 修改模板

模板使用自定义 `{{}}` 语法，位于 `src/themes/default/templates/`：

- `layout.html` — 主布局（包裹所有页面的 HTML 骨架）
- 各页面模板 — 页面级内容
- `partials/` — 可复用局部组件

---

## 插件系统

### 插件接口

```js
// src/plugins/my-plugin.js
export default {
  name: 'my-plugin',

  // 构建前钩子
  async beforeBuild(srcDir, config) {},

  // 文章 HTML 转换钩子
  async transformHTML(html, postData, config) {
    return html; // 返回修改后的 HTML
  },

  // 构建后钩子
  async afterBuild(distDir, manifest) {}
};
```

### 注册插件

在 `blog.config.js` 中添加：

```js
plugins: [
  './src/plugins/sitemap.js',
  './src/plugins/rss.js',
  './src/plugins/my-plugin.js'
]
```

### 内置插件

| 插件 | 功能 |
|------|------|
| `sitemap.js` | 生成 `sitemap.xml` |
| `rss.js` | 生成 `feed.xml` (RSS 2.0) |

---

## 部署指南

`dist/` 目录为纯静态文件，可部署到任何静态托管服务。

### GitHub Pages

```bash
# 构建
npm run build

# 将 dist/ 目录内容推送到 gh-pages 分支
```

### Nginx

```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /path/to/GlazePress/dist;
    index index.html;

    # SPA 回退
    location / {
        try_files $uri $uri/ $uri/index.html =404;
    }
}
```

### Vercel / Netlify

- 构建命令：`npm run build`
- 输出目录：`dist`

---

## 模板语法参考

模板引擎支持以下指令：

### 变量输出

```html
<!-- HTML 转义输出 -->
{{config.title}}

<!-- 原始输出（不转义，用于 HTML 内容） -->
{{{post.content}}}
```

### 条件判断

```html
{{#if config.features.darkMode}}
  <button>暗色模式</button>
{{/if}}

{{#if (eq post.status "published")}}
  已发布
{{else}}
  草稿
{{/if}}

{{#unless page_is_landing}}
  此内容在着陆页不显示
{{/unless}}
```

### 比较运算符

```html
{{#if (eq a b)}}     <!-- 等于 -->
{{#if (neq a b)}}    <!-- 不等于 -->
{{#if (gt a b)}}     <!-- 大于 -->
{{#if (lt a b)}}     <!-- 小于 -->
{{#if (gte a b)}}    <!-- 大于等于 -->
{{#if (lte a b)}}    <!-- 小于等于 -->
```

### 循环

```html
{{#each posts}}
  <h2>{{this.title}}</h2>
  <span>索引: {{@index}}</span>
  <span>首个: {{@first}}</span>
  <span>末个: {{@last}}</span>
{{/each}}

{{#each manifest.tags}}
  <h3>{{@key}}</h3>  <!-- 对象迭代时的键名 -->
  {{#each this}}
    <p>{{this.title}}</p>
  {{/each}}
{{/each}}
```

### 局部模板

```html
{{> navbar}}   <!-- 引入 partials/navbar.html -->
{{> footer}}   <!-- 引入 partials/footer.html -->
{{> toc}}      <!-- 引入 partials/toc.html -->
```

---

## 常见问题

### Q: 新文章标题显示 "Untitled"

确保 frontmatter 中有 `title` 字段：
```yaml
---
title: 文章标题
---
```

### Q: 中文文件名的文章构建后无法访问

支持中文文件名，URL 保留原始路径（如 `/posts/建站/halo/`）。确保服务器正确处理 URL 编码。

### Q: 文章内图片构建后看不到

- 图片路径以 `/posts/` 开头：`![alt](/posts/files/image.png)`
- 图片文件需放在 `src/posts/files/` 或对应子目录下
- 构建时会自动复制文章关联的图片资源

### Q: 代码块显示异常

支持 \`bash\`、\`shell\`、\`yaml\`、\`javascript\` 等语言标识，使用 PrismJS 高亮。确保代码块格式正确：

    ```javascript
    const a = 1;
    ```

### Q: 如何修改社交链接

编辑 `blog.config.js` 中 `author.social` 对象，支持 `github`、`gitee`、`bilibili`、`email` 字段。

### Q: 着陆页如何自定义

编辑 `src/themes/default/templates/landing.html`，可修改头像、简介、按钮布局等。

### Q: 如何添加评论

在浏览器设置面板中配置 Giscus 仓库信息，或编辑 `blog.config.js`：

```js
features: {
  comments: {
    provider: 'giscus',
    repo: 'owner/repo'
  }
}
```

---

## 许可

MIT License
