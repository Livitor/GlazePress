/**
 * GlazePress - BlogAPI 浏览器端全局对象
 *
 * 挂载到 window.BlogAPI，暴露：
 *   - getPosts()       从 manifest.json 获取文章列表
 *   - getTags()        获取所有标签
 *   - search(query)    本地搜索文章
 *   - toggleTheme()    切换暗色模式
 *   - openSearch()     打开搜索模态框
 */

(function(global) {
  'use strict';

  // ==================== 状态 ====================
  let _manifestCache = null;
  let _searchIndex = null;

  // ==================== Manifest 数据获取 ====================

  /**
   * 异步加载 manifest.json（带缓存）
   * @returns {Promise<object>}
   */
  async function fetchManifest() {
    if (_manifestCache) return _manifestCache;

    try {
      const baseUrl = (global.GLASEPRESS_CONFIG?.site?.baseUrl || '').replace(/\/$/, '');
      const resp = await fetch(`${baseUrl}/data/manifest.json`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      _manifestCache = await resp.json();
      return _manifestCache;
    } catch (e) {
      console.warn('[BlogAPI] Failed to load manifest:', e.message);
      return { posts: [], tags: {}, tagList: [] };
    }
  }

  // ==================== 公共 API ====================

  /**
   * 获取所有文章列表
   * @param {object} options - 过滤选项 { tag, limit, offset }
   */
  const BlogAPI = {

    /** 获取所有文章元数据 */
    async getPosts(options = {}) {
      const manifest = await fetchManifest();
      let posts = manifest.posts || [];

      if (options.tag) {
        posts = posts.filter(p =>
          Array.isArray(p.tags) && p.tags.includes(options.tag)
        );
      }

      // 分页
      if (options.limit) {
        const offset = options.offset || 0;
        posts = posts.slice(offset, offset + options.limit);
      }

      return posts;
    },

    /** 获取所有标签及其文章数 */
    async getTags() {
      const manifest = await fetchManifest();
      return Object.entries(manifest.tags || {}).map(([name, list]) => ({
        name,
        count: list.length,
        posts: list
      }));
    },

    /** 获取所有分类及其文章数 */
    async getCategories() {
      const manifest = await fetchManifest();
      return Object.entries(manifest.categories || {}).map(([name, list]) => ({
        name,
        count: list.length,
        posts: list
      }));
    },

    /**
     * 本地搜索文章
     * @param {string} query - 搜索关键词
     * @returns {Promise<Array>} 匹配结果列表
     */
    async search(query) {
      if (!query || !query.trim()) return [];

      const manifest = await fetchManifest();
      const q = query.trim().toLowerCase();
      const results = [];

      for (const post of (manifest.posts || [])) {
        const searchText = [
          post.title,
          post.description,
          ...(post.tags || []),
          post.author || ''
        ].join(' ').toLowerCase();

        if (searchText.includes(q)) {
          // 计算匹配度分数（简单实现：标题匹配权重更高）
          let score = 0;
          if (post.title.toLowerCase().includes(q)) score += 10;
          if (post.description.toLowerCase().includes(q)) score += 5;
          if ((post.tags || []).some(t => t.toLowerCase().includes(q))) score += 3;
          if (post.author && post.author.toLowerCase().includes(q)) score += 2;

          results.push({ ...post, _score: score });
        }
      }

      // 按分数降序排列
      return results.sort((a, b) => b._score - a._score);
    },

    /**
     * 切换暗色/亮色模式
     * @param {'light'|'dark'|undefined} theme - 指定主题，不传则切换
     */
    toggleTheme(theme) {
      const html = document.documentElement;
      const current = html.getAttribute('data-theme') || 'light';
      let next = theme || (current === 'dark' ? 'light' : 'dark');

      html.setAttribute('data-theme', next);

      // 持久化到 localStorage
      try { localStorage.setItem('glazepress-theme', next); } catch(e){}

      // 触发自定义事件（供 Vue 组件监听）
      global.dispatchEvent(new CustomEvent('themechange', { detail: { theme: next } }));

      return next;
    },

    /** 初始化主题（从 localStorage 或系统偏好读取） */
    initTheme() {
      const saved = localStorage.getItem('glazepress-theme');
      if (saved === 'dark' || saved === 'light') {
        document.documentElement.setAttribute('data-theme', saved);
        return saved;
      }

      // 跟随系统偏好
      const prefersDark = global.matchMedia('(prefers-color-scheme: dark)').matches;
      const theme = prefersDark ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', theme);
      return theme;
    },

    /** 打开搜索模态框 */
    openSearch() {
      global.dispatchEvent(new CustomEvent('opensearch'));
    },

    /** 关闭搜索模态框 */
    closeSearch() {
      global.dispatchEvent(new CustomEvent('closesearch'));
    },

    /** 获取当前主题 */
    getCurrentTheme() {
      return document.documentElement.getAttribute('data-theme') || 'light';
    }
  };

  // ==================== 全局注册 ====================
  global.BlogAPI = BlogAPI;

  // 全局事件监听器（供内联脚本使用）
  global.openLightbox = function(imgEl) {
    // 由 post.html 内联脚本处理
  };

})(typeof window !== 'undefined' ? window : this);
