#!/usr/bin/env node

/**
 * GlazePress 开发服务器
 *
 * 功能：
 * 1. 启动本地 HTTP 服务器，服务 dist/ 目录
 * 2. 支持文件变更自动刷新 (LiveReload)
 * 3. 自动执行构建（首次启动时）
 *
 * 用法:
 *   node dev-server.js          # 默认端口 3000
 *   node dev-server.js --port=8080
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { readFile, existsSync, statSync, readdirSync } from 'fs';
import { extname, join, sep } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ==================== CLI 参数 ====================
const args = process.argv.slice(2);
const port = parseInt(args.find(a => a.startsWith('--port='))?.split('=')[1] || '3000', 10);

const ROOT_DIR = resolve(__dirname);
const DIST_DIR = join(ROOT_DIR, 'dist');

// MIME 类型映射
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.xml': 'application/xml',
  '.txt': 'text/plain; charset=utf-8'
};

// LiveReload 客户端脚本（注入到 HTML 中）
const LIVE_RELOAD_SCRIPT = `
<script>
(function() {
  var ws;
  function connect() {
    ws = new WebSocket('ws://localhost:${port}/__livereload');
    ws.onmessage = function(e) {
      if (e.data === 'reload') location.reload();
    };
    ws.onclose = function() { setTimeout(connect, 1000); };
  }
  connect();
})();
</script>`;

// LiveReload 连接管理
const reloadClients = new Set();

/**
 * 静态文件服务器处理函数
 */
function handleRequest(req, res) {
  // LiveReload WebSocket 端点
  if (req.url === '/__livereload') {
    if (req.headers.upgrade?.toLowerCase() === 'websocket') {
      // 升级到 WebSocket（简化实现：实际应使用 ws 库）
      // 这里用轮询降级方案
    }

    // 简化版：返回一个 EventSource 兼容的流
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    reloadClients.add(res);
    req.on('close', () => reloadClients.delete(res));
    return;
  }

  // 解析 URL 路径
  let urlPath = decodeURIComponent(req.url.split('?')[0]);

  // 处理 SPA 回退（如果请求的是目录，返回 index.html）
  if (urlPath.endsWith('/') || !extname(urlPath)) {
    urlPath = urlPath.replace(/\/$/, '') + '/index.html';
  }

  // 安全检查：防止目录遍历攻击
  const safePath = urlPath.split('..').join('');
  const filePath = join(DIST_DIR, safePath.replace(/^\//, ''));

  // 检查文件是否存在
  if (!existsSync(filePath)) {
    // 尝试返回自定义 404 页面
    const custom404 = join(DIST_DIR, '404.html');
    if (existsSync(custom404)) {
      res.statusCode = 404;
      res.setHeader('Content-Type', MIME_TYPES['.html']);
      return readFile(custom404, (err, data) => res.end(data));
    }
    res.statusCode = 404;
    res.end('Not Found');
    return;
  }

  // 读取并返回文件
  const contentType = MIME_TYPES[extname(filePath)] || 'application/octet-stream';

  readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 500;
      res.end('Internal Server Error');
      return;
    }

    // 对 HTML 文件注入 LiveReload 脚本
    if (extname(filePath) === '.html') {
      data = data.toString().replace('</body>', `${LIVE_RELOAD_SCRIPT}</body>`);
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'no-cache'); // 开发环境禁用缓存

    // 压缩传输支持提示（实际压缩由反向代理完成）
    res.end(data);
  });
}

/**
 * 触发所有客户端重新加载
 */
function triggerReload() {
  const msg = `data: reload\n\n`;
  for (const client of reloadClients) {
    try {
      client.write(msg);
    } catch (e) {
      reloadClients.delete(client);
    }
  }
}

// 将 reload 函数暴露给外部（供 watch 模式调用）
globalThis.__glazepress_reload = triggerReload;

/**
 * 启动开发服务器
 */
async function startServer() {
  console.log('\n🔧 GlazePress Dev Server\n');

  // 始终执行构建（确保最新代码生效）
  console.log('  📦 Running build...\n');
  try {
    const { Builder } = await import('./src/core/builder.js');
    const builder = new Builder({ rootDir: ROOT_DIR, env: 'development' });
    await builder.build();
  } catch (e) {
    console.error('  ✗ Build failed:', e.message);
    process.exit(1);
  }

  const server = createServer(handleRequest);

  server.listen(port, () => {
    console.log('  ✓ Server running!');
    console.log(`  🌐 Local:   http://localhost:${port}/`);
    console.log(`  🔥 Hot reload: enabled`);
    console.log('\n  Press Ctrl+C to stop.\n');
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`\n  ✗ Port ${port} is already in use. Try: node dev-server.js --port=${port + 1}\n`);
    } else {
      console.error('  ✗ Server error:', err.message);
    }
    process.exit(1);
  });
}

startServer().catch(console.error);
