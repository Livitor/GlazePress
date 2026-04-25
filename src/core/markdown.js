/**
 * Markdown 处理器 - GlazePress 核心模块
 *
 * 职责：
 * 1. 解析 frontmatter (YAML 元数据)
 * 2. 将 Markdown 转换为 HTML (marked.js)
 * 3. 支持 Obsidian wiki-link 语法 (![[path]])
 * 4. 代码块增强（PrismJS class + 行号）
 * 5. 图片懒加载属性注入
 * 6. 标题锚点 ID 生成
 * 7. TOC 目录 HTML 片段生成
 *
 * 扩展点：可通过 Plugin.transformMarkdown() 钩子自定义转换逻辑
 */

import matter from 'gray-matter';
import { marked } from 'marked';
import { existsSync, readdirSync } from 'fs';
import { resolve, relative } from 'path';
import { Buffer } from 'buffer';

/** 将文本转为 URL 友好的 slug（支持中文保留，保留 / 用于子目录路径） */
function slugify(text) {
  // 分别处理每个路径段，保留 / 分隔符
  return text.split('/')
    .map(segment => segment.toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^\w\u4e00-\u9fa5\-]+/g, '') // 保留中文
      .replace(/\-\-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, ''))
    .filter(s => s.length > 0)  // 移除空段
    .join('/');
}

/**
 * 预处理：转换 wiki-link 语法为标准 Markdown
 * ![[image.png]] → ![](image.png)
 * ![[path/to/image.png|alt]] → ![alt](image.png)
 * [[link]](text) → [text](link)
 *
 * 路径解析策略：
 *   Obsidian 的 ![[Home/env/files/img.png]] 中路径是相对于 vault 根的
 *   但实际文件可能只存在于 posts 目录的某个子目录下（如 posts/files/img.png）
 *   所以需要根据实际文件位置来生成正确的 URL
 */
function preprocessObsidianSyntax(md, postsDir) {
  // 只对空格做最小编码
  const encodePath = (p) => p.replace(/ /g, '%20');

  // 从 wiki-link 路径找到实际文件在 posts 目录下的相对路径
  const resolveWikiPath = (wikiPath) => {
    // 先尝试完整路径（相对于 posts 目录）
    if (postsDir) {
      const fullPath = resolve(postsDir, wikiPath);
      if (existsSync(fullPath)) {
        const relToPosts = relative(postsDir, fullPath).replace(/\\/g, '/');
        return encodePath('/posts/' + relToPosts);
      }
    }

    // 完整路径不存在，尝试按文件名在 posts 目录下搜索
    if (postsDir) {
      const fileName = wikiPath.split('/').pop();
      const found = findFileByName(postsDir, fileName);
      if (found) {
        const relToPosts = relative(postsDir, found).replace(/\\/g, '/');
        return encodePath('/posts/' + relToPosts);
      }
    }

    // 都找不到，保留原始路径
    return encodePath(wikiPath.includes('/') ? '/posts/' + wikiPath : wikiPath);
  };

  // 图片 wiki-link: ![[path]] 或 ![[path|alt]]
  let processed = md.replace(
    /!\[\[([^\]|]+?)(?:\|([^\]]*?))?\]\]/g,
    (_match, path, alt) => `![${alt || ''}](${resolveWikiPath(path)})`
  );
  // 内部链接: [[path]] 或 [[path|text]]
  processed = processed.replace(
    /(?<!!)\[\[([^\]|]+?)(?:\|([^\]]*?))?\]\]/g,
    (_match, link, text) => `[${text || link}](${resolveWikiPath(link)})`
  );
  return processed;
}

/** 在目录下递归查找指定文件名的文件（返回第一个匹配的完整路径） */
function findFileByName(dir, fileName, depth = 0) {
  if (depth > 6 || !existsSync(dir)) return null;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = resolve(dir, entry.name);
      if (entry.isFile() && entry.name === fileName) return fullPath;
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        const found = findFileByName(fullPath, fileName, depth + 1);
        if (found) return found;
      }
    }
  } catch (e) { /* ignore */ }
  return null;
}

// DOMPurify 可选：如需 XSS 防护，取消下方注释并安装 jsdom
// import { createRequire } from 'module';
// const _require = createRequire(import.meta.url);
// const { JSDOM } = _require('jsdom');
// const window = new JSDOM('').window;
// const DOMPurify = _require('dompurify')(window);

/** 简单的 HTML 清洗（替代 DOMPurify 基础功能）
 *  白名单保留 copyCode / openLightbox 等合法事件
 */
function sanitizeHTML(html) {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // 移除危险事件属性，但保留 copyCode / openLightbox 等白名单
    .replace(/\s+on\w+\s*=\s*"([^"]*)"/gi, (match, val) => {
      const allowed = ['copyCode', 'openLightbox', 'closeLightbox', 'sharePost', 'toggleMobileMenu', 'lightboxDragStart'];
      return allowed.some(fn => val.includes(fn)) ? match : '';
    })
    .replace(/\s+on\w+\s*=\s*'([^']*)'/gi, (match, val) => {
      const allowed = ['copyCode', 'openLightbox', 'closeLightbox', 'sharePost', 'toggleMobileMenu', 'lightboxDragStart'];
      return allowed.some(fn => val.includes(fn)) ? match : '';
    });
}

// 配置 marked 渲染器选项
const MARKED_OPTIONS = {
  gfm: true,           // GitHub Flavored Markdown
  breaks: false,       // 不将 \n 转为 <br>
  pedantic: false,
  mangle: false,       // 不转义邮箱地址
};

/**
 * 解析 Markdown 文件内容
 * @param {string} content - 原始 Markdown 字符串
 * @param {object} pluginContext - 插件上下文（用于钩子调用）
 * @returns {{ frontmatter: object, html: string, toc: string, readingTime: number }}
 */
export function parseMarkdown(content, pluginContext = {}) {
  // 1. 解析 frontmatter
  const { data: _rawFm, content: mdBody } = matter(content);

  // 默认值填充
  const defaults = {
    title: 'Untitled',
    date: new Date().toISOString().split('T')[0],
    tags: [],
    categories: [],
    description: '',
    cover: '',
    author: '',
    draft: false,
    toc: true,
    comments: true
  };
  const frontmatter = { ...defaults, ..._rawFm };

  // 如果标题仍为默认值（无 frontmatter），尝试从正文首级标题或文件名提取
  if (frontmatter.title === 'Untitled') {
    const headingMatch = mdBody.match(/^#+\s+(.+)$/m);
    if (headingMatch) {
      // 去除 Markdown 链接语法: [text](url) → text
      const rawTitle = headingMatch[1].trim();
      frontmatter.title = rawTitle.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1');
    }
  }

  // 2. 草稿跳过检查由 builder 层处理，此处只解析

  // 3. Obsidian 语法预处理（在 marked 解析之前转换）
  let processedMd = preprocessObsidianSyntax(mdBody, pluginContext.postsDir);

  // 4. 调用插件 transformMarkdown 钩子（如果存在）
  if (pluginContext.transformMarkdown) {
    processedMd = pluginContext.transformMarkdown(processedMd, frontmatter);
  }

  // 5. 配置 marked 自定义渲染器
  const renderer = new marked.Renderer();

  // --- 自定义代码块渲染 (marked v12+ API: code(token) 或 code(code, infostring)) ---
  renderer.code = function(codeOrToken, infostring) {
    // marked v12+ 传入 token 对象 { type, lang, text, escaped }
    // marked v5~v11 传入 (code, infostring, escaped)
    let code, language;
    if (typeof codeOrToken === 'object' && codeOrToken !== null) {
      code = codeOrToken.text || '';
      language = codeOrToken.lang || '';
    } else {
      code = String(codeOrToken || '');
      language = infostring || '';
    }
    language = language.match(/\S*/)?.[0] || 'plaintext';
    const escapedText = escapeHtml(code);

    // 用 data-raw 存储 base64 编码的原始代码，确保复制时格式正确
    const rawB64 = Buffer.from(code, 'utf-8').toString('base64');

    return `
<div class="code-block-wrapper" data-raw="${rawB64}">
  <div class="code-block-header">
    <span class="code-language">${language}</span>
    <button class="code-copy-btn" onclick="copyCode(this)" title="复制代码">
      <svg class="copy-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"></path>
      </svg>
      <span class="copy-text">复制</span>
    </button>
  </div>
  <div class="code-block-body">
    <pre><code class="language-${language}">${escapedText}</code></pre>
  </div>
</div>`;
  };

  // --- 自定义图片渲染（懒加载）marked v12+ 兼容 ---
  renderer.image = function(hrefOrToken, title, text) {
    let href, imgTitle, imgText;
    if (typeof hrefOrToken === 'object' && hrefOrToken !== null) {
      href = hrefOrToken.href || '';
      imgTitle = hrefOrToken.title || '';
      imgText = hrefOrToken.text || '';
    } else {
      href = hrefOrToken || '';
      imgTitle = title || '';
      imgText = text || '';
    }
    if (!href) return '';
    return `
<figure class="markdown-image">
  <img src="${href}"
       alt="${imgText}"
       loading="lazy"
       decoding="async"
       data-src="${href}"
       ${imgTitle ? `title="${imgTitle}"` : ''}
       onclick="openLightbox(this)" />
  ${imgText ? `<figcaption>${escapeHtml(imgText)}</figcaption>` : ''}
</figure>`;
  };

  // --- 自定义标题渲染（锚点 ID）marked v12+ 兼容 ---
  let headingIds = {}; // 用于去重
  renderer.heading = function(textOrToken, depth) {
    let headingText, headingDepth;
    if (typeof textOrToken === 'object' && textOrToken !== null) {
      headingText = textOrToken.text || '';
      headingDepth = textOrToken.depth || 1;
    } else {
      headingText = textOrToken || '';
      headingDepth = depth || 1;
    }
    const rawText = headingText.replace(/<[^>]*>/g, '').trim();
    const baseId = slugify(rawText);
    const id = uniqueId(baseId, headingIds);

    return `
<h${headingDepth} id="${id}" class="markdown-heading">
  <a href="#${id}" class="heading-anchor" aria-hidden="true">#</a>
  ${headingText}
</h${headingDepth}>`;
  };

  // --- 自定义引用块渲染 marked v12+ 兼容 ---
  renderer.blockquote = function(textOrToken) {
    const bqText = typeof textOrToken === 'object' && textOrToken !== null
      ? (textOrToken.text || '')
      : (textOrToken || '');
    return `<blockquote class="markdown-blockquote">${bqText}</blockquote>`;
  };

  // --- 表格渲染（圆角 + 斑马纹容器）marked v12+ 兼容 ---
  renderer.table = function(headerOrToken, body) {
    let thead, tbody;
    if (typeof headerOrToken === 'object' && headerOrToken !== null) {
      thead = headerOrToken.header || '';
      tbody = headerOrToken.body || '';
    } else {
      thead = headerOrToken || '';
      tbody = body || '';
    }
    if (tbody) tbody = `<tbody>${tbody}</tbody>`;

    return `
<div class="table-wrapper">
<table class="markdown-table">
  <thead>${thead}</thead>
  ${tbody}
</table>
</div>`;
  };

  // --- 分割线装饰 ---
  renderer.hr = () => {
    return `<hr class="markdown-hr" />`;
  };

  marked.setOptions({ ...MARKED_OPTIONS, renderer });

  // 6. 执行 Markdown → HTML 转换
  let rawHtml = marked(processedMd);

  // 7. HTML 清洗（防止 XSS - 基础防护，可替换为 DOMPurif 增强安全性）
  rawHtml = sanitizeHTML(rawHtml);

  // 8. 生成 TOC
  const toc = generateTOC(rawHtml);

  // 9. 计算阅读时长
  const readingTime = calculateReadingTime(processedMd);

  return {
    frontmatter,
    html: rawHtml,
    toc,
    readingTime
  };
}

/**
 * 从 HTML 中提取标题并生成 TOC 导航 HTML
 */
function generateTOC(html) {
  const headingRegex = /<h([2-6])[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/h\1>/g;
  const headings = [];
  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    const level = parseInt(match[1]);
    const id = match[2];
    const text = match[3].replace(/<[^>]+>/g, '').trim();
    headings.push({ level, id, text });
  }

  if (headings.length === 0) return '';

  const items = headings.map(h =>
    `  <li class="toc-item toc-level-${h.level}" data-id="${h.id}">
    <a href="#${h.id}" class="toc-link">${escapeHtml(h.text)}</a>
  </li>`
  ).join('\n');

  return `<nav class="toc-nav" id="table-of-contents">\n<ul class="toc-list">\n${items}\n</ul>\n</nav>`;
}

/** 计算阅读时长（中文约400字/分钟，英文约200词/分钟） */
function calculateReadingTime(text) {
  const cleaned = text.replace(/```[\s\S]*?```/g, '') // 移除代码块
                       .replace(/[#*`\-\[\]()>#]/g, ''); // 移除格式符号

  const chineseCount = (cleaned.match(/[\u4e00-\u9fa5]/g) || []).length;
  const englishCount = (cleaned.match(/[a-zA-Z]+/g) || []).length;

  const minutes = Math.ceil(chineseCount / 400 + englishCount / 200);
  return Math.max(1, minutes);
}

/** 生成唯一 ID（处理重复标题） */
function uniqueId(baseId, registry) {
  if (!registry[baseId]) {
    registry[baseId] = 1;
    return baseId;
  }
  const id = `${baseId}-${registry[baseId]}`;
  registry[baseId]++;
  return id;
}

/** HTML 转义 */
function escapeHtml(str) {
  return str.replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
}

export default parseMarkdown;
export { preprocessObsidianSyntax, slugify, escapeHtml };
