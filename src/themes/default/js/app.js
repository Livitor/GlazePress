/**
 * GlazePress - Vue 3 应用主入口
 *
 * 架构原则：
 * - Vue 只挂载必要交互区域（导航栏、搜索、暗色切换），不挂载整个 body
 * - 每个功能模块独立创建 Vue App，避免全局状态污染
 * - 使用事件委托和全局事件总线进行组件间通信
 */

(function(global) {
  'use strict';

  // 确保 Vue 3 已加载
  if (typeof Vue === 'undefined') {
    console.warn('[GlazePress] Vue 3 not loaded. Interactive features disabled.');
    return;
  }

  const { createApp, h, ref, reactive, computed, watch, onMounted, onUnmounted, nextTick } = Vue;

  // ==================== 全局事件总线 ====================

  const eventBus = new EventTarget();

  function emit(event, detail) { eventBus.dispatchEvent(new CustomEvent(event, { detail })); }
  function on(event, handler) { eventBus.addEventListener(event, handler); }

  // ==================== 1. 暗色切换组件 ====================

  function initThemeToggle(mountEl) {
    if (!mountEl) return;

    createApp({
      setup() {
        const currentTheme = ref(BlogAPI.initTheme());
        const isDark = computed(() => currentTheme.value === 'dark');
        const rotating = ref(false);

        function toggle() {
          rotating.value = true;
          setTimeout(() => { rotating.value = false; }, 400);
          currentTheme.value = BlogAPI.toggleTheme();
        }

        return () => h('button', {
          onclick: toggle,
          class: ['w-9 h-9 glass-btn p-0 flex items-center justify-center', { 'theme-icon-enter': rotating.value }],
          'aria-label': '切换主题'
        }, [
          h('svg', {
            width: '18', height: '18', viewBox: '0 0 24 24',
            fill: isDark.value ? 'none' : 'currentColor',
            stroke: 'currentColor', strokeWidth: '2',
            strokeLinecap: 'round', strokeLinejoin: 'round',
            class: 'transition-transform duration-300'
          }, [
            h('path', {
              d: isDark.value
                ? 'M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707-.707M16 12a4 4 0 11-8 0 4 4 0 018 0z'
                : 'M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z'
            })
          ])
        ]);
      }
    }).mount(mountEl);
  }

  // ==================== 2. 搜索模态框组件 ====================

  function initSearchModal() {
    // 创建搜索容器（如果不存在）
    let container = document.getElementById('search-modal-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'search-modal-container';
      document.body.appendChild(container);
    }

    const searchApp = createApp({
      setup() {
        const isOpen = ref(false);
        const query = ref('');
        const results = ref([]);
        const searching = ref(false);
        const selectedIndex = ref(0);
        let debounceTimer = null;

        /** 打开搜索 */
        function open() {
          isOpen.value = true;
          query.value = '';
          results.value = [];
          nextTick(() => {
            const input = document.querySelector('.search-input-field');
            input?.focus();
          });
        }

        /** 关闭搜索 */
        function close() {
          isOpen.value = false;
        }

        /** 执行搜索（带防抖） */
        async function doSearch(q) {
          query.value = q;
          selectedIndex.value = 0;

          if (debounceTimer) clearTimeout(debounceTimer);

          if (!q || q.trim().length < 1) {
            results.value = [];
            return;
          }

          searching.value = true;
          debounceTimer = setTimeout(async () => {
            try {
              results.value = await BlogAPI.search(q.trim());
            } catch (e) {
              console.error('[Search] Error:', e);
            } finally {
              searching.value = false;
            }
          }, 300); // 300ms 防抖
        }

        /** 键盘导航 */
        function handleKeydown(e) {
          if (!isOpen.value) return;

          switch (e.key) {
            case 'Escape':
              e.preventDefault();
              close();
              break;
            case 'ArrowDown':
              e.preventDefault();
              selectedIndex.value = Math.min(selectedIndex.value + 1, results.value.length - 1);
              break;
            case 'ArrowUp':
              e.preventDefault();
              selectedIndex.value = Math.max(selectedIndex.value - 1, 0);
              break;
            case 'Enter':
              e.preventDefault();
              if (results.value[selectedIndex.value]) {
                window.location.href = results.value[selectedIndex.value].url;
              }
              break;
          }
        }

        // 监听键盘快捷键 ⌘K / Ctrl+K
        onMounted(() => {
          global.addEventListener('keydown', (e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
              e.preventDefault();
              isOpen.value ? close() : open();
            }
          });
          global.addEventListener('keydown', handleKeydown);
        });

        onUnmounted(() => {
          global.removeEventListener('keydown', handleKeydown);
        });

        // 监听全局打开/关闭事件
        global.addEventListener('opensearch', open);
        global.addEventListener('closesearch', close);

        return { isOpen, query, results, searching, selectedIndex, open, close, doSearch };
      },

      template: `
        <div>
          <!-- 遮罩层 -->
          <div v-if="isOpen" class="glass-overlay active" @click="close"></div>

          <!-- 搜索模态框 -->
          <div v-if="isOpen" class="glass-modal active" role="dialog" aria-label="搜索文章">
            <div class="p-5 w-full max-w-2xl">
              <!-- 输入框 -->
              <div class="relative mb-4">
                <svg class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                <input
                  type="text"
                  class="search-input-field glass-input w-full pl-11 pr-10 text-base"
                  placeholder="搜索文章标题、标签..."
                  :value="query"
                  @input="doSearch($event.target.value)"
                  ref="searchInput"
                />
                <kbd v-if="!query" class="absolute right-4 top-1/2 -translate-y-1/2 hidden sm:inline-flex items-center px-1.5 py-0.5 text-xs rounded bg-black/5 border border-gray-300">ESC</kbd>
              </div>

              <!-- 搜索结果列表 -->
              <div class="max-h-[50vh] overflow-y-auto">
                <!-- 搜索中 -->
                <div v-if="searching" class="text-center py-8 text-sm" style="color: var(--text-tertiary)">
                  <svg class="animate-spin mx-auto mb-2" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10" opacity="0.25"/><path d="M12 2a10 10 0 0 1 10 10" opacity="1" stroke-width="3"/></svg>
                  搜索中...
                </div>

                <!-- 有结果 -->
                <ul v-if="results.length > 0" class="space-y-1.5">
                  <li v-for="(post, idx) in results" :key="post.url">
                    <a
                      :href="post.url"
                      class="flex items-start gap-3 p-3 rounded-lg transition-all duration-150"
                      :class="idx === selectedIndex ? 'bg-primary/10 ring-1 ring-primary/30' : 'hover:bg-white/60 dark:hover:bg-white/5'"
                      style="color: var(--text-primary)"
                    >
                      <span class="mt-0.5 text-xs font-mono shrink-0 px-1.5 py-0.5 rounded" style="background: var(--bg-secondary); color: var(--text-tertiary)">#{{ idx + 1 }}</span>
                      <div class="min-w-0">
                        <div class="font-medium text-sm line-clamp-1">{{ post.title }}</div>
                        <div class="text-xs mt-0.5 line-clamp-1" style="color: var(--text-secondary)">{{ post.description || '' }}</div>
                        <div class="flex gap-1.5 mt-1.5">
                          <span v-for="tag in (post.tags||[]).slice(0,3)" class="text-xs px-1.5 py-px rounded-full tag-pill">{{ tag }}</span>
                          <time class="text-xs ml-auto" style="color: var(--text-tertiary)">{{ post.date }}</time>
                        </div>
                      </div>
                    </a>
                  </li>
                </ul>

                <!-- 无结果 -->
                <div v-if="!searching && query && results.length === 0" class="text-center py-8">
                  <p class="text-sm" style="color: var(--text-secondary)">未找到匹配 "{{ query }}" 的结果</p>
                  <p class="text-xs mt-1" style="color: var(--text-tertiary)">尝试使用其他关键词</p>
                </div>

                <!-- 空状态 -->
                <div v-if="!searching && !query" class="text-center py-8" style="color: var(--text-tertiary)">
                  <p class="text-sm">输入关键词开始搜索</p>
                  <div class="flex justify-center gap-2 mt-3">
                    <kbd class="px-2 py-1 text-xs rounded border">⌘</kbd><span>+</span><kbd class="px-2 py-1 text-xs rounded border">K</kbd>
                    <span class="text-xs mx-2">快速打开</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      `
    });

    searchApp.mount(container);
  }

  // ==================== 3. 设置面板组件 ====================

  function initSettingsPanel() {
    let container = document.getElementById('settings-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'settings-container';
      document.body.appendChild(container);
    }

    const settingsApp = createApp({
      setup() {
        const isOpen = ref(false);
        const activeTab = ref('general');
        const saved = ref(false);

        // 设置数据
        const settings = reactive({
          // 通用
          theme: localStorage.getItem('glazepress-theme') || 'light',
          fontSize: parseInt(localStorage.getItem('gp-font-size') || '16'),
          showMascot: localStorage.getItem('gp-show-mascot') !== 'false',

          // AI 助手
          aiProvider: localStorage.getItem('gp-ai-provider') || '',
          apiKey: localStorage.getItem('gp-ai-key') || '',
          aiModel: localStorage.getItem('gp-ai-model') || '',
          aiEndpoint: localStorage.getItem('gp-ai-endpoint') || '',

          // 评论 (Giscus)
          giscusRepo: localStorage.getItem('gp-giscus-repo') || '',
          giscusRepoId: localStorage.getItem('gp-giscus-repo-id') || '',
          giscusCategory: localStorage.getItem('gp-giscus-category') || '',
          giscusCategoryId: localStorage.getItem('gp-giscus-category-id') || '',

          // 阅读
          readingWidth: localStorage.getItem('gp-reading-width') || 'default',
          codeTheme: localStorage.getItem('gp-code-theme') || 'dark',
          showLineNumbers: localStorage.getItem('gp-line-numbers') !== 'false',
        });

        function open() { isOpen.value = true; }
        function close() { isOpen.value = false; saved.value = false; }

        function save() {
          localStorage.setItem('glazepress-theme', settings.theme);
          localStorage.setItem('gp-font-size', settings.fontSize);
          localStorage.setItem('gp-show-mascot', settings.showMascot);
          localStorage.setItem('gp-ai-provider', settings.aiProvider);
          localStorage.setItem('gp-ai-key', settings.apiKey);
          localStorage.setItem('gp-ai-model', settings.aiModel);
          localStorage.setItem('gp-ai-endpoint', settings.aiEndpoint);
          localStorage.setItem('gp-giscus-repo', settings.giscusRepo);
          localStorage.setItem('gp-giscus-repo-id', settings.giscusRepoId);
          localStorage.setItem('gp-giscus-category', settings.giscusCategory);
          localStorage.setItem('gp-giscus-category-id', settings.giscusCategoryId);
          localStorage.setItem('gp-reading-width', settings.readingWidth);
          localStorage.setItem('gp-code-theme', settings.codeTheme);
          localStorage.setItem('gp-line-numbers', settings.showLineNumbers);

          saved.value = true;
          setTimeout(() => { saved.value = false; }, 2000);

          // 应用字体大小
          document.documentElement.style.fontSize = settings.fontSize + 'px';

          // 应用吉祥物可见性
          global.dispatchEvent(new CustomEvent('mascot-visibility', { detail: { show: settings.showMascot } }));
        }

        global.addEventListener('opensettings', open);

        return { isOpen, activeTab, settings, saved, open, close, save };
      },

      template: `
        <div>
          <div v-if="isOpen" class="glass-overlay active" @click="close"></div>
          <div v-if="isOpen" class="glass-modal active" role="dialog" aria-label="设置"
               style="max-width: 540px; width: 540px; height: 560px; max-height: 80vh;">
            <div class="p-6 w-full h-full flex flex-col">
              <!-- 头部 -->
              <div class="flex items-center justify-between mb-4 shrink-0">
                <h2 class="text-lg font-bold font-heading flex items-center gap-2" style="color: var(--text-primary)">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                  设置
                </h2>
                <button @click="close" class="w-8 h-8 rounded-lg hover:bg-black/5 dark:hover:bg-white/5 transition-colors flex items-center justify-center" style="color: var(--text-tertiary)">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                </button>
              </div>

              <!-- 标签页（圆角矩形统一） -->
              <div class="flex gap-1 mb-4 p-1 rounded-xl shrink-0" style="background: var(--bg-secondary)">
                <button v-for="tab in [{key:'general',label:'通用'},{key:'ai',label:'AI 助手'},{key:'comments',label:'评论'},{key:'reading',label:'阅读'}]"
                  :key="tab.key" @click="activeTab=tab.key"
                  class="flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-all duration-200"
                  :style="activeTab===tab.key ? 'background:var(--bg-glass);color:var(--text-primary);box-shadow:0 1px 3px var(--shadow-color)' : 'color:var(--text-tertiary)'">
                  {{ tab.label }}
                </button>
              </div>

              <!-- 内容区（固定高度滚动） -->
              <div class="flex-1 overflow-y-auto min-h-0 pr-1" style="scrollbar-width: thin; scrollbar-color: rgba(139,92,246,0.2) transparent;">

              <!-- 通用设置 -->
              <div v-show="activeTab==='general'" class="space-y-4">
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-sm font-medium" style="color: var(--text-primary)">字体大小</div>
                    <div class="text-xs" style="color: var(--text-tertiary)">调整页面字体大小</div>
                  </div>
                  <div class="flex items-center gap-2">
                    <button @click="settings.fontSize=Math.max(12,settings.fontSize-1)" class="w-7 h-7 rounded-lg flex items-center justify-center" style="background:var(--bg-secondary);color:var(--text-primary)">-</button>
                    <span class="text-sm w-8 text-center" style="color:var(--text-primary)">{{ settings.fontSize }}</span>
                    <button @click="settings.fontSize=Math.min(22,settings.fontSize+1)" class="w-7 h-7 rounded-lg flex items-center justify-center" style="background:var(--bg-secondary);color:var(--text-primary)">+</button>
                  </div>
                </div>
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-sm font-medium" style="color: var(--text-primary)">显示吉祥物</div>
                    <div class="text-xs" style="color: var(--text-tertiary)">在首页显示互动角色</div>
                  </div>
                  <button @click="settings.showMascot=!settings.showMascot"
                    class="w-11 h-6 rounded-full transition-colors duration-200 relative"
                    :style="settings.showMascot?'background:var(--color-primary)':'background:var(--bg-glass-border)'">
                    <div class="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform duration-200 shadow-sm"
                      :style="settings.showMascot?'transform:translateX(22px)':'transform:translateX(2px)'"></div>
                  </button>
                </div>
              </div>

              <!-- AI 助手设置 -->
              <div v-show="activeTab==='ai'" class="space-y-4">
                <div>
                  <div class="text-sm font-medium mb-1.5" style="color: var(--text-primary)">AI 服务商</div>
                  <select v-model="settings.aiProvider" class="glass-input w-full text-sm">
                    <option value="">未配置</option>
                    <option value="openai">OpenAI</option>
                    <option value="deepseek">DeepSeek</option>
                    <option value="zhipu">智谱 (GLM)</option>
                    <option value="moonshot">Moonshot (Kimi)</option>
                    <option value="custom">自定义</option>
                  </select>
                </div>
                <div>
                  <div class="text-sm font-medium mb-1.5" style="color: var(--text-primary)">API Key</div>
                  <input type="password" v-model="settings.apiKey" placeholder="sk-..." class="glass-input w-full text-sm">
                  <div class="text-xs mt-1" style="color: var(--text-tertiary)">密钥仅保存在本地浏览器中</div>
                </div>
                <div>
                  <div class="text-sm font-medium mb-1.5" style="color: var(--text-primary)">模型名称</div>
                  <input type="text" v-model="settings.aiModel" placeholder="gpt-4o-mini / deepseek-chat" class="glass-input w-full text-sm">
                </div>
                <div>
                  <div class="text-sm font-medium mb-1.5" style="color: var(--text-primary)">自定义端点</div>
                  <input type="text" v-model="settings.aiEndpoint" placeholder="https://api.openai.com/v1 (留空用默认)" class="glass-input w-full text-sm">
                </div>
                <div class="glass-card p-3 text-xs" style="color: var(--text-tertiary); background: var(--bg-secondary)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="inline mr-1 -mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  所有配置仅存储在当前浏览器本地 (localStorage)，不会上传至任何服务器。换一台电脑需要重新配置。
                </div>
              </div>

              <!-- 评论设置 (Giscus) -->
              <div v-show="activeTab==='comments'" class="space-y-4">
                <div>
                  <div class="text-sm font-medium mb-1.5" style="color: var(--text-primary)">Giscus 仓库</div>
                  <input type="text" v-model="settings.giscusRepo" placeholder="owner/repo" class="glass-input w-full text-sm">
                  <div class="text-xs mt-1" style="color: var(--text-tertiary)">格式：用户名/仓库名，如 blog/comments</div>
                </div>
                <div>
                  <div class="text-sm font-medium mb-1.5" style="color: var(--text-primary)">仓库 ID</div>
                  <input type="text" v-model="settings.giscusRepoId" placeholder="R_xxxxxxx" class="glass-input w-full text-sm">
                </div>
                <div>
                  <div class="text-sm font-medium mb-1.5" style="color: var(--text-primary)">Discussion 分类</div>
                  <input type="text" v-model="settings.giscusCategory" placeholder="Announcements" class="glass-input w-full text-sm">
                </div>
                <div>
                  <div class="text-sm font-medium mb-1.5" style="color: var(--text-primary)">分类 ID</div>
                  <input type="text" v-model="settings.giscusCategoryId" placeholder="DIC_xxxxxxx" class="glass-input w-full text-sm">
                </div>
                <div class="glass-card p-3 text-xs" style="color: var(--text-tertiary); background: var(--bg-secondary)">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="inline mr-1 -mt-0.5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
                  评论系统基于 GitHub Discussions，访问 <a href="https://giscus.app" target="_blank" style="color:var(--color-primary)">giscus.app</a> 获取配置值。需仓库为公开且安装了 Giscus GitHub App。
                </div>
              </div>

              <!-- 阅读设置 -->
              <div v-show="activeTab==='reading'" class="space-y-4">
                <div>
                  <div class="text-sm font-medium mb-1.5" style="color: var(--text-primary)">文章宽度</div>
                  <select v-model="settings.readingWidth" class="glass-input w-full text-sm">
                    <option value="narrow">窄 (640px)</option>
                    <option value="default">默认 (768px)</option>
                    <option value="wide">宽 (960px)</option>
                  </select>
                </div>
                <div>
                  <div class="text-sm font-medium mb-1.5" style="color: var(--text-primary)">代码主题</div>
                  <select v-model="settings.codeTheme" class="glass-input w-full text-sm">
                    <option value="dark">深色</option>
                    <option value="light">浅色</option>
                  </select>
                </div>
                <div class="flex items-center justify-between">
                  <div>
                    <div class="text-sm font-medium" style="color: var(--text-primary)">显示行号</div>
                    <div class="text-xs" style="color: var(--text-tertiary)">代码块左侧行号显示</div>
                  </div>
                  <button @click="settings.showLineNumbers=!settings.showLineNumbers"
                    class="w-11 h-6 rounded-full transition-colors duration-200 relative"
                    :style="settings.showLineNumbers?'background:var(--color-primary)':'background:var(--bg-glass-border)'">
                    <div class="w-5 h-5 rounded-full bg-white absolute top-0.5 transition-transform duration-200 shadow-sm"
                      :style="settings.showLineNumbers?'transform:translateX(22px)':'transform:translateX(2px)'"></div>
                  </button>
                </div>
              </div>

              </div>

              <!-- 保存按钮（固定在底部） -->
              <div class="mt-4 flex justify-end gap-3 shrink-0 pt-3 border-t" style="border-color: var(--bg-glass-border)">
                <button @click="close" class="glass-btn glass-btn--ghost text-sm">取消</button>
                <button @click="save" class="glass-btn glass-btn--primary text-sm flex items-center gap-1.5">
                  <svg v-if="saved" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>
                  {{ saved ? '已保存' : '保存设置' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      `
    });

    settingsApp.mount(container);
  }

  // ==================== 4. 吉祥物组件 + AI 对话 ====================

  function initMascot() {
    if (document.querySelector('.mascot-container')) return;

    const container = document.createElement('div');
    container.className = 'mascot-container';
    container.innerHTML = `
      <div class="mascot-character" id="mascot-character">
        <svg viewBox="0 0 80 80" width="72" height="72" xmlns="http://www.w3.org/2000/svg">
          <!-- 身体光晕 -->
          <defs>
            <radialGradient id="glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" style="stop-color:#8b5cf6;stop-opacity:0.3"/>
              <stop offset="100%" style="stop-color:#8b5cf6;stop-opacity:0"/>
            </radialGradient>
            <linearGradient id="bodyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#c4b5fd"/>
              <stop offset="100%" style="stop-color:#8b5cf6"/>
            </linearGradient>
            <linearGradient id="faceGrad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" style="stop-color:#ede9fe"/>
              <stop offset="100%" style="stop-color:#ddd6fe"/>
            </linearGradient>
          </defs>
          <circle cx="40" cy="40" r="38" fill="url(#glow)"/>
          <!-- 身体 -->
          <ellipse cx="40" cy="48" rx="22" ry="20" fill="url(#bodyGrad)" stroke="#7c3aed" stroke-width="1.5"/>
          <!-- 耳朵 -->
          <path d="M22 32 Q18 16 28 22" fill="url(#bodyGrad)" stroke="#7c3aed" stroke-width="1.5"/>
          <path d="M58 32 Q62 16 52 22" fill="url(#bodyGrad)" stroke="#7c3aed" stroke-width="1.5"/>
          <path d="M24 30 Q22 20 28 24" fill="#f5d0fe" opacity="0.5"/>
          <path d="M56 30 Q58 20 52 24" fill="#f5d0fe" opacity="0.5"/>
          <!-- 脸 -->
          <ellipse cx="40" cy="42" rx="16" ry="14" fill="url(#faceGrad)"/>
          <!-- 眼睛 -->
          <g id="mascot-eyes">
            <ellipse cx="33" cy="40" rx="4.5" ry="5" fill="#1e1b4b"/>
            <ellipse cx="47" cy="40" rx="4.5" ry="5" fill="#1e1b4b"/>
            <circle class="mascot-pupil-svg" id="pupil-l" cx="34" cy="39" r="2" fill="white"/>
            <circle class="mascot-pupil-svg" id="pupil-r" cx="48" cy="39" r="2" fill="white"/>
            <!-- 高光 -->
            <circle cx="35.5" cy="38" r="1" fill="white" opacity="0.7"/>
            <circle cx="49.5" cy="38" r="1" fill="white" opacity="0.7"/>
          </g>
          <!-- 鼻子 -->
          <ellipse cx="40" cy="45" rx="2" ry="1.5" fill="#c084fc"/>
          <!-- 嘴巴 -->
          <path id="mascot-mouth-svg" d="M37 48 Q40 51 43 48" fill="none" stroke="#7c3aed" stroke-width="1.2" stroke-linecap="round"/>
          <!-- 腮红 -->
          <circle cx="28" cy="46" r="3.5" fill="#f0abfc" opacity="0.4" class="mascot-blush-svg"/>
          <circle cx="52" cy="46" r="3.5" fill="#f0abfc" opacity="0.4" class="mascot-blush-svg"/>
          <!-- 尾巴 -->
          <path d="M62 52 Q70 48 68 56 Q66 62 72 58" fill="none" stroke="url(#bodyGrad)" stroke-width="3" stroke-linecap="round">
            <animate attributeName="d" values="M62 52 Q70 48 68 56 Q66 62 72 58;M62 52 Q70 54 68 50 Q66 44 72 50;M62 52 Q70 48 68 56 Q66 62 72 58" dur="1.5s" repeatCount="indefinite"/>
          </path>
        </svg>
      </div>
      <!-- AI 对话面板 -->
      <div class="mascot-chat" id="mascot-chat" style="display:none">
        <div class="mascot-chat-header">
          <span>AI 助手</span>
          <button onclick="document.getElementById('mascot-chat').style.display='none'" class="mascot-chat-close">&times;</button>
        </div>
        <div class="mascot-chat-messages" id="mascot-chat-messages"></div>
        <div class="mascot-chat-input-area">
          <input type="text" id="mascot-chat-input" placeholder="输入消息..." class="mascot-chat-input">
          <button id="mascot-chat-send" class="mascot-chat-send-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2 11 13"/><path d="M22 2 15 22 11 13 2 9z"/></svg>
          </button>
        </div>
      </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
      .mascot-container {
        position: fixed;
        bottom: 24px;
        left: 24px;
        z-index: 90;
        cursor: grab;
        user-select: none;
        transition: opacity 0.3s ease;
      }
      .mascot-container.hidden { opacity: 0; pointer-events: none; }
      .mascot-container:active { cursor: grabbing; }

      .mascot-character {
        transition: transform 0.2s ease;
        filter: drop-shadow(0 4px 12px rgba(139,92,246,0.3));
      }
      .mascot-character:hover {
        transform: scale(1.08);
      }
      .mascot-character:active {
        transform: scale(0.95);
      }
      .mascot-bounce {
        animation: mascotBounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      @keyframes mascotBounce {
        0% { transform: translateY(0) scale(1); }
        30% { transform: translateY(-12px) scale(1.1); }
        50% { transform: translateY(-8px) scale(1.05); }
        100% { transform: translateY(0) scale(1); }
      }
      .mascot-container:hover .mascot-blush-svg { opacity: 0.7; }

      /* AI 对话面板 */
      .mascot-chat {
        position: absolute;
        bottom: calc(100% + 12px);
        left: 0;
        width: 340px;
        max-height: 440px;
        border-radius: var(--radius-lg, 16px);
        background: var(--bg-glass, rgba(255,255,255,0.58));
        backdrop-filter: blur(24px) saturate(180%);
        -webkit-backdrop-filter: blur(24px) saturate(180%);
        border: 1px solid var(--bg-glass-border, rgba(139,92,246,0.12));
        box-shadow: 0 12px 40px -8px var(--shadow-strong, rgba(139,92,246,0.18));
        display: flex;
        flex-direction: column;
        overflow: hidden;
        animation: chatSlideIn 0.35s cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      @keyframes chatSlideIn {
        from { opacity: 0; transform: translateY(10px) scale(0.95); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }

      .mascot-chat-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 16px;
        background: linear-gradient(135deg, var(--color-primary, #8b5cf6), var(--color-accent, #ec4899));
        color: white;
        font-weight: 600;
        font-size: 14px;
      }
      .mascot-chat-close {
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        background: rgba(255,255,255,0.2);
        color: white;
        border-radius: 6px;
        cursor: pointer;
        font-size: 16px;
        line-height: 1;
        transition: background 0.15s;
      }
      .mascot-chat-close:hover { background: rgba(255,255,255,0.3); }

      .mascot-chat-messages {
        flex: 1;
        overflow-y: auto;
        padding: 12px;
        min-height: 200px;
        max-height: 300px;
        scrollbar-width: thin;
        scrollbar-color: rgba(139,92,246,0.2) transparent;
      }
      .mascot-chat-messages::-webkit-scrollbar { width: 4px; }
      .mascot-chat-messages::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.2); border-radius: 2px; }

      .chat-msg {
        margin-bottom: 10px;
        padding: 8px 12px;
        border-radius: 12px;
        font-size: 13px;
        line-height: 1.6;
        max-width: 90%;
        word-wrap: break-word;
      }
      .chat-msg.user {
        background: linear-gradient(135deg, var(--color-primary, #8b5cf6), var(--color-accent, #ec4899));
        color: white;
        margin-left: auto;
        border-bottom-right-radius: 4px;
      }
      .chat-msg.assistant {
        background: var(--bg-secondary, #f3effe);
        color: var(--text-primary, #1e1b4b);
        border-bottom-left-radius: 4px;
      }
      .chat-msg.assistant p { margin: 0.3em 0; }
      .chat-msg.assistant code {
        background: rgba(139,92,246,0.1);
        padding: 1px 5px;
        border-radius: 4px;
        font-family: var(--font-code, monospace);
        font-size: 12px;
      }
      .chat-msg.assistant pre {
        background: #1e1a2e;
        color: #e2e8f0;
        padding: 8px 10px;
        border-radius: 8px;
        overflow-x: auto;
        margin: 6px 0;
        font-size: 12px;
      }
      .chat-msg.assistant pre code {
        background: none;
        padding: 0;
        color: inherit;
      }
      .chat-msg.assistant ul, .chat-msg.assistant ol {
        padding-left: 1.2em;
        margin: 0.3em 0;
      }
      .chat-msg.assistant strong { color: var(--color-primary, #8b5cf6); }
      .chat-cursor {
        display: inline-block;
        width: 2px;
        height: 14px;
        background: var(--color-primary, #8b5cf6);
        margin-left: 2px;
        animation: blink 0.8s ease-in-out infinite;
        vertical-align: text-bottom;
      }
      @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }

      .mascot-chat-input-area {
        display: flex;
        gap: 8px;
        padding: 10px 12px;
        border-top: 1px solid var(--bg-glass-border, rgba(139,92,246,0.12));
      }
      .mascot-chat-input {
        flex: 1;
        padding: 8px 12px;
        border-radius: 10px;
        border: 1px solid var(--bg-glass-border, rgba(139,92,246,0.12));
        background: var(--bg-secondary, #f3effe);
        color: var(--text-primary, #1e1b4b);
        font-size: 13px;
        outline: none;
        transition: border-color 0.15s;
      }
      .mascot-chat-input:focus {
        border-color: var(--color-primary, #8b5cf6);
      }
      .mascot-chat-input::placeholder { color: var(--text-tertiary, #a78bfa); }
      .mascot-chat-send-btn {
        width: 36px;
        height: 36px;
        border-radius: 10px;
        border: none;
        background: linear-gradient(135deg, var(--color-primary, #8b5cf6), var(--color-accent, #ec4899));
        color: white;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: transform 0.15s, opacity 0.15s;
      }
      .mascot-chat-send-btn:hover { transform: scale(1.05); }
      .mascot-chat-send-btn:active { transform: scale(0.95); }
      .mascot-chat-send-btn:disabled { opacity: 0.5; cursor: not-allowed; }

      @media (max-width: 480px) {
        .mascot-chat { width: calc(100vw - 48px); left: 0; }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(container);

    // 检查是否隐藏
    if (localStorage.getItem('gp-show-mascot') === 'false') {
      container.classList.add('hidden');
    }

    // 鼠标追踪 - 瞳孔跟随
    const pupilL = document.getElementById('pupil-l');
    const pupilR = document.getElementById('pupil-r');

    document.addEventListener('mousemove', (e) => {
      const rect = container.getBoundingClientRect();
      const cx = rect.left + 40;
      const cy = rect.top + 40;
      const dx = e.clientX - cx;
      const dy = e.clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const maxMove = 2.5;
      const moveX = (dx / Math.max(dist, 1)) * maxMove;
      const moveY = (dy / Math.max(dist, 1)) * maxMove;

      if (pupilL) pupilL.setAttribute('cx', 34 + moveX);
      if (pupilL) pupilL.setAttribute('cy', 39 + moveY);
      if (pupilR) pupilR.setAttribute('cx', 48 + moveX);
      if (pupilR) pupilR.setAttribute('cy', 39 + moveY);
    });

    // 拖拽
    let isDragging = false, startX, startY, origX, origY;
    container.addEventListener('mousedown', (e) => {
      if (e.target.closest('.mascot-chat')) return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      const rect = container.getBoundingClientRect();
      origX = rect.left;
      origY = rect.top;
      e.preventDefault();
    });
    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const x = origX + (e.clientX - startX);
      const y = origY + (e.clientY - startY);
      container.style.left = x + 'px';
      container.style.top = y + 'px';
      container.style.bottom = 'auto';
      container.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => { isDragging = false; });

    // 点击打开 AI 对话
    let chatOpen = false;
    const chatEl = document.getElementById('mascot-chat');
    const messagesEl = document.getElementById('mascot-chat-messages');
    const inputEl = document.getElementById('mascot-chat-input');
    const sendBtn = document.getElementById('mascot-chat-send');
    let isStreaming = false;
    let conversationHistory = [];

    container.addEventListener('click', (e) => {
      if (e.target.closest('.mascot-chat')) return;
      if (isDragging) return;

      // 弹跳动画
      const character = document.getElementById('mascot-character');
      character.classList.remove('mascot-bounce');
      void character.offsetWidth;
      character.classList.add('mascot-bounce');
      setTimeout(() => character.classList.remove('mascot-bounce'), 500);

      // 切换对话面板
      chatOpen = !chatOpen;
      chatEl.style.display = chatOpen ? 'flex' : 'none';
      if (chatOpen && messagesEl.children.length === 0) {
        addAssistantMessage('你好！我是你的 AI 助手 🐱✨\\n点击设置配置 API Key 后就可以和我聊天了！');
      }
      if (chatOpen) inputEl.focus();
    });

    // 发送消息
    function sendMessage() {
      const text = inputEl.value.trim();
      if (!text || isStreaming) return;

      inputEl.value = '';
      addUserMessage(text);
      conversationHistory.push({ role: 'user', content: text });

      const apiKey = localStorage.getItem('gp-ai-key') || '';
      const aiProvider = localStorage.getItem('gp-ai-provider') || '';
      const aiModel = localStorage.getItem('gp-ai-model') || 'gpt-4o-mini';
      const aiEndpoint = localStorage.getItem('gp-ai-endpoint') || '';

      if (!apiKey) {
        addAssistantMessage('请先在设置中配置 API Key 和 AI 服务商，才能开始对话哦~ 🔑');
        return;
      }

      isStreaming = true;
      sendBtn.disabled = true;

      // 构建请求
      let endpoint = aiEndpoint;
      if (!endpoint) {
        const endpoints = {
          openai: 'https://api.openai.com/v1/chat/completions',
          deepseek: 'https://api.deepseek.com/v1/chat/completions',
          zhipu: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',
          moonshot: 'https://api.moonshot.cn/v1/chat/completions',
        };
        endpoint = endpoints[aiProvider] || endpoints.openai;
      }

      const msgEl = createAssistantBubble();
      let fullContent = '';

      fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + apiKey,
        },
        body: JSON.stringify({
          model: aiModel,
          messages: [
            { role: 'system', content: '你是一个友善的博客AI助手，回答简洁有帮助。用中文回复。' },
            ...conversationHistory.slice(-10)
          ],
          stream: true,
        }),
      }).then(response => {
        if (!response.ok) throw new Error('API 请求失败: ' + response.status);
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        function read() {
          reader.read().then(({ done, value }) => {
            if (done) {
              isStreaming = false;
              sendBtn.disabled = false;
              conversationHistory.push({ role: 'assistant', content: fullContent });
              // 移除光标
              const cursor = msgEl.querySelector('.chat-cursor');
              if (cursor) cursor.remove();
              return;
            }

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(l => l.startsWith('data: '));

            for (const line of lines) {
              const data = line.slice(6).trim();
              if (data === '[DONE]') continue;
              try {
                const json = JSON.parse(data);
                const delta = json.choices?.[0]?.delta?.content || '';
                if (delta) {
                  fullContent += delta;
                  msgEl.innerHTML = renderMarkdown(fullContent) + '<span class="chat-cursor"></span>';
                  messagesEl.scrollTop = messagesEl.scrollHeight;
                }
              } catch (e) { /* skip */ }
            }
            read();
          }).catch(() => {
            isStreaming = false;
            sendBtn.disabled = false;
          });
        }
        read();
      }).catch(err => {
        isStreaming = false;
        sendBtn.disabled = false;
        msgEl.innerHTML = '⚠️ 连接失败: ' + err.message;
      });
    }

    // 简易 Markdown 渲染（用于 AI 回复）
    function renderMarkdown(text) {
      return text
        .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/^### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^## (.+)$/gm, '<h3>$1</h3>')
        .replace(/^# (.+)$/gm, '<h2>$1</h2>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br>')
        .replace(/^(.+)$/gm, function(m) {
          if (m.startsWith('<')) return m;
          return '<p>' + m + '</p>';
        });
    }

    function addUserMessage(text) {
      const div = document.createElement('div');
      div.className = 'chat-msg user';
      div.textContent = text;
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function addAssistantMessage(text) {
      const div = document.createElement('div');
      div.className = 'chat-msg assistant';
      div.innerHTML = renderMarkdown(text);
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    function createAssistantBubble() {
      const div = document.createElement('div');
      div.className = 'chat-msg assistant';
      div.innerHTML = '<span class="chat-cursor"></span>';
      messagesEl.appendChild(div);
      messagesEl.scrollTop = messagesEl.scrollHeight;
      return div;
    }

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });

    // 吉祥物可见性控制
    global.addEventListener('mascot-visibility', (e) => {
      container.classList.toggle('hidden', !e.detail.show);
    });
  }

  // ==================== 5. 初始化所有组件 ====================

  function initAllComponents() {
    // 暗色切换：桌面端 & 移动端
    initThemeToggle(document.getElementById('app-theme'));
    initThemeToggle(document.getElementById('app-theme-mobile'));

    // 搜索模态框
    initSearchModal();

    // 设置面板
    initSettingsPanel();

    // 吉祥物
    initMascot();

    // 工具函数初始化
    GlazeUtils.initNavbarScroll();
    GlazeUtils.initStaggerAnimations();
    GlazeUtils.initTOC();

    // 页面可见性变化时清理资源（可选）
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // 清理 IntersectionObserver 等（如果需要）
      }
    });
  }

  // ==================== 启动 ====================

  // DOM 就绪后初始化
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllComponents);
  } else {
    initAllComponents();
  }

})(typeof window !== 'undefined' ? window : this);
