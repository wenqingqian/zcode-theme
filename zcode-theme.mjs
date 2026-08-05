#!/usr/bin/env node
/**
 * ZCode 主题注入脚本（CDP 远程调试，hack 路线 2）
 *
 * 用法：
 *   node zcode-theme.mjs inject [主题] [--light|--dark]      # 注入主题（带重试，等首屏就绪）
 *   node zcode-theme.mjs demo  [主题] [--light|--dark]       # 注入 + before/after 对比截图
 *   node zcode-theme.mjs shot  <png> [主题] [--light|--dark] # 注入 + 单张截图
 *   也可用环境变量 ZCODE_THEME 指定主题
 *
 * 主题: amber | latte | mint  —— 每个都含浅色+深色变体。
 *   默认双变体同时注入，跟随 app 外观切换；
 *   --light / --dark（或 ZCODE_VARIANT=light|dark|auto）强制只用指定变体（强行覆盖，app 切换不变色）
 *   优先级: 显式 flag（--light / --dark）> ZCODE_VARIANT 环境变量 > auto 默认
 * 前置: ZCode 以 --remote-debugging-port=9222 启动
 *
 * 背景图（可选）:
 *   ZCODE_BG_IMAGE=/path/img.jpg   本地图片做全窗口壁纸（png/jpg/jpeg/webp/gif, ≤10MB）
 *   ZCODE_BG_OPACITY=60            壳上图片可见度 0–100（默认 60; 100=无遮罩, 0=纯色回退）
 *                                  聊天区/面板始终带 ≥92% 可读性遮罩，文字零干扰
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const PORT = process.env.ZCODE_CDP_PORT || '9222';
const ARGS = process.argv.slice(2);
const POSITIONAL = ARGS.filter((a) => !a.startsWith('--'));
const FLAG_VARIANT = ARGS.find((a) => a === '--light' || a === '--dark')?.slice(2);
const MODE = POSITIONAL[0] || 'inject';
const THEME = (process.env.ZCODE_THEME || (MODE === 'shot' ? POSITIONAL[2] : POSITIONAL[1]) || 'amber').toLowerCase();
const SHOT_FILE = MODE === 'shot' ? POSITIONAL[1] : undefined;
const OUTDIR = resolve(process.cwd(), 'zcode-theme-demo');
const BG_IMAGE = process.env.ZCODE_BG_IMAGE || '';
const _opacity = Number.parseInt(process.env.ZCODE_BG_OPACITY ?? '60', 10);
const BG_OPACITY = Number.isNaN(_opacity) ? 60 : Math.min(100, Math.max(0, _opacity));
const VARIANT = (FLAG_VARIANT || process.env.ZCODE_VARIANT || 'auto').toLowerCase();

if (!['auto', 'light', 'dark'].includes(VARIANT)) {
  console.error('未知变体:', VARIANT, '—— 可用: auto | light | dark（或 --light / --dark）');
  process.exit(1);
}

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
  --color-terminal-black:#1a2130;
  --color-terminal-red:#e07a5f;
  --color-terminal-green:#a3b86b;
  --color-terminal-yellow:#ffb26b;
  --color-terminal-blue:#7aa2d8;
  --color-terminal-magenta:#c39bd3;
  --color-terminal-cyan:#6bb8b0;
  --color-terminal-white:#d8d5cf;
  --color-terminal-bright-black:#3a4556;
  --color-terminal-bright-red:#ea8a76;
  --color-terminal-bright-green:#b8cc82;
  --color-terminal-bright-yellow:#ffc98a;
  --color-terminal-bright-blue:#93b8e4;
  --color-terminal-bright-magenta:#d4b3e0;
  --color-terminal-bright-cyan:#87ccc5;
  --color-terminal-bright-white:#e8e6e3;
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
  --color-terminal-black:#3a3226;
  --color-terminal-red:#c2452d;
  --color-terminal-green:#6b8e23;
  --color-terminal-yellow:#d97706;
  --color-terminal-blue:#4a7ebb;
  --color-terminal-magenta:#9b6bb8;
  --color-terminal-cyan:#2a9d8f;
  --color-terminal-white:#e9e2d4;
  --color-terminal-bright-black:#8a7d68;
  --color-terminal-bright-red:#d45a3f;
  --color-terminal-bright-green:#7fa530;
  --color-terminal-bright-yellow:#e89b3c;
  --color-terminal-bright-blue:#5f92c9;
  --color-terminal-bright-magenta:#b085cc;
  --color-terminal-bright-cyan:#3fb3a3;
  --color-terminal-bright-white:#faf6ee;
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

const DARK_MOCHA = `
/* 深色变体：Catppuccin Mocha（latte 的官方深色对应） */
.theme-zai-dark, .dark {
  --color-background:#1e1e2e;            /* base */
  --color-background-alt:#181825;        /* mantle */
  --color-background-win-alt:#252536;    /* 窗口/面板 */
  --color-header:#252536;
  --color-panel:#252536;
  --color-sidebar:#1e1e2e;
  --color-card:#252536;
  --color-card-selected:#313244;         /* surface0 */
  --color-popover:#252536;
  --color-popover-header:#252536;
  --color-input:#252536;
  --color-menu:#252536;
  --color-menu-hover:#313244;
  --color-tooltip:#252536;
  --color-tooltip-tag:#313244;
  --color-toast:#252536;
  --color-tab:#252536;
  --color-tab-active:#1e1e2e;
  --color-brand:#89b4fa;                 /* blue */
  --color-accent:#89b4fa;
  --color-primary:#cdd6f4;               /* text */
  --color-primary-foreground:#11111b;    /* crust */
  --color-foreground:#cdd6f4;
  --color-foreground-subtle:color-mix(in oklab, #cdd6f4 60%, transparent);
  --color-foreground-subtlest:color-mix(in oklab, #cdd6f4 30%, transparent);
  --color-border:#ffffff14;
  --color-border-hover:#ffffff26;
  --color-find-highlight:#45475a;        /* surface1 */
  --color-find-highlight-active:#89b4fa;
  --color-interaction-ask-surface:#313244;
  --color-interaction-ask-foreground:#b4befe;  /* lavender */
  --color-terminal-cursor:#89b4fa;
  --color-terminal-cursor-accent:#1e1e2e;
  --color-terminal-selection:#89b4fa40;
  --color-terminal-black:#45475a;
  --color-terminal-red:#f38ba8;
  --color-terminal-green:#a6e3a1;
  --color-terminal-yellow:#f9e2af;
  --color-terminal-blue:#89b4fa;
  --color-terminal-magenta:#cba6f7;
  --color-terminal-cyan:#94e2d5;
  --color-terminal-white:#bac2de;
  --color-terminal-bright-black:#585b70;
  --color-terminal-bright-red:#f38ba8;
  --color-terminal-bright-green:#a6e3a1;
  --color-terminal-bright-yellow:#f9e2af;
  --color-terminal-bright-blue:#89b4fa;
  --color-terminal-bright-magenta:#cba6f7;
  --color-terminal-bright-cyan:#94e2d5;
  --color-terminal-bright-white:#a6adc8;
}
html.theme-zai-dark, html.dark { --shiki-color-text:#cdd6f4; --shiki-color-background:transparent; } /* 代码高亮 */
`;

const DARK_MINT = `
/* 深色变体：Midnight Mint（深青黑 + 亮薄荷） */
.theme-zai-dark, .dark {
  --color-background:#0d1512;            /* 深青黑 */
  --color-background-alt:#111a16;        /* 次级背景 */
  --color-background-win-alt:#16211c;    /* 窗口/面板 */
  --color-header:#16211c;
  --color-panel:#16211c;
  --color-sidebar:#0d1512;
  --color-card:#16211c;
  --color-card-selected:#1d2c25;
  --color-popover:#16211c;
  --color-popover-header:#16211c;
  --color-input:#16211c;
  --color-menu:#16211c;
  --color-menu-hover:#1d2c25;
  --color-tooltip:#16211c;
  --color-tooltip-tag:#1d2c25;
  --color-toast:#16211c;
  --color-tab:#16211c;
  --color-tab-active:#0d1512;
  --color-brand:#35b892;                 /* 亮薄荷（light 的 #1f8a70 提亮版） */
  --color-accent:#35b892;
  --color-primary:#e4f0ea;
  --color-primary-foreground:#0a1f17;
  --color-foreground:#ddeae3;
  --color-foreground-subtle:color-mix(in oklab, #ddeae3 60%, transparent);
  --color-foreground-subtlest:color-mix(in oklab, #ddeae3 30%, transparent);
  --color-border:#ffffff14;
  --color-border-hover:#ffffff26;
  --color-find-highlight:#1d3a2f;
  --color-find-highlight-active:#35b892;
  --color-interaction-ask-surface:#143126;
  --color-interaction-ask-foreground:#7fdcbd;
  --color-terminal-cursor:#35b892;
  --color-terminal-cursor-accent:#0d1512;
  --color-terminal-selection:#35b89240;
  --color-terminal-black:#213129;
  --color-terminal-red:#e07a6a;
  --color-terminal-green:#4ecb8f;
  --color-terminal-yellow:#d9a441;
  --color-terminal-blue:#6ab0d8;
  --color-terminal-magenta:#b08ad6;
  --color-terminal-cyan:#4ecdc4;
  --color-terminal-white:#c4d8cf;
  --color-terminal-bright-black:#31473c;
  --color-terminal-bright-red:#ea8d7e;
  --color-terminal-bright-green:#6ddaa5;
  --color-terminal-bright-yellow:#e5b65e;
  --color-terminal-bright-blue:#85c1e3;
  --color-terminal-bright-magenta:#c2a2e0;
  --color-terminal-bright-cyan:#6fd9d1;
  --color-terminal-bright-white:#ddeae3;
}
html.theme-zai-dark, html.dark { --shiki-color-text:#ddeae3; --shiki-color-background:transparent; } /* 代码高亮 */
`;

const PALETTES = {
  amber: { dark: DARK_AMBER, light: AMBER_LIGHT },
  latte: { dark: DARK_MOCHA, light: LATTE_LIGHT },
  mint: { dark: DARK_MINT, light: MINT_LIGHT },
};

if (!PALETTES[THEME]) {
  console.error('未知主题:', THEME, '—— 可用:', Object.keys(PALETTES).join(', '));
  process.exit(1);
}

// 双变体默认同时注入（跟随 app 外观切换）；
// --light/--dark 强制时，把选定变体的变量同时写到两个外观类下（app 切换不变色）。
function buildCustomCss() {
  const p = PALETTES[THEME];
  if (VARIANT === 'auto') return `${p.dark}\n\n${p.light}`;
  // 选择器改写依赖模板中的字节级精确匹配；任何一次 replace 落空都意味着强制模式
  // 会静默退化为“只在自身类下注入”，这里必须大声失败而不是默默降级。
  const assertRewritten = (src, find, expanded) => {
    const out = src.replace(find, expanded);
    if (out === src) {
      console.error(`✗ 强制变体(${VARIANT})选择器改写失败: 调色板模板 ${THEME} 中未找到 ${JSON.stringify(find)} —— 模板可能被改动, 强制模式将失效`);
      process.exit(1);
    }
    return out;
  };
  if (VARIANT === 'dark') {
    return assertRewritten(
      assertRewritten(p.dark, '.theme-zai-dark, .dark {', '.theme-zai-dark, .dark, .theme-zai-light {'),
      'html.theme-zai-dark, html.dark {',
      'html.theme-zai-dark, html.dark, html.theme-zai-light {',
    );
  }
  return assertRewritten(
    assertRewritten(p.light, '.theme-zai-light {', '.theme-zai-light, .theme-zai-dark, .dark {'),
    'html.theme-zai-light {',
    'html.theme-zai-light, html.theme-zai-dark, html.dark {',
  );
}

const CUSTOM_CSS = buildCustomCss();

// ---------- 背景图片（ZCODE_BG_IMAGE，可选）----------
// 壁纸模式: 主壳 + 聊天区/右侧面板各自携带**同一图片的分层背景**
// （渐变遮罩 + 图片在同一元素内合成, 元素整体不透明）。侧栏等透明区域透出壳上的图片。
// 遮罩色跟随 var(--color-background), 深浅色主题自动适配。
// 壳遮罩 = 100 - ZCODE_BG_OPACITY; 面板遮罩 ≥92%（跟随壳遮罩上浮, 不会更薄; 保文字可读,
// 且浓到跨元素贴图接缝不可见 —— 面板不能用 background-attachment:fixed 与壳对齐, 见下）。
// ⚠ 两种卡死 Chromium 合成器的结构（CDP 截图无响应、UI 渲染异常, 均实测）:
//    1) 半透明子元素叠加在背景图元素上（与 color-mix 无关）——壁纸模式的每个
//       贴图元素自身都是不透明的（图片层垫底），因此安全;
//    2) 内层面板（#content section.rounded-xl）上使用 background-attachment:fixed
//       ——因此一律不用 fixed（壳占满视口不滚动, fixed 对它本无意义）。
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
  if (!MIME_BY_EXT[ext]) console.warn(`⚠ ZCODE_BG_IMAGE 扩展名无法识别（${ext || '无'}）—— 按 image/png 处理，图片可能无法解码`);
  const shellAlpha = 100 - BG_OPACITY;                 // 壳遮罩不透明度（图片可见度越高遮罩越薄）
  const panelAlpha = Math.max(shellAlpha, 92);         // 面板遮罩 ≥92%（跟随壳遮罩上浮, 不会更薄），保文字可读、接缝不可见
  const shellVeil = `color-mix(in oklab, var(--color-background) ${shellAlpha}%, transparent)`;
  const panelVeil = `color-mix(in oklab, var(--color-background) ${panelAlpha}%, transparent)`;
  const img = `url("data:${mime};base64,${buf.toString('base64')}")`;
  console.log(`背景图: ${path}（${mime}, ${(buf.length / 1024).toFixed(0)}KB, 可见度 ${BG_OPACITY}%, 面板遮罩 ${panelAlpha}%）`);
  return `
/* 背景图片（ZCODE_BG_IMAGE）壁纸模式: 壳与面板各自分层贴图（不用 fixed, 见文件头注释） */
div.flex.h-dvh.flex-col.overflow-hidden {
  background: linear-gradient(${shellVeil} 0 100%), ${img} center / cover no-repeat var(--color-background);
}
#content section.rounded-xl,
.side-pane-open-tab-shell {
  background: linear-gradient(${panelVeil} 0 100%), ${img} center / cover no-repeat var(--color-background);
}
/* 防御: 壳之下的祖先必须保持透明，否则挡住壳上的图片（含圆角边缘） */
html, body, #root { background: transparent !important; }`;
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
  return 'injected(' + '${THEME}${VARIANT === 'auto' ? '' : ':' + VARIANT}' + '); classes=' + document.documentElement.className;
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
