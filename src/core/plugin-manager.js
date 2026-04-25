/**
 * 插件管理器 - GlazePress 核心模块
 *
 * 插件接口契约：
 * module.exports = {
 *   name: 'plugin-name',                          // 必填：插件唯一标识
 *   beforeBuild(config, manifest) { },             // 可选：构建前钩子
 *   transformMarkdown(md, frontmatter) { return md; }, // 可选：MD 转换钩子
 *   transformHTML(html, frontmatter) { return html; }, // 可选：HTML 后处理钩子
 *   afterBuild(distPath, manifest) { }             // 可选：构建后钩子
 * };
 *
 * 扩展点：
 * - usePlugin() API 支持注册自定义 shortcode
 * - 新增钩子类型只需在此扩展 phases 数组
 */

import { existsSync, readdirSync } from 'fs';
import { resolve, dirname, extname } from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const _require = createRequire(import.meta.url);
const __dirname = dirname(fileURLToPath(import.meta.url));

// ========== 生命周期阶段定义 ==========
const PHASES = [
  'beforeBuild',
  'transformMarkdown',
  'transformHTML',
  'afterBuild'
];

class PluginManager {
  constructor() {
    /** @type {Map<string, object>} 已加载的插件实例 */
    this.plugins = new Map();

    /** @type {Map<string, Function>} 注册的 shortcode 渲染器 */
    this.shortcodes = new Map();

    /** @type {object} 全局共享数据（插件间通信） */
    this.sharedData = {};
  }

  /**
   * 加载单个插件
   * @param {string} pluginPath - 插件文件路径（相对/绝对）
   */
  async load(pluginPath) {
    const absolutePath = resolve(pluginPath);

    if (!existsSync(absolutePath)) {
      console.warn(`  ⚠ Plugin not found: ${pluginPath}`);
      return null;
    }

    try {
      const pluginModule = _require(absolutePath);
      const plugin = pluginModule.default || pluginModule;

      if (!plugin.name) {
        throw new Error(`Plugin at ${pluginPath} missing required "name" field`);
      }

      if (this.plugins.has(plugin.name)) {
        console.warn(`  ⚠ Plugin "${plugin.name}" already loaded, skipping duplicate`);
        return null;
      }

      this.plugins.set(plugin.name, plugin);
      return plugin;
    } catch (e) {
      console.error(`  ✗ Failed to load plugin ${pluginPath}:`, e.message);
      return null;
    }
  }

  /**
   * 批量加载目录下所有 .js 文件作为插件
   * @param {string} pluginsDir - 插件目录路径
   */
  async loadAllFromDir(pluginsDir) {
    const dir = resolve(pluginsDir);
    if (!existsSync(dir)) {
      console.log(`  ℹ Plugins directory not found: ${pluginsDir}`);
      return;
    }

    const files = readdirSync(dir);

    for (const file of files) {
      if (file.endsWith('.js') && !file.startsWith('_')) {
        await this.load(resolve(dir, file));
      }
    }
  }

  /**
   * 从配置中的插件列表批量加载
   * @param {string[]} pluginPaths - blog.config.js 中 plugins 数组
   */
  async loadFromArray(pluginPaths) {
    if (!Array.isArray(pluginPaths) || pluginPaths.length === 0) return;

    for (const path of pluginPaths) {
      await this.load(path);
    }
  }

  /**
   * 执行指定阶段的插件钩子（串行，按加载顺序）
   * @param {string} phase - 钩子阶段名
   * @param {...any} args - 传递给钩子的参数
   * @returns {*} 最后一个钩子的返回值（用于 transform 类型钩子）
   */
  async runHook(phase, ...args) {
    if (!PHASES.includes(phase)) {
      throw new Error(`Unknown hook phase: ${phase}. Available: ${PHASES.join(', ')}`);
    }

    let result;
    for (const [name, plugin] of this.plugins) {
      if (typeof plugin[phase] === 'function') {
        try {
          const hookResult = await plugin[phase](...args, this.sharedData);
          // transform 类型的钩子返回值会传递给下一个插件
          if (phase.startsWith('transform')) {
            result = hookResult !== undefined ? hookResult : args[0];
            args[0] = result; // 更新第一个参数供后续插件使用
          }
        } catch (e) {
          console.error(`  ✗ Error in plugin "${name}" phase "${phase}":`, e.message);
        }
      }
    }

    return result || args[0];
  }

  /**
   * 注册自定义 shortcode 渲染器
   * @param {string} name - shortcode 名称，如 'youtube'
   * @param {Function} renderer - 渲染函数(attrs) => HTML string
   *
   * 示例:
   *   manager.registerShortcode('youtube', ({id}) =>
   *     `<div class="youtube-embed"><iframe src="https://www.youtube.com/embed/${id}" /></div>`
   *   );
   *   // Markdown 中使用: {% youtube id="dQw4w9WgXcQ" %}
   */
  registerShortcode(name, renderer) {
    if (this.shortcodes.has(name)) {
      console.warn(`  ⚠ Shortcode "${name}" is being overwritten`);
    }
    this.shortcodes.set(name, renderer);
  }

  /**
   * 渲染 shortcode 标签
   * 匹配格式: {% name key1="val1" key2="val2" %} 或 {% name content %}
   */
  renderShortcodes(content) {
    let result = content;

    for (const [name, renderer] of this.shortcodes) {
      // 匹配 {% name attrs %} 格式
      const regex = new RegExp(`\\{\\%\\s*${name}\\s+([\\s\\S]*?)\\%\\}`, 'g');

      result = result.replace(regex, (match, rawAttrs) => {
        try {
          const attrs = parseShortcodeAttrs(rawAttrs.trim());
          return renderer(attrs);
        } catch (e) {
          console.error(`Shortcode [${name}] render error:`, e.message);
          return `<!-- Shortcode error: ${name} -->`;
        }
      });
    }

    return result;
  }

  /** 获取已加载插件列表信息 */
  getLoadedPlugins() {
    return Array.from(this.plugins.keys());
  }

  /** 获取所有注册的 shortcode 名称 */
  getRegisteredShortcodes() {
    return Array.from(this.shortcodes.keys());
  }
}

/**
 * 解析 shortcode 属性字符串为对象
 * "key1='val1' key2=\"val2\" key3=val3 plainText"
 * => { key1: 'val1', key2: 'val2', key3: 'val3', _: 'plainText' }
 */
function parseShortcodeAttrs(str) {
  const attrs = {};

  // 匹配 key="value" / key='value' / key=value
  const attrRegex = /(\w[\w-]*)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;

  let lastIndex = 0;
  let match;

  while ((match = attrRegex.exec(str)) !== null) {
    attrs[match[1]] = match[2] ?? match[3] ?? match[4];
    lastIndex = match.index + match[0].length;
  }

  // 捕获剩余的纯文本内容
  const remaining = str.slice(lastIndex).trim();
  if (remaining && !Object.keys(attrs).includes('_')) {
    attrs._ = remaining;
  }

  return attrs;
}

export default PluginManager;
