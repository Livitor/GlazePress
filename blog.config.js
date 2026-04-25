/**
 * GlazePress 博客配置文件
 * 构建脚本读取此配置，模板通过占位符注入（如 {{config.title}}）
 * 所有可配置项集中在此处管理
 */
export default {
  // ========== 站点基本信息 ==========
  title: 'GlazePress',
  description: '基于 Vue 3 的现代化静态博客，采用 Glassmorphism 设计',
  author: {
    name: 'GlazePress Author',
    avatar: './assets/images/avatar.jpg',
    bio: '热爱技术，追求极致。专注于前端架构与性能优化。',
    social: {
      github: 'https://github.com/Livitor',
      gitee: 'https://gitee.com/livitor',
      bilibili: 'https://space.bilibili.com/454802241?spm_id_from=333.1007.0.0',
      email: 'mailto:2162431295@qq.com'
    }
  },
  baseUrl: '', // 部署子目录路径，如 '/blog/'，根目录留空

  // ========== 主题配置 ==========
  theme: {
    primary: '#6366f1',           // 主色 Indigo-500
    success: '#34d399',           // 成功色 Emerald-400
    danger: '#fb7185',            // 危险色 Rose-400
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
      image: './assets/images/bg.jpg', // 首页背景图
      overlayColor: 'rgba(2, 6, 23, 0.6)' // 背景遮罩颜色
    }
  },

  // ========== 功能开关 ==========
  features: {
    darkMode: true,               // 暗色模式
    toc: true,                    // 文章目录导航
    search: { provider: 'local' }, // 搜索：local (本地) | algolia
    comments: {                   // 评论系统
      provider: 'giscus',         // giscus | utterances | disqus | none
      repo: ''                    // giscus 需要 repo 配置
    },
    pwa: false,                   // PWA 离线支持
    math: false,                  // 数学公式 KaTeX/MathJax
    mermaid: false,               // Mermaid 图表渲染
    readingTime: true,            // 阅读时长估算
    lightbox: true,               // 图片灯箱放大
    share: true,                  // 分享按钮
    rss: true                     // RSS 订阅
  },

  // ========== 插件列表 ==========
  plugins: [
    './src/plugins/sitemap.js',
    './src/plugins/rss.js'
  ],

  // ========== 文章配置 ==========
  posts: {
    postsPerPage: 9,              // 首页每页文章数
    excerptLength: 150,           // 摘要截取长度（字符数）
    dateFormat: 'YYYY-MM-DD'      // 日期格式
  },

  // ========== 导航菜单 ==========
  nav: [
    { label: '首页', url: '/' },
    { label: '归档', url: '/archive/' },
    { label: '分类', url: '/categories/' },
    { label: '标签', url: '/tags/' },
    { label: '友链', url: '/friends/' },
    { label: '关于', url: '/about/' }
  ],

  // ========== 自定义配置 ==========
  custom: {
    googleAnalytics: '',
    baiduTongji: ''
  }
};
