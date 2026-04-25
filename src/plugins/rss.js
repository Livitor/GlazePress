/**
 * RSS Feed 生成插件
 *
 * 插件接口：
 *   name: 'rss'
 *   afterBuild(distPath, manifest) - 构建后生成 feed.xml (RSS 2.0)
 *
 * 用法：在 blog.config.js 的 plugins 数组中添加 './src/plugins/rss.js'
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';

export default {
  name: 'rss',

  /**
   * 构建后钩子：根据 manifest 数据生成 RSS 2.0 XML feed
   * @param {string} distPath - 构建产物输出目录
   * @param {object} manifest - 文章索引数据
   */
  async afterBuild(distPath, manifest) {
    if (!manifest || !manifest.posts || !manifest.site) return;

    const site = manifest.site;
    const baseUrl = (site.baseUrl || '').replace(/\/$/, '');

    // RSS 项（取最新 20 篇）
    const items = manifest.posts.slice(0, 20).map(post => {
      const pubDate = new Date(post.date).toUTCString();
      const escapedTitle = escapeXML(post.title);
      const escapedDesc = escapeXML(post.description || '');
      const link = `${baseUrl}${post.url}`;

      return `    <item>
      <title>${escapedTitle}</title>
      <link>${link}</link>
      <guid isPermaLink="true">${link}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${escapedDesc}</description>
${(post.tags || []).map(t => `      <category>${escapeXML(t)}</category>`).join('\n')}
    </item>`;
    }).join('\n');

    // 组装完整 RSS XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<?xml-stylesheet type="text/xsl" href="/feed.xsl"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXML(site.title || '')}</title>
    <link>${baseUrl}/</link>
    <description>${escapeXML(site.description || '')}</description>
    <language>zh-CN</language>
    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
    <generator>GlazePress SSG</generator>
    <atom:link href="${baseUrl}/feed.xml" rel="self" type="application/rss+xml"/>
${items}
  </channel>
</rss>`;

    // 写入文件
    const feedPath = resolve(distPath, 'feed.xml');
    writeFileSync(feedPath, xml, 'utf-8');

    console.log(`  ✓ [rss] Generated feed.xml (${Math.min(manifest.posts.length, 20)} items)`);
  }
};

/** XML 特殊字符转义 */
function escapeXML(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
