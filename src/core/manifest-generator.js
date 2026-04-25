/**
 * Manifest 生成器 - GlazePress 核心模块
 *
 * 职责：
 * - 聚合所有文章元数据，生成 data/manifest.json 索引文件
 * - 按标签分组、按年份归档
 * - 支持自定义排序和过滤逻辑
 */

/**
 * 从文章列表生成 manifest 数据结构
 * @param {Array} posts - 文章数组，每项包含 frontmatter + slug + url
 * @returns {object} 完整的 manifest 对象
 */
export function generateManifest(posts) {
  // 排序：最新修改的文章在前（按 mtime 降序，回退到 date）
  const sortedPosts = [...posts].sort((a, b) => {
    const aTime = a.mtime ? new Date(a.mtime).getTime() : new Date(a.frontmatter.date).getTime();
    const bTime = b.mtime ? new Date(b.mtime).getTime() : new Date(b.frontmatter.date).getTime();
    return bTime - aTime;
  });

  // 提取所有唯一标签
  const allTags = new Set();
  sortedPosts.forEach(post => {
    if (Array.isArray(post.frontmatter.tags)) {
      post.frontmatter.tags.forEach(tag => allTags.add(tag));
    }
  });

  // 提取所有唯一分类
  const allCategories = new Set();
  sortedPosts.forEach(post => {
    if (Array.isArray(post.frontmatter.categories)) {
      post.frontmatter.categories.forEach(cat => allCategories.add(cat));
    }
  });

  // 按标签分组
  const tagsMap = {};
  for (const tag of allTags) {
    tagsMap[tag] = sortedPosts.filter(post =>
      Array.isArray(post.frontmatter.tags) && post.frontmatter.tags.includes(tag)
    ).map(p => ({
      title: p.frontmatter.title,
      url: p.url,
      date: p.frontmatter.date,
      description: p.frontmatter.description || ''
    }));
  }

  // 按分类分组
  const categoriesMap = {};
  for (const cat of allCategories) {
    categoriesMap[cat] = sortedPosts.filter(post =>
      Array.isArray(post.frontmatter.categories) && post.frontmatter.categories.includes(cat)
    ).map(p => ({
      title: p.frontmatter.title,
      url: p.url,
      date: p.frontmatter.date,
      description: p.frontmatter.description || ''
    }));
  }

  // 按年份归档
  const archiveMap = {};
  sortedPosts.forEach(post => {
    const year = new Date(post.frontmatter.date).getFullYear().toString();
    if (!archiveMap[year]) archiveMap[year] = [];
    archiveMap[year].push({
      title: post.frontmatter.title,
      url: post.url,
      date: post.frontmatter.date,
      description: post.frontmatter.description || ''
    });
  });

  // 统计信息
  const stats = {
    totalPosts: sortedPosts.length,
    totalTags: allTags.size,
    totalCategories: allCategories.size,
    firstPostDate: sortedPosts.length > 0 ? sortedPosts[sortedPosts.length - 1].frontmatter.date : null,
    lastPostDate: sortedPosts.length > 0 ? sortedPosts[0].frontmatter.date : null,
    generatedAt: new Date().toISOString()
  };

  return {
    version: '1.0',
    site: {}, // 由 builder 层注入站点配置
    posts: sortedPosts.map(formatPostForManifest),
    tags: tagsMap,
    categories: categoriesMap,
    archive: archiveMap,
    tagList: Array.from(allTags),
    categoryList: Array.from(allCategories),
    stats
  };
}

/**
 * 格式化单篇文章的 manifest 条目
 * （不包含 HTML 正文内容，仅保留索引所需元数据）
 */
function formatPostForManifest(post) {
  return {
    title: post.frontmatter.title,
    date: post.frontmatter.date,
    slug: post.slug,
    url: post.url,
    description: post.frontmatter.description || '',
    cover: post.frontmatter.cover || '',
    tags: post.frontmatter.tags || [],
    categories: post.frontmatter.categories || [],
    author: post.frontmatter.author || '',
    readingTime: post.readingTime || 1
  };
}

/**
 * 获取热门标签（按使用频率排序）
 * @param {object} tagsMap - 标签分组映射 { tagName: [posts...] }
 * @param {number} limit - 返回数量限制
 * @returns {Array<{name: string, count: number}>}
 */
export function getTopTags(tagsMap, limit = 20) {
  return Object.entries(tagsMap)
    .map(([name, posts]) => ({ name, count: posts.length }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

export default generateManifest;
