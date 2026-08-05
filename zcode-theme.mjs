#!/usr/bin/env node
/**
 * ZCode 主题注入脚本（CDP 远程调试，hack 路线 2）
 *
 * 用法：
 *   node zcode-theme.mjs inject [主题]      # 注入主题（带重试，等首屏就绪）
 *   node zcode-theme.mjs demo  [主题]       # 注入 + before/after 对比截图
 *   node zcode-theme.mjs shot  <png> [主题] # 注入 + 单张截图
 *   也可用环境变量 ZCODE_THEME 指定主题
 *
 * 主题: amber | latte | mint  —— 每个都含浅色+深色变体，跟随 app 当前外观设置
 * 前置: ZCode 以 --remote-debugging-port=9222 启动
 *
 * 背景图（可选）:
 *   ZCODE_BG_IMAGE=/path/img.jpg   本地图片做全窗口背景（png/jpg/jpeg/webp/gif, ≤10MB）
 *   ZCODE_BG_OPACITY=60            图片可见度 0–100（默认 60; 100=无遮罩, 0=纯色回退）
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const PORT = process.env.ZCODE_CDP_PORT || '9222';
const MODE = process.argv[2] || 'inject';
const THEME = (process.env.ZCODE_THEME || (MODE === 'shot' ? process.argv[4] : process.argv[3]) || 'amber').toLowerCase();
const SHOT_FILE = MODE === 'shot' ? process.argv[3] : undefined;
const OUTDIR = resolve(process.cwd(), 'zcode-theme-demo');
const BG_IMAGE = process.env.ZCODE_BG_IMAGE || '';
const BG_OPACITY = Math.min(100, Math.max(0, Number.parseInt(process.env.ZCODE_BG_OPACITY || '60', 10) || 60));

// ---------- 主题调色板 ----------
// 原理：默认主题类是 documentElement 上的 .theme-zai-dark / .theme-zai-light，
// 保持类不动，注入 <style> 覆盖它定义的 CSS 变量（变量值会继承到全 UI）。

const DARK_AMBER = `
/* 深色变体：Midnight Amber */
.theme-zai-dark, .dark {
  --color-background:#0f1420;            /* 主背景（深蓝黑） */
  --color-background-alt:#141a26;        /* 次级背景 */
  --color-background-win-alt:#1a2130;    /* 窗口/面板 */
  --color-header:#1a2130;
  --color-panel:#1a2130;
  --color-sidebar:#0f1420;
  --color-card:#1a2130;
  --color-card-selected:#222b3d;
  --color-popover:#1a2130;
  --color-popover-header:#1a2130;
  --color-input:#1a2130;
  --color-menu:#1a2130;
  --color-menu-hover:#222b3d;
  --color-tooltip:#1a2130;
  --color-tooltip-tag:#222b3d;
  --color-toast:#1a2130;
  --color-tab:#1a2130;
  --color-tab-active:#0f1420;
  --color-brand:#e8a33d;                 /* 品牌/强调色（琥珀） */
  --color-accent:#e8a33d;
  --color-primary:#f2e9d8;
  --color-primary-foreground:#241a08;
  --color-foreground:#e8e6e3;            /* 正文（暖白） */
  --color-foreground-subtle:color-mix(in oklab, #e8e6e3 60%, transparent);
  --color-foreground-subtlest:color-mix(in oklab, #e8e6e3 30%, transparent);
  --color-border:#ffffff14;
  --color-border-hover:#ffffff26;
  --color-find-highlight:#4d3300;
  --color-find-highlight-active:#ffb26b;
  --color-interaction-ask-surface:#2b1f0d;
  --color-interaction-ask-foreground:#ffcf8a;
  --color-terminal-cursor:#e8a33d;
  --color-terminal-cursor-accent:#0f1420;
  --color-terminal-selection:#e8a33d40;
  --color-terminal-yellow:#ffb26b;
  --color-terminal-bright-yellow:#ffc98a;
}
html.theme-zai-dark, html.dark { --shiki-color-text:#e8e6e3; --shiki-color-background:transparent; } /* 代码高亮 */
`;

const AMBER_LIGHT = `
/* 浅色变体：Amber Paper（暖纸） */
.theme-zai-light {
  --color-background:#faf6ee;            /* 暖纸底 */
  --color-background-alt:#f3ede1;        /* 次级背景 */
  --color-background-win-alt:#f3ede1;    /* 窗口/面板 */
  --color-header:#f3ede1;
  --color-panel:#f3ede1;
  --color-sidebar:#faf6ee;
  --color-card:#fffdf7;
  --color-card-selected:#f0e8d8;
  --color-popover:#fffdf7;
  --color-popover-header:#f3ede1;
  --color-input:#fffdf7;
  --color-menu:#f3ede1;
  --color-menu-hover:#e9dfc9;
  --color-tooltip:#fffdf7;
  --color-toast:#fffdf7;
  --color-tab:#f3ede1;
  --color-tab-active:#faf6ee;
  --color-brand:#b45309;                 /* 品牌/强调色（琥珀棕） */
  --color-accent:#b45309;
  --color-primary:#b45309;
  --color-primary-foreground:#ffffff;
  --color-foreground:#3a3226;            /* 正文（深暖棕） */
  --color-foreground-subtle:color-mix(in oklab, #3a3226 60%, transparent);
  --color-foreground-subtlest:color-mix(in oklab, #3a3226 30%, transparent);
  --color-border:#00000014;
  --color-border-hover:#00000026;
  --color-find-highlight:#f3d9a4;
  --color-find-highlight-active:#d97706;
  --color-interaction-ask-surface:#f0e0c0;
  --color-interaction-ask-foreground:#7c4a03;
  --color-terminal-cursor:#b45309;
  --color-terminal-cursor-accent:#faf6ee;
  --color-terminal-selection:#b4530940;
  --color-terminal-yellow:#d97706;
  --color-terminal-bright-yellow:#b45309;
}
html.theme-zai-light { --shiki-color-text:#3a3226; --shiki-color-background:transparent; } /* 代码高亮 */
`;

const LATTE_LIGHT = `
/* 浅色变体：Catppuccin Latte（奶油柔和） */
.theme-zai-light {
  --color-background:#eff1f5;            /* 主背景（奶油白） */
  --color-background-alt:#e6e9ef;        /* 次级背景 */
  --color-background-win-alt:#e6e9ef;    /* 窗口/面板 */
  --color-header:#e6e9ef;
  --color-panel:#e6e9ef;
  --color-sidebar:#eff1f5;
  --color-card:#ffffff;
  --color-card-selected:#dce0e8;
  --color-popover:#ffffff;
  --color-popover-header:#e6e9ef;
  --color-input:#ffffff;
  --color-menu:#e6e9ef;
  --color-menu-hover:#dce0e8;
  --color-tooltip:#dce0e8;
  --color-tooltip-tag:#ccd0da;
  --color-toast:#ffffff;
  --color-tab:#e6e9ef;
  --color-tab-active:#eff1f5;
  --color-brand:#1e66f5;                 /* 品牌/强调色（蓝） */
  --color-accent:#1e66f5;
  --color-primary:#1e66f5;
  --color-primary-foreground:#ffffff;
  --color-foreground:#4c4f69;            /* 正文 */
  --color-foreground-subtle:#6c6f85;
  --color-foreground-subtlest:#8c8fa1;
  --color-border:#dce0e8;
  --color-border-hover:#ccd0da;
  --color-find-highlight:#f9e2af;
  --color-find-highlight-active:#df8e1d;
  --color-interaction-ask-surface:#dbe7fb;
  --color-interaction-ask-foreground:#1e66f5;
  --color-terminal-cursor:#1e66f5;
  --color-terminal-cursor-accent:#eff1f5;
  --color-terminal-selection:#1e66f540;
  --color-terminal-black:#4c4f69;
  --color-terminal-red:#d20f39;
  --color-terminal-green:#40a02b;
  --color-terminal-yellow:#df8e1d;
  --color-terminal-blue:#1e66f5;
  --color-terminal-magenta:#8839ef;
  --color-terminal-cyan:#179299;
  --color-terminal-white:#ccd0da;
  --color-terminal-bright-black:#acb0be;
  --color-terminal-bright-red:#e64553;
  --color-terminal-bright-green:#40a02b;
  --color-terminal-bright-yellow:#df8e1d;
  --color-terminal-bright-blue:#1e66f5;
  --color-terminal-bright-magenta:#8839ef;
  --color-terminal-bright-cyan:#179299;
  --color-terminal-bright-white:#dce0e8;
}
html.theme-zai-light { --shiki-color-text:#4c4f69; --shiki-color-background:transparent; } /* 代码高亮 */
`;

const MINT_LIGHT = `
/* 浅色变体：Mint Tea（薄荷清新） */
.theme-zai-light {
  --color-background:#f7faf9;            /* 主背景（冷白） */
  --color-background-alt:#eef4f2;        /* 次级背景 */
  --color-background-win-alt:#eef4f2;    /* 窗口/面板 */
  --color-header:#eef4f2;
  --color-panel:#eef4f2;
  --color-sidebar:#f7faf9;
  --color-card:#ffffff;
  --color-card-selected:#dcebe6;
  --color-popover:#ffffff;
  --color-popover-header:#eef4f2;
  --color-input:#ffffff;
  --color-menu:#eef4f2;
  --color-menu-hover:#e2ece8;
  --color-tooltip:#e8f0ed;
  --color-tooltip-tag:#dcebe6;
  --color-toast:#ffffff;
  --color-tab:#eef4f2;
  --color-tab-active:#f7faf9;
  --color-brand:#1f8a70;                 /* 品牌/强调色（薄荷绿） */
  --color-accent:#1f8a70;
  --color-primary:#1f8a70;
  --color-primary-foreground:#ffffff;
  --color-foreground:#2f3e3a;            /* 正文（深青灰） */
  --color-foreground-subtle:#7a8f89;
  --color-foreground-subtlest:#9db0aa;
  --color-border:#dde8e4;
  --color-border-hover:#c9dad4;
  --color-find-highlight:#dff0e0;
  --color-find-highlight-active:#1f8a70;
  --color-interaction-ask-surface:#dcebe6;
  --color-interaction-ask-foreground:#1f8a70;
  --color-terminal-cursor:#1f8a70;
  --color-terminal-cursor-accent:#f7faf9;
  --color-terminal-selection:#1f8a7040;
  --color-terminal-black:#2f3e3a;
  --color-terminal-red:#cc5c4f;
  --color-terminal-green:#1f8a70;
  --color-terminal-yellow:#d9730d;
  --color-terminal-blue:#5b9db8;
  --color-terminal-magenta:#8a6fb8;
  --color-terminal-cyan:#2aa198;
  --color-terminal-white:#dcebe6;
  --color-terminal-bright-black:#9db0aa;
  --color-terminal-bright-red:#d9796f;
  --color-terminal-bright-green:#2aa184;
  --color-terminal-bright-yellow:#e08a2f;
  --color-terminal-bright-blue:#74adc4;
  --color-terminal-bright-magenta:#a68bc9;
  --color-terminal-bright-cyan:#57c0b7;
  --color-terminal-bright-white:#eef4f2;
}
html.theme-zai-light { --shiki-color-text:#2f3e3a; --shiki-color-background:transparent; } /* 代码高亮 */
`;

const PALETTES = {
  amber: { dark: DARK_AMBER, light: AMBER_LIGHT },
  latte: { dark: DARK_AMBER, light: LATTE_LIGHT },
  mint: { dark: DARK_AMBER, light: MINT_LIGHT },
};

if (!PALETTES[THEME]) {
  console.error('未知主题:', THEME, '—— 可用:', Object.keys(PALETTES).join(', '));
  process.exit(1);
}

const CUSTOM_CSS = `${PALETTES[THEME].dark}\n\n${PALETTES[THEME].light}`;

// ---------- 背景图片（ZCODE_BG_IMAGE，可选）----------
// 原理: 主壳背景贴图 + 聊天区/右侧面板/侧栏用主题色半透明遮罩保可读性。
// 遮罩色跟随 var(--color-background), 深浅色主题自动适配。
const MIME_BY_EXT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };

async function buildBgCss() {
  if (!BG_IMAGE) return '';
  const path = BG_IMAGE.replace(/^~\//, `${process.env.HOME}/`);
  let buf;
  try {
    buf = await readFile(resolve(path));
  } catch {
    console.warn(`⚠ ZCODE_BG_IMAGE 文件不可读: ${BG_IMAGE} —— 回退纯色模式`);
    return '';
  }
  if (buf.length > 10 * 1024 * 1024) {
    console.warn(`⚠ ZCODE_BG_IMAGE 超过 10MB（${(buf.length / 1048576).toFixed(1)}MB）—— 已跳过，换小一点的图`);
    return '';
  }
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const mime = MIME_BY_EXT[ext] || 'image/png';
  const veilAlpha = 100 - BG_OPACITY; // 遮罩不透明度（图片可见度越高遮罩越薄）
  console.log(`背景图: ${path}（${mime}, ${(buf.length / 1024).toFixed(0)}KB, 可见度 ${BG_OPACITY}%）`);
  return `
/* 背景图片（ZCODE_BG_IMAGE） */
div.flex.h-dvh.flex-col.overflow-hidden {
  background-image: url("data:${mime};base64,${buf.toString('base64')}");
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}
/* 可读性遮罩: 聊天主区 + 右侧面板 + 侧栏 */
#content section.rounded-xl,
.side-pane-open-tab-shell,
#sidebar {
  background-color: color-mix(in oklab, var(--color-background) ${veilAlpha}%, transparent);
}`;
}

const BG_CSS = await buildBgCss();

// ---------- CDP 工具 ----------
async function getTarget() {
  const res = await fetch(`http://127.0.0.1:${PORT}/json`);
  const targets = await res.json();
  const page = targets.find((t) => t.type === 'page' && t.webSocketDebuggerUrl);
  if (!page) throw new Error('没有找到页面 target');
  return page;
}

function connect(wsUrl) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wsUrl);
    ws.addEventListener('open', () => resolve(ws));
    ws.addEventListener('error', () => reject(new Error('WebSocket 连接失败')));
  });
}

function call(ws, id, method, params = {}) {
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve) => {
    const onMsg = (ev) => {
      const d = JSON.parse(ev.data);
      if (d.id === id) {
        ws.removeEventListener('message', onMsg);
        resolve(d);
      }
    };
    ws.addEventListener('message', onMsg);
  });
}

async function evaluate(ws, expression) {
  const r = await call(ws, 2, 'Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  if (r.error || r.result?.exceptionDetails) {
    throw new Error(JSON.stringify(r.error ?? r.result.exceptionDetails));
  }
  return r.result?.result?.value;
}

const INJECT_JS = `(() => {
  const id = 'zcode-custom-theme';
  document.getElementById(id)?.remove();
  const s = document.createElement('style');
  s.id = id;
  s.textContent = ${JSON.stringify(CUSTOM_CSS + BG_CSS)};
  (document.head || document.documentElement).appendChild(s);
  return 'injected(' + '${THEME}' + '); classes=' + document.documentElement.className;
})()`;

async function tryInject() {
  let page;
  try {
    page = await getTarget();
  } catch {
    return { ok: false, err: 'target not ready' };
  }
  let ws;
  try {
    ws = await connect(page.webSocketDebuggerUrl);
    await call(ws, 1, 'Runtime.enable');
    await new Promise((r) => setTimeout(r, 500));
    const result = await evaluate(ws, INJECT_JS);
    return { ok: true, result };
  } catch (e) {
    return { ok: false, err: String(e) };
  } finally {
    try { ws?.close(); } catch { /* noop */ }
  }
}

async function injectOnce() {
  const deadline = Date.now() + 45_000;
  let last = { ok: false, err: 'not started' };
  while (Date.now() < deadline) {
    last = await tryInject();
    if (last.ok) {
      console.log('注入成功:', last.result);
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.error('注入失败（45s 超时）:', last.err);
  process.exit(1);
}

async function screenshot(path) {
  const page = await getTarget();
  const ws = await connect(page.webSocketDebuggerUrl);
  await call(ws, 1, 'Page.enable');
  const r = await call(ws, 3, 'Page.captureScreenshot', { format: 'png' });
  await mkdir(OUTDIR, { recursive: true });
  const p = resolve(OUTDIR, path);
  await writeFile(p, Buffer.from(r.result.data, 'base64'));
  console.log('截图:', p);
  ws.close();
}

// ---------- 主流程 ----------
if (MODE === 'inject') {
  await injectOnce();
} else if (MODE === 'shot') {
  await injectOnce();
  await new Promise((r) => setTimeout(r, 1500));
  await screenshot(SHOT_FILE || 'shot.png');
} else if (MODE === 'demo') {
  const page = await getTarget();
  const ws = await connect(page.webSocketDebuggerUrl);
  console.log('已连接:', page.title || page.url);
  await call(ws, 1, 'Page.enable');
  await call(ws, 1, 'Runtime.enable');
  await new Promise((r) => setTimeout(r, 2500));
  const before = await call(ws, 3, 'Page.captureScreenshot', { format: 'png' });
  await mkdir(OUTDIR, { recursive: true });
  const beforePath = resolve(OUTDIR, 'before.png');
  await writeFile(beforePath, Buffer.from(before.result.data, 'base64'));
  console.log('before 截图:', beforePath);
  console.log('注入:', await evaluate(ws, INJECT_JS));
  await new Promise((r) => setTimeout(r, 1500));
  const after = await call(ws, 3, 'Page.captureScreenshot', { format: 'png' });
  const afterPath = resolve(OUTDIR, 'after.png');
  await writeFile(afterPath, Buffer.from(after.result.data, 'base64'));
  console.log('after 截图:', afterPath);
  ws.close();
} else {
  console.error('未知模式:', MODE, '—— 可用: inject | demo | shot');
  process.exit(1);
}
