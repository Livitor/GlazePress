---
title: "快速开始指南"
date: "2026-04-21"
tags: ["入门", "教程", "配置"]
categories: ["博客", "教程"]
description: "从零开始搭建你的 GlazePress 博客，包括安装、配置、写作和部署的完整流程。"
author: ""
draft: false
---

# 快速开始指南

本文将带你从零开始搭建一个完整的 GlazePress 静态博客。

## 环境要求

在开始之前，请确保你已经安装了以下环境：

| 软件 | 最低版本 | 推荐版本 |
|------|----------|----------|
| Node.js | >= 18.0 | >= 20.0 LTS |
| npm | >= 9.0 | 最新版 |
| Git (可选) | - | 用于版本控制 |

> **注意**: GlazePress 使用 ES Modules (`"type": "module"`)，请确保 Node.js 版本支持。

## 第一步：创建项目

```bash
# 克隆或解压项目到本地目录
cd glazepress

# 安装构建依赖（仅开发时需要）
npm install
```

项目结构如下：

```
glazepress/
├── blog.config.js          # 用户配置文件
├── build.js                 # 构建脚本入口
├── dev-server.js            # 开发服务器
├── src/
│   ├── core/                # 构建引擎核心
│   ├── plugins/             # 插件目录
│   ├── themes/default/      # 默认主题
│   └── posts/               # Markdown 文章源码
└── dist/                    # 构建产物输出
```

## 第二步：配置站点信息

编辑 `blog.config.js` 文件：

```javascript
export default {
  title: '我的博客',
  description: '这是我的个人博客',
  author: {
    name: 'Your Name',
    avatar: './assets/images/avatar.jpg',
    bio: '前端开发者 / 技术博主'
  },
  theme: {
    primary: '#6366f1',    // 主色调
  },
  features: {
    darkMode: true,         // 启用暗色模式
    toc: true,              // 启用文章目录
  }
};
```

## 第三步：撰写文章

在 `src/posts/` 目录下创建 `.md` 文件：

### Frontmatter 配置项

每个文章必须包含 YAML frontmatter 块：

| 字段 | 类型 | 必填 | 说明 |
|------|------|:----:|------|
| `title` | string | 是 | 文章标题 |
| `date` | string | 是 | 发布日期 (YYYY-MM-DD) |
| `tags` | string[] | 否 | 标签列表 |
| `description` | string | 否 | 摘要描述 |
| `cover` | string | 否 | 封面图 URL |
| `author` | string | 否 | 作者名称 |
| `draft` | boolean | 否 | 是否为草稿 |

### Markdown 语法支持

GlazePress 支持标准 **GitHub Flavored Markdown**：

- 标题 (h1-h6)
- **粗体** 和 *斜体*
- 行内 `code` 和代码块
- [链接](url) 和图片
- 有序/无序列表
- > 引用块
- 表格
- 分割线

## 第四步：开发与预览

```bash
# 开发模式（自动热重载）
npm run dev

# 或手动构建 + 预览
npm run build
node dev-server.js
```

访问 `http://localhost:3000` 即可查看效果。

## 第五步：生产构建与部署

```bash
# 生产环境构建（压缩 HTML）
node build.js --env=production
```

构建完成后，`dist/` 目录即为可部署的静态文件。

### 部署平台推荐

1. **Vercel**: 连接 Git 仓库即可自动部署
2. **GitHub Pages**: 推送到 `gh-pages` 分支
3. **Netlify**: 拖拽 `dist/` 目录即可
4. **Nginx**: 直接将 `dist/` 目录指向站点根目录

---

> 🎉 恭喜！现在你已经有了一个完整的静态博客。接下来可以尝试自定义主题、编写插件或优化 SEO。
