#!/usr/bin/env node

/**
 * GlazePress 构建脚本入口
 *
 * 用法:
 *   node build.js              # 生产构建
 *   node build.js --env=dev    # 开发构建（不压缩）
 *   node build.js --watch      # 监听模式（文件变更自动重建）
 *   node build.js --clean      # 清除构建产物 (dist/)
 */

import { resolve, dirname } from "path";
import { rmSync, existsSync } from "fs";
import { fileURLToPath } from "url";
import chokidar from "chokidar";
import { Builder } from "./src/core/builder.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ==================== CLI 参数解析 ====================
const args = process.argv.slice(2);

function getArg(name, defaultValue) {
  // 支持 --name=value 和 --name value 两种格式
  const match = args.find(
    (a) => a === `--${name}` || a.startsWith(`--${name}=`),
  );
  if (!match) return defaultValue;
  if (match === `--${name}`) {
    // --name value 格式：取下一个参数
    const idx = args.indexOf(match);
    return idx + 1 < args.length ? args[idx + 1].toLowerCase() : defaultValue;
  }
  return match.split("=")[1].toLowerCase();
}

const hasFlag = (name) => args.includes(`--${name}`);

// ==================== clean 命令 ====================
if (hasFlag("clean")) {
  const distDir = resolve(__dirname, "dist");
  if (existsSync(distDir)) {
    rmSync(distDir, { recursive: true, force: true });
    console.log("\n🧹 Clean complete — dist/ removed\n");
  } else {
    console.log("\n🧹 dist/ does not exist, nothing to clean\n");
  }
  process.exit(0);
}

// ==================== 主流程 ====================
const env = getArg("env", "production");
const watchMode = hasFlag("watch");

async function main() {
  const builder = new Builder({
    rootDir: resolve(__dirname),
    env: env === "production" ? "production" : "development",
  });

  if (watchMode) {
    // 监听模式：使用 chokidar 监听文件变化
    console.log("\n👀 Watch mode enabled. Watching for changes...\n");
    console.log("  Press Ctrl+C to stop.\n");

    await builder.build(); // 首次完整构建

    // 监听源文件变化
    const watcher = chokidar.watch(
      [
        resolve(__dirname, "blog.config.js"),
        resolve(__dirname, "src/posts/**/*.md"),
        resolve(__dirname, "src/themes/**/*"),
        resolve(__dirname, "src/plugins/**/*.js"),
        resolve(__dirname, "src/assets/**/*"),
      ],
      {
        ignoreInitial: true,
        awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
      },
    );

    let rebuildTimer = null;

    watcher.on("all", (event, filePath) => {
      if (rebuildTimer) clearTimeout(rebuildTimer);

      // 防抖：300ms 后重建
      rebuildTimer = setTimeout(async () => {
        const relPath = filePath
          .replace(resolve(__dirname), "")
          .replace(/\\/g, "");
        console.log(`\n📝 Change detected: ${relPath} (${event})\n`);
        try {
          await builder.incrementalBuild();
        } catch (e) {
          console.error("Rebuild failed:", e.message);
        }
      }, 300);
    });
  } else {
    // 单次构建
    try {
      await builder.build();
    } catch (e) {
      console.error("\n❌ Build failed:", e.message);
      process.exit(1);
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
