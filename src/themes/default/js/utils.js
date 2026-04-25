/**
 * GlazePress - 工具函数集
 * 提供日期格式化、防抖/节流、TOC 交互、阅读时长等通用功能
 */

(function(global) {
  'use strict';

  // ==================== 日期格式化 ====================

  /**
   * 格式化日期字符串
   * @param {string|Date} dateStr - 输入日期
   * @param {string} fmt - 格式模式 (YYYY-MM-DD / MM/DD / 相对时间)
   */
  function formatDate(dateStr, fmt = 'YYYY-MM-DD') {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;

    const map = {
      YYYY: d.getFullYear(),
      MM: String(d.getMonth() + 1).padStart(2, '0'),
      DD: String(d.getDate()).padStart(2, '0'),
      HH: String(d.getHours()).padStart(2, '0'),
      mm: String(d.getMinutes()).padStart(2, '0'),
      ss: String(d.getSeconds()).padStart(2, '0'),
    };

    let result = fmt;
    for (const [key, val] of Object.entries(map)) {
      result = result.replace(key, val);
    }
    return result;
  }

  /** 获取相对时间（如 "3天前"） */
  function timeAgo(dateStr) {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const months = Math.floor(days / 30);

    if (seconds < 60) return '刚刚';
    if (minutes < 60) return `${minutes}分钟前`;
    if (hours < 24) return `${hours}小时前`;
    if (days < 30) return `${days}天前`;
    if (months < 12) return `${months}个月前`;

    return formatDate(dateStr);
  }

  // ==================== 防抖 & 节流 ====================

  /**
   * 防抖函数
   * @param {Function} fn - 目标函数
   * @param {number} delay - 延迟毫秒数
   */
  function debounce(fn, delay = 300) {
    let timer = null;

    function debounced(...args) {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    }

    debounced.cancel = () => {
      if (timer) { clearTimeout(timer); timer = null; }
    };

    debounced.flush = () => {
      if (timer) { clearTimeout(timer); timer = null; fn(); }
    };

    return debounced;
  }

  /**
   * 节流函数
   * @param {Function} fn - 目标函数
   * @param {number} interval - 间隔毫秒数
   */
  function throttle(fn, interval = 200) {
    let lastTime = 0;
    let timer = null;

    return function throttled(...args) {
      const now = Date.now();
      const remaining = interval - (now - lastTime);

      if (remaining <= 0) {
        lastTime = now;
        fn.apply(this, args);
        if (timer) { clearTimeout(timer); timer = null; }
      } else if (!timer) {
        timer = setTimeout(() => {
          lastTime = Date.now();
          timer = null;
          fn.apply(this, args);
        }, remaining);
      }
    };
  }

  // ==================== TOC 目录交互 ====================

  /** 初始化 TOC 高亮滚动监听（使用 IntersectionObserver + 阅读进度） */
  function initTOC() {
    const tocItems = document.querySelectorAll('.toc-item');
    const headings = document.querySelectorAll('.markdown-heading[id]');

    if (!tocItems.length || !headings.length) return;

    const tocContainer = document.getElementById('toc-scroll-container');
    const progressBar = document.getElementById('toc-progress-bar');
    const pctLabel = document.getElementById('toc-reading-pct');

    // 使用 scroll 监听计算阅读进度和高亮当前章节
    let ticking = false;
    const updateTOC = () => {
      ticking = false;
      const scrollTop = window.scrollY;
      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const pct = docHeight > 0 ? Math.min(100, Math.round((scrollTop / docHeight) * 100)) : 0;

      // 更新进度条和百分比
      if (progressBar) progressBar.style.width = pct + '%';
      if (pctLabel) pctLabel.textContent = pct + '%';

      // 找到当前可见的标题
      let currentIndex = -1;
      for (let i = headings.length - 1; i >= 0; i--) {
        if (headings[i].getBoundingClientRect().top <= 120) {
          currentIndex = i;
          break;
        }
      }

      // 更新 active 状态和已读标记
      tocItems.forEach((item, i) => {
        const headingIndex = Array.from(headings).findIndex(h => h.id === item.dataset.id);
        item.classList.remove('active');
        if (headingIndex >= 0 && headingIndex < currentIndex) {
          item.classList.add('read');
        } else {
          item.classList.remove('read');
        }
        if (headingIndex === currentIndex) {
          item.classList.add('active');
          // 滚动 TOC 面板使 active 项可见
          if (tocContainer) {
            const itemTop = item.offsetTop - tocContainer.offsetTop;
            const containerHeight = tocContainer.clientHeight;
            if (itemTop < tocContainer.scrollTop || itemTop > tocContainer.scrollTop + containerHeight - 30) {
              tocContainer.scrollTop = itemTop - containerHeight / 3;
            }
          }
        }
      });
    };

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(updateTOC);
        ticking = true;
      }
    }, { passive: true });

    // 初始更新
    updateTOC();
  }

  // ==================== 导航栏滚动效果 ====================

  /** 初始化导航栏毛玻璃效果（滚动后显示背景） */
  function initNavbarScroll() {
    const navbar = document.getElementById('navbar');
    if (!navbar) return;

    const handleScroll = throttle(() => {
      if (window.scrollY > 20) {
        navbar.classList.remove('at-top');
        navbar.classList.add('scrolled');
      } else {
        navbar.classList.add('at-top');
        navbar.classList.remove('scrolled');
      }
    }, 50);

    window.addEventListener('scroll', handleScroll, { passive: true });
    // 初始化检查
    handleScroll();

    return () => window.removeEventListener('scroll', handleScroll);
  }

  // ==================== Stagger 动画初始化 ====================

  /** 为 .stagger-item 元素设置递增延迟索引 */
  function initStaggerAnimations() {
    document.querySelectorAll('.stagger-container').forEach(container => {
      const items = container.querySelectorAll(':scope > .stagger-item');
      items.forEach((item, index) => {
        item.style.setProperty('--stagger-index', index);
      });
    });

    // 全局 stagger-item 也处理
    const allStagger = document.querySelectorAll('.stagger-item');
    allStagger.forEach((item, index) => {
      if (!item.style.getPropertyValue('--stagger-index')) {
        item.style.setProperty('--stagger-index', index % 10);
      }
    });
  }

  // ==================== 移动端菜单 ====================

  /** 全局暴露移动端菜单切换 */
  global.toggleMobileMenu = function() {
    const overlay = document.getElementById('mobile-menu-overlay');
    const sidebar = document.getElementById('mobile-sidebar');
    const iconOpen = document.getElementById('menu-icon-open');
    const iconClose = document.getElementById('menu-icon-close');

    if (!sidebar || !overlay) return;

    const isOpen = !sidebar.classList.contains('translate-x-full');

    if (isOpen) {
      // 关闭
      sidebar.classList.add('translate-x-full');
      overlay.classList.add('hidden');
      overlay.style.opacity = '0';
      iconOpen?.classList.remove('hidden');
      iconClose?.classList.add('hidden');
      document.body.style.overflow = '';
    } else {
      // 打开
      sidebar.classList.remove('translate-x-full');
      overlay.classList.remove('hidden');
      requestAnimationFrame(() => overlay.style.opacity = '1');
      iconOpen?.classList.add('hidden');
      iconClose?.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
  };

  // ==================== 滚动到顶部 ====================

  global.scrollToTop = function() {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ==================== 暴露公共 API ====================

  const GlazeUtils = {
    formatDate,
    timeAgo,
    debounce,
    throttle,
    initTOC,
    initNavbarScroll,
    initStaggerAnimations
  };

  global.GlazeUtils = GlazeUtils;

})(typeof window !== 'undefined' ? window : this);
