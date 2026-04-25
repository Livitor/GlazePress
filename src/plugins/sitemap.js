/**
 * Sitemap.xml 生成插件
 *
 * 插件接口：
 *   name: 'sitemap'
 *   afterBuild(distPath, manifest) - 构建后生成 sitemap.xml
 *
 * 用法：在 blog.config.js 的 plugins 数组中添加 './src/plugins/sitemap.js'
 */

import { writeFileSync } from 'fs';
import { resolve } from 'path';

export default {
  name: 'sitemap',

  /**
   * 构建后钩子：根据 manifest 数据生成 sitemap.xml
   * @param {string} distPath - 构建产物输出目录
   * @param {object} manifest - 文章索引数据
   */
  async afterBuild(distPath, manifest) {
    if (!manifest || !manifest.posts) return;

    const baseUrl = (manifest.site?.baseUrl || '').replace(/\/$/, '');
    const now = new Date().toISOString();

    // URL 列表
    const urls = [
      `<url><loc>${baseUrl}/</loc><lastmod>${now}</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`
    ];

    // 添加每篇文章
    for (const post of manifest.posts) {
      const loc = `${baseUrl}${post.url}`;
      const lastmod = post.date;
      urls.push(
        `<url><loc>${loc}</loc><lastmod>${lastmod}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`
      );
    }

    // 添加聚合页
    const staticPages = [
      { path: '/archive/', freq: 'weekly', priority: '0.6' },
      { path: '/tags/', freq: 'weekly', priority: '0.6' },
      { path: '/about/', freq: 'monthly', priority: '0.5' }
    ];

    for (const page of staticPages) {
      urls.push(
        `<url><loc>${baseUrl}${page.path}</loc><lastmod>${now}</lastmod><changefreq>${page.freq}</changefreq><priority>${page.priority}</priority></url>`
      );
    }

    // 组装完整 XML
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  ${u}`).join('\n')}
</urlset>`;

    // 写入文件
    const sitemapPath = resolve(distPath, 'sitemap.xml');
    writeFileSync(sitemapPath, xml, 'utf-8');

    console.log(`  ✓ [sitemap] Generated sitemap.xml (${urls.length} URLs)`);
  }
};
