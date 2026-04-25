/**
 * GlazePress 构建主控器 (Builder)
 *
 * 职责：
 * 1. 读取 blog.config.js 用户配置
 * 2. 扫描 src/posts/ 下所有 .md 文件
 * 3. 协调 markdown 解析 → 模板渲染 → 文件输出
 * 4. 管理插件生命周期钩子
 * 5. 增量构建（基于 mtime）
 * 6. 生成聚合页（tags, archive）和 manifest.json
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync, readdirSync, statSync, copyFileSync } from 'fs';
import { resolve, dirname, relative, join, extname, basename } from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const _require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

import TemplateEngine from './template-engine.js';
import PluginManager from './plugin-manager.js';
import { parseMarkdown, slugify as urlSlugify } from './markdown.js';
import generateManifest from './manifest-generator.js';

export class Builder {
  constructor(options = {}) {
    this.rootDir = options.rootDir || resolve(process.cwd());
    this.srcDir = resolve(this.rootDir, 'src');
    this.postsDir = resolve(this.srcDir, 'posts');
    this.distDir = options.distDir || resolve(this.rootDir, 'dist');
    this.themeDir = resolve(this.srcDir, 'themes/default');
    this.env = options.env || 'development';

    // 核心模块实例
    this.config = null;
    this.templateEngine = new TemplateEngine({
      partialsDir: resolve(this.themeDir, 'templates/partials')
    });
    this.pluginManager = new PluginManager();

    // 构建状态
    this.manifest = null;
    this.builtFiles = new Set();
    this.startTime = Date.now();
  }

  /**
   * 主构建入口
   */
  async build() {
    console.log('\n🚀 GlazePress Build Start\n');

    this.startTime = Date.now();
    this.builtFiles.clear();

    // Step 1: 加载配置
    this._loadConfig();

    // Step 2: 初始化插件系统
    await this._initPlugins();

    // Step 3: 触发 beforeBuild 钩子
    await this.pluginManager.runHook('beforeBuild', this.config, {});

    // Step 4: 确保 dist 目录结构
    this._ensureDistDirs();

    // Step 5: 扫描并构建所有文章
    const posts = await this._buildPosts();

    // Step 6: 生成 manifest.json
    this.manifest = generateManifest(posts);
    this.manifest.site = {
      title: this.config.title,
      description: this.config.description,
      author: this.config.author,
      baseUrl: this.config.baseUrl,
      nav: this.config.nav
    };
    await this._writeManifest();

    // Step 7: 构建聚合页面（首页、标签、归档、关于、404）
    await this._buildAggregatePages(posts);

    // Step 8: 复制静态资源（CSS、JS、图片）
    await this._copyAssets();

    // Step 9: 运行时配置注入
    await this._writeRuntimeConfig();

    // Step 10: 触发 afterBuild 钩子
    await this.pluginManager.runHook('afterBuild', this.distDir, this.manifest);

    // 输出构建报告
    this._printReport(posts.length);
  }

  /**
   * 增量构建：只重建变更的文件
   */
  async incrementalBuild() {
    // 检查 build cache 或对比 mtime
    // 简化实现：检查文件修改时间
    console.log('🔄 Incremental build...\n');
    return this.build(); // 完整重建（后续可优化为增量）
  }

  // ==================== 私有方法 ====================

  /** 加载用户配置文件 */
  _loadConfig() {
    const configPath = resolve(this.rootDir, 'blog.config.js');

    if (!existsSync(configPath)) {
      throw new Error(`Configuration file not found: ${configPath}\nPlease run "npx glazepress init" to create a new project.`);
    }

    try {
      // 使用 createRequire 加载 ESM 配置模块
      const configModule = _require(configPath);
      this.config = configModule.default || configModule;
      console.log(`  ✅ Config loaded: ${this.config.title}`);
    } catch (e) {
      throw new Error(`Failed to load configuration: ${e.message}`);
    }
  }

  /** 初始化插件系统 */
  async _initPlugins() {
    // 从配置加载指定插件（推荐方式）
    if (Array.isArray(this.config.plugins) && this.config.plugins.length > 0) {
      await this.pluginManager.loadFromArray(this.config.plugins);
    } else {
      // 如果配置中没有指定插件，则自动扫描 plugins/ 目录
      const pluginsDir = resolve(this.srcDir, 'plugins');
      await this.pluginManager.loadAllFromDir(pluginsDir);
    }

    const loaded = this.pluginManager.getLoadedPlugins();
    console.log(`  ✅ Plugins loaded (${loaded.length}): ${loaded.join(', ') || '(none)'}`);
  }

  /** 确保 dist 目录结构存在 */
  _ensureDistDirs() {
    const dirs = [
      this.distDir,
      resolve(this.distDir, 'assets/css'),
      resolve(this.distDir, 'assets/js'),
      resolve(this.distDir, 'assets/images'),
      resolve(this.distDir, 'data'),
      resolve(this.distDir, 'posts'),
      resolve(this.distDir, 'tags'),
      resolve(this.distDir, 'categories'),
      resolve(this.distDir, 'archive'),
      resolve(this.distDir, 'about'),
      resolve(this.distDir, 'friends'),
      resolve(this.distDir, 'blog')
    ];

    for (const dir of dirs) {
      mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 扫描 posts 目录，递归读取 .md 文件并构建
   * @returns {Promise<Array>} 构建后的文章列表
   */
  async _buildPosts() {
    const files = this._scanMarkdownFiles(this.postsDir);
    const posts = [];

    for (const filePath of files) {
      try {
        const post = await this._buildSinglePost(filePath);
        if (post) posts.push(post);
      } catch (e) {
        console.error(`  ✗ Error building ${relative(this.rootDir, filePath)}: ${e.message}`);
      }
    }

    return posts;
  }

  /** 递归扫描目录下所有 .md 文件 */
  _scanMarkdownFiles(dir) {
    const results = [];
    if (!existsSync(dir)) return results;

    const entries = readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = resolve(dir, entry.name);

      if (entry.isDirectory()) {
        results.push(...this._scanMarkdownFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        results.push(fullPath);
      }
    }

    return results;
  }

  /**
   * 构建单篇文章
   * @param {string} filePath - Markdown 文件绝对路径
   * @returns {object|null} 文章对象或 null(草稿)
   */
  async _buildSinglePost(filePath) {
    const content = readFileSync(filePath, 'utf-8');
    const relPath = relative(this.postsDir, filePath);
    
    // slug 使用相对于 posts 目录的路径（去掉 .md），保留子目录结构
    // 例: 建站/halo.md → 建站/halo, hello-world.md → hello-world
    const rawSlug = relPath.replace(/\.md$/, '').replace(/\\/g, '/');
    const slug = urlSlugify(rawSlug) || rawSlug;

    // 记录文件修改时间，用于首页排序（最新修改排在最前）
    const mtime = statSync(filePath).mtime.toISOString();

    // 解析 Markdown（传入 postsDir 用于 wiki-link 路径解析）
    const result = parseMarkdown(content, {
      transformMarkdown: (md, fm) => md,
      postsDir: this.postsDir
    });

    // 跳过草稿
    if (result.frontmatter.draft) {
      console.log(`  ⏭ Draft skipped: ${slug}`);
      return null;
    }

    // 复制文章关联资源（同目录及子目录下的非 .md 文件）
    this._copyPostAssets(filePath);

    // 应用 HTML 转换钩子
    let htmlContent = result.html;
    const transformedHTML = await this.pluginManager.runHook('transformHTML', htmlContent, result.frontmatter);
    if (transformedHTML) {
      htmlContent = transformedHTML;
    }

    // 计算文章 URL
    const url = `${this.config.baseUrl}/posts/${slug}/`;

    // 准备模板数据
    const templateData = {
      config: this.config,
      year: new Date().getFullYear(),
      post: {
        ...result.frontmatter,
        slug,
        url,
        content: htmlContent,
        toc: result.toc,
        readingTime: result.readingTime
      },
      manifest: {}
    };

    // 渲染文章详情页模板 → 得到 page_content
    const postTemplatePath = resolve(this.themeDir, 'templates/post.html');
    const pageContent = this.templateEngine.renderFile(postTemplatePath, templateData);

    // 将 page_content 注入 layout 布局
    const layoutData = {
      ...templateData,
      page_content: pageContent,
      page_is_post: true
    };
    const layoutPath = resolve(this.themeDir, 'templates/layout.html');
    let outputHtml = this.templateEngine.renderFile(layoutPath, layoutData);

    // 生产环境压缩
    if (this.env === 'production') {
      outputHtml = this._minifyHTML(outputHtml);
    }

    // 写入文件
    const outPath = resolve(this.distDir, 'posts', slug, 'index.html');
    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, outputHtml, 'utf-8');
    this.builtFiles.add(relative(this.distDir, outPath));

    console.log(`  ✓ Built: /posts/${slug}/`);

    return {
      frontmatter: result.frontmatter,
      slug,
      url,
      readingTime: result.readingTime,
      toc: result.toc,
      mtime
    };
  }

  /** 将 manifest.json 写入 data 目录 */
  async _writeManifest() {
    const manifestPath = resolve(this.distDir, 'data', 'manifest.json');
    writeFileSync(manifestPath, JSON.stringify(this.manifest, null, 2), 'utf-8');
    this.builtFiles.add('data/manifest.json');
    console.log(`  ✓ Generated: manifest.json (${this.manifest.stats.totalPosts} posts)`);
  }

  /**
   * 构建聚合页面：首页、标签、归档、关于、404
   */
  async _buildAggregatePages(posts) {
    const baseTemplateData = {
      config: this.config,
      manifest: this.manifest,
      year: new Date().getFullYear()
    };

    // 将 posts 转换为模板需要的扁平结构（供首页卡片等使用）
    // 按文件修改时间降序排列（最新修改的排最前）
    const flatPosts = posts
      .sort((a, b) => new Date(b.mtime) - new Date(a.mtime))
      .map(p => ({
        title: p.frontmatter.title,
        date: p.frontmatter.date,
        description: p.frontmatter.description || p.frontmatter.excerpt || '',
        cover: p.frontmatter.cover || p.frontmatter.image || '',
        tags: p.frontmatter.tags || [],
        categories: p.frontmatter.categories || [],
        readingTime: p.readingTime,
        url: p.url,
        slug: p.slug,
        mtime: p.mtime
      }));

    // 为标签页预计算标签云数据（tag名称 + 文章数 + 字体大小）
    const tagCloud = Object.entries(this.manifest.tags || {}).map(([name, list]) => ({
      name,
      count: list.length,
      fontSize: (0.75 + Math.min(list.length, 8) * 0.08).toFixed(2)
    }));

    // 为分类页预计算分类数据
    const categoryCloud = Object.entries(this.manifest.categories || {}).map(([name, list]) => ({
      name,
      count: list.length
    }));

    // 着陆页（精简首页，无文章列表，无导航栏链接）
    await this._renderPage('landing', baseTemplateData, '/');
    // 博客页（原首页，含文章列表和导航）
    await this._renderPage('index', { ...baseTemplateData, posts: flatPosts }, '/blog/');
    // 404 页面
    await this._renderPage('404', baseTemplateData, '/404.html');
    // 标签页（传入 tagCloud 数据）
    await this._renderPage('tags', { ...baseTemplateData, tagCloud }, '/tags/');
    // 归档页
    await this._renderPage('archive', baseTemplateData, '/archive/');
    // 分类页
    await this._renderPage('categories', { ...baseTemplateData, categoryCloud }, '/categories/');
    // 关于页
    await this._renderPage('about', baseTemplateData, '/about/');
    // 友链页
    await this._renderPage('friends', baseTemplateData, '/friends/');
  }

  /** 渲染单个页面并写入文件（通过 layout.html 布局包装） */
  async _renderPage(pageName, data, outputPath) {
    // Step 1: 渲染页面模板 → 得到 page_content
    const templatePath = resolve(this.themeDir, 'templates', `${pageName}.html`);
    const pageContent = this.templateEngine.renderFile(templatePath, data);

    // Step 2: 将 page_content 注入 layout 布局
    const layoutData = {
      ...data,
      page_content: pageContent,
      page_is_post: pageName === 'post',
      page_is_landing: pageName === 'landing'
    };
    const layoutPath = resolve(this.themeDir, 'templates/layout.html');
    let html = this.templateEngine.renderFile(layoutPath, layoutData);

    if (this.env === 'production') {
      html = this._minifyHTML(html);
    }

    // 处理输出路径（确保以 index.html 结尾的目录结构）
    const isDirectory = outputPath.endsWith('/');
    let outPath;

    if (isDirectory) {
      outPath = resolve(this.distDir, outputPath.slice(1), 'index.html');
    } else if (outputPath === '/') {
      outPath = resolve(this.distDir, 'index.html');
    } else {
      outPath = resolve(this.distDir, '.' + outputPath);
    }

    mkdirSync(dirname(outPath), { recursive: true });
    writeFileSync(outPath, html, 'utf-8');
    this.builtFiles.add(relative(this.distDir, outPath));
    console.log(`  ✓ Page: ${outputPath}`);
  }

  /** 复制主题资源到 dist */
  async _copyAssets() {
    const assetDirs = [
      { src: 'css', dest: 'assets/css' },
      { src: 'js', dest: 'assets/js' }
    ];

    for (const { src, dest } of assetDirs) {
      const srcDir = resolve(this.themeDir, src);
      const destDir = resolve(this.distDir, dest);

      if (!existsSync(srcDir)) continue;

      mkdirSync(destDir, { recursive: true });
      const files = readdirSync(srcDir);

      for (const file of files) {
        copyFileSync(resolve(srcDir, file), resolve(destDir, file));
        this.builtFiles.add(`${dest}/${file}`);
      }
    }

    // 复制用户本地图片资源
    const imagesSrc = resolve(this.srcDir, 'assets/images');
    const imagesDest = resolve(this.distDir, 'assets/images');

    if (existsSync(imagesSrc)) {
      mkdirSync(imagesDest, { recursive: true });
      const imageFiles = readdirSync(imagesSrc);
      for (const img of imageFiles) {
        copyFileSync(resolve(imagesSrc, img), resolve(imagesDest, img));
        this.builtFiles.add(`assets/images/${img}`);
      }
    }

    console.log(`  ✓ Assets copied`);
  }

  /** 复制文章关联资源到 dist（扫描整个 posts 目录下的非 .md 资源文件） */
  _copyPostAssets(mdFilePath) {
    // 去重：使用类属性缓存，避免每次调用都全量复制
    if (this._postAssetsCopied) return;
    this._postAssetsCopied = true;

    const assetExts = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.mp4', '.webm', '.pdf', '.zip']);

    const collectAssets = (dir) => {
      if (!existsSync(dir)) return [];
      const results = [];
      try {
        const entries = readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = resolve(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
              results.push(...collectAssets(fullPath));
            }
          } else if (entry.isFile() && assetExts.has(extname(entry.name).toLowerCase())) {
            results.push(fullPath);
          }
        }
      } catch (e) { /* 忽略权限错误 */ }
      return results;
    };

    // 扫描整个 src/posts/ 目录的资源
    const assets = collectAssets(this.postsDir);
    let count = 0;
    for (const assetPath of assets) {
      // 保持相对 posts 目录的路径结构
      const relToPosts = relative(this.postsDir, assetPath);
      const destPath = resolve(this.distDir, 'posts', relToPosts);

      mkdirSync(dirname(destPath), { recursive: true });
      try {
        copyFileSync(assetPath, destPath);
        this.builtFiles.add(relative(this.distDir, destPath));
        count++;
      } catch (e) { /* 忽略复制错误 */ }
    }

    this._copiedPostAssetCount = (this._copiedPostAssetCount || 0) + count;
  }

  /** 注入运行时配置（供浏览器端 BlogAPI 使用） */
  async _writeRuntimeConfig() {
    const runtimeConfig = {
      site: {
        title: this.config.title,
        description: this.config.description,
        baseUrl: this.config.baseUrl
      },
      features: this.config.features,
      theme: {
        primary: this.config.theme.primary,
        glassOpacity: this.config.theme.glassOpacity
      },
      nav: this.config.nav,
      author: this.config.author
    };

    const configPath = resolve(this.distDir, 'assets/js/config.js');
    const content = `/**
 * GlazePress 运行时配置
 * 由构建脚本从 blog.config.js 自动生成
 * 请勿手动修改此文件
 */
window.GLASEPRESS_CONFIG = ${JSON.stringify(runtimeConfig, null, 2)};`;

    writeFileSync(configPath, content, 'utf-8');
    this.builtFiles.add('assets/js/config.js');
  }

  /** 简单 HTML 压缩（移除多余空格和注释，保留 pre/code 内格式） */
  _minifyHTML(html) {
    // 保护代码块（code-block-wrapper）和 <pre> 块内的内容（必须保留原始格式）
    const preserved = [];
    // 保护整个 code-block-wrapper（包含 data-raw 等属性和内部结构）
    // 使用循环匹配，因为正则无法匹配嵌套 div
    let searchStart = 0;
    while (true) {
      const startIdx = html.indexOf('<div class="code-block-wrapper"', searchStart);
      if (startIdx === -1) break;
      // 找到匹配的闭合标签（3层嵌套的 </div>）
      let depth = 0;
      let endIdx = startIdx;
      for (let i = startIdx; i < html.length; i++) {
        if (html.substring(i, i + 4) === '<div') {
          depth++;
        } else if (html.substring(i, i + 6) === '</div>') {
          depth--;
          if (depth === 0) {
            endIdx = i + 6;
            break;
          }
        }
      }
      const block = html.substring(startIdx, endIdx);
      const placeholder = `__PRESERVE_${preserved.length}__`;
      preserved.push(block);
      html = html.substring(0, startIdx) + placeholder + html.substring(endIdx);
      searchStart = startIdx + placeholder.length;
    }
    // 保护独立的 <pre> 块
    html = html.replace(/<pre[\s\S]*?<\/pre>/gi, (match) => {
      preserved.push(match);
      return `__PRESERVE_${preserved.length - 1}__`;
    });

    html = html
      .replace(/<!--[\s\S]*?-->/g, '')     // HTML 注释
      .replace(/>\s+</g, '> <')            // 元素间空白保留一个空格
      .replace(/\s{2,}/g, ' ')             // 多个空格变一个
      .trim();

    // 恢复保护的块
    preserved.forEach((block, i) => {
      html = html.replace(`__PRESERVE_${i}__`, block);
    });

    return html;
  }

  /** 输出构建统计报告 */
  _printReport(postCount) {
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);

    console.log('\n' + '='.repeat(50));
    console.log(`  🎉 Build completed in ${elapsed}s`);
    console.log(`  📄 Posts:       ${postCount}`);
    console.log(`  📁 Files:       ${this.builtFiles.size}`);
    if (this._copiedPostAssetCount) {
      console.log(`  🖼 Post assets:  ${this._copiedPostAssetCount} files copied`);
    }
    console.log(`  🔌 Plugins:     ${this.pluginManager.getLoadedPlugins().length}`);
    console.log(`  📦 Output:      ${this.distDir}`);
    console.log(`  🌍 Mode:        ${this.env}`);
    console.log('='.repeat(50) + '\n');
  }
}

export default Builder;
