#!/usr/bin/env node
/**
 * ZCode 主题注入脚本（CDP 远程调试）
 *
 * 用法：
 *   node zcode-theme.mjs inject [主题] [--light|--dark]      # 注入主题（带重试，等首屏就绪）
 *   node zcode-theme.mjs demo  [主题] [--light|--dark]       # 注入 + before/after 对比截图（试用, 不写配置）
 *   node zcode-theme.mjs shot  <png> [主题] [--light|--dark] # 注入 + 单张截图（试用, 不写配置）
 *
 * 内置主题: amber | latte | mint | sea | mist —— 每个都含浅色+深色变体，注入后跟随 app 外观切换。
 *   amber/latte/mint 为纯色主题；sea（暗蓝海面）/mist（雾山）为壁纸主题（图片内置在 wallpapers/，
 *   与纯色主题同一接口按名字注入，无需关心是图还是色）。
 *
 * 外观槽位模型：配置分 light / dark 两个槽位（app 浅色/深色外观时各自生效），
 * 持久化在 ~/.config/zcode-theme/config.json（$XDG_CONFIG_HOME 优先）：
 *   inject <主题>            两个槽位都设为该主题并保存（两个外观同色）
 *   inject <主题> --light    只设 light 槽（dark 槽保持原配置）并保存；--dark 镜像
 *   inject（不带主题）        按配置复用 —— 裸 `zcode-theme` 启动器走的就是这条路
 * 主题名优先级: 位置参数 > ZCODE_THEME 环境变量（一次性, 不写配置）> 配置文件
 * 槽位 flag 优先级: --light/--dark > ZCODE_VARIANT 环境变量（一次性）> auto（双槽）
 *
 * 前置: ZCode 以 --remote-debugging-port=9222 启动
 *
 * 高级覆盖（一次性, 不写配置）:
 *   ZCODE_BG_IMAGE=/path/img.jpg   用本地图片覆盖两个槽位的壁纸（png/jpg/jpeg/webp/gif, ≤10MB）
 *   ZCODE_BG_OPACITY=60            覆盖时壳上图片可见度 0–100（默认 60; 面板始终 ≥92% 可读性遮罩）
 */
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.ZCODE_CDP_PORT || '9222';
const ARGS = process.argv.slice(2);
const POSITIONAL = ARGS.filter((a) => !a.startsWith('--'));
const FLAG_SLOT = ARGS.find((a) => a === '--light' || a === '--dark')?.slice(2);
for (const a of ARGS) {
  if (a.startsWith('--') && a !== '--light' && a !== '--dark') console.warn(`⚠ 未识别的参数: ${a} —— 已忽略`);
}
const MODE = POSITIONAL[0] || 'inject';
if (!['inject', 'demo', 'shot'].includes(MODE)) {
  console.error('未知模式:', MODE, '—— 可用: inject | demo | shot');
  process.exit(1);
}
const THEME_ARG = (MODE === 'shot' ? POSITIONAL[2] : POSITIONAL[1])?.toLowerCase() || '';
const SHOT_FILE = MODE === 'shot' ? POSITIONAL[1] : undefined;
const OUTDIR = resolve(process.cwd(), 'zcode-theme-demo');
const BG_IMAGE = process.env.ZCODE_BG_IMAGE || '';
const _opacity = Number.parseInt(process.env.ZCODE_BG_OPACITY ?? '60', 10);
const BG_OPACITY = Number.isNaN(_opacity) ? 60 : Math.min(100, Math.max(0, _opacity));
const SLOT = (FLAG_SLOT || process.env.ZCODE_VARIANT || 'auto').toLowerCase();

if (!['auto', 'light', 'dark'].includes(SLOT)) {
  console.error('未知槽位:', SLOT, '—— 可用: light | dark（或 --light / --dark）; 缺省为双槽');
  process.exit(1);
}

// ---------- 主题调色板 ----------
// 原理：默认主题类是 documentElement 上的 .theme-zai-dark / .theme-zai-light，
// 保持类不动，注入 <style> 覆盖它定义的 CSS 变量（变量值会继承到全 UI）。
// 深色调色板写在 .theme-zai-dark 选择器下、浅色写在 .theme-zai-light 下 ——
// 槽位组装时直接按外观取用对应调色板即可。

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

// ---------- 内置主题注册表 ----------
// 纯色主题与壁纸主题同一结构：light/dark 两个外观变体 + 可选 image（wallpapers/ 下的内置图）。
// 壁纸主题按名字注入即可，使用者无需关心是图还是色。
const THEMES = {
  amber: { dark: DARK_AMBER, light: AMBER_LIGHT },
  latte: { dark: DARK_MOCHA, light: LATTE_LIGHT },
  mint:  { dark: DARK_MINT,  light: MINT_LIGHT  },
  sea:   { dark: DARK_MOCHA, light: LATTE_LIGHT, image: 'sea.jpg'  },  // 暗蓝海面
  mist:  { dark: DARK_MINT,  light: MINT_LIGHT,  image: 'mist.jpg' },  // 雾山
};

// ---------- 外观槽位配置（~/.config/zcode-theme/config.json）----------
// 配置只存两个槽位的内置主题名: {"light":"sea","dark":"mint"}
const CONFIG_DIR = resolve(process.env.XDG_CONFIG_HOME || `${process.env.HOME}/.config`, 'zcode-theme');
const CONFIG_FILE = resolve(CONFIG_DIR, 'config.json');
const DEFAULT_SLOTS = { light: 'amber', dark: 'amber' };

function validateThemeName(name, source) {
  if (!Object.hasOwn(THEMES, name)) {
    console.error(`未知主题: ${name}（来源: ${source}）—— 可用:`, Object.keys(THEMES).join(', '));
    process.exit(1);
  }
  return name;
}

async function readSlots() {
  let raw;
  try {
    raw = await readFile(CONFIG_FILE, 'utf8');
  } catch {
    return { ...DEFAULT_SLOTS };   // 首次使用: 无配置文件
  }
  let cfg;
  try {
    cfg = JSON.parse(raw);
  } catch {
    console.warn(`⚠ 配置文件无法解析: ${CONFIG_FILE} —— 回退默认（light=${DEFAULT_SLOTS.light}, dark=${DEFAULT_SLOTS.dark}）`);
    return { ...DEFAULT_SLOTS };
  }
  const slots = { ...DEFAULT_SLOTS };
  for (const k of ['light', 'dark']) {
    if (typeof cfg?.[k] === 'string' && Object.hasOwn(THEMES, cfg[k])) slots[k] = cfg[k];
    else if (cfg?.[k] != null) console.warn(`⚠ 配置中 ${k} 槽位的主题名无效: ${JSON.stringify(cfg[k])} —— 回退 ${DEFAULT_SLOTS[k]}`);
  }
  return slots;
}

async function saveSlots(slots) {
  await mkdir(CONFIG_DIR, { recursive: true });
  await writeFile(CONFIG_FILE, `${JSON.stringify(slots, null, 2)}\n`);
}

// ---------- 槽位解析：位置参数 > ZCODE_THEME（一次性） > 配置文件 ----------
const slots = await readSlots();
const explicit = THEME_ARG
  ? validateThemeName(THEME_ARG, '命令行参数')
  : process.env.ZCODE_THEME
    ? validateThemeName(process.env.ZCODE_THEME.toLowerCase(), 'ZCODE_THEME 环境变量')
    : null;
if (explicit) {
  if (SLOT === 'auto') { slots.light = explicit; slots.dark = explicit; }
  else slots[SLOT] = explicit;
  // 只有"位置参数显式指定 + inject 模式"才持久化; demo/shot 与 ZCODE_THEME 都是一次性试用
  if (MODE === 'inject' && THEME_ARG) {
    try {
      await saveSlots(slots);
      console.log(`配置已保存: ${CONFIG_FILE}（light=${slots.light}, dark=${slots.dark}）`);
    } catch (e) {
      console.warn(`⚠ 配置保存失败（${e.code ?? e}）—— 本次仍注入，但选择不会被记住`);
    }
  } else {
    console.log(`试用模式（${MODE === 'inject' ? 'ZCODE_THEME' : MODE}）: 不写配置文件`);
  }
}

// ---------- 壁纸（内置主题的图片 / ZCODE_BG_IMAGE 一次性覆盖）----------
// 壁纸模式: 主壳 + 聊天区/右侧面板各自携带**同一图片的分层背景**
// （渐变遮罩 + 图片在同一元素内合成, 元素整体不透明）。侧栏等透明区域透出壳上的图片。
// 遮罩色跟随 var(--color-background), 深浅色外观自动适配。
// 规则按外观类前缀作用域（html.theme-zai-light/dark …）: 槽位没有壁纸时, 切到该外观壁纸自然消失。
// 内置壁纸主题遮罩固化: 壳 40%（图片可见度 60）; 面板 ≥92%（跟随壳遮罩上浮, 不会更薄;
// 保文字可读, 且浓到跨元素贴图接缝不可见 —— 面板不能用 background-attachment:fixed 与壳对齐, 见下）。
// ⚠ 两种卡死 Chromium 合成器的结构（CDP 截图无响应、UI 渲染异常, 均实测）:
//    1) 半透明子元素叠加在背景图元素上（与 color-mix 无关）——壁纸模式的每个
//       贴图元素自身都是不透明的（图片层垫底），因此安全;
//    2) 内层面板（#content section.rounded-xl）上使用 background-attachment:fixed
//       ——因此一律不用 fixed（壳占满视口不滚动, fixed 对它本无意义）。
const MIME_BY_EXT = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif' };
const SHELL_OPACITY = 60;    // 内置壁纸主题: 壳上图片可见度（遮罩 40%）
const PANEL_MIN_VEIL = 92;   // 面板遮罩下限（保文字可读 + 接缝不可见）

async function loadImageUrl(path, label) {
  let buf;
  try {
    buf = await readFile(path);
  } catch {
    console.warn(`⚠ ${label} 图片不可读: ${path} —— 壁纸跳过（主题调色板不受影响）`);
    return null;
  }
  if (buf.length > 10 * 1024 * 1024) {
    console.warn(`⚠ ${label} 图片超过 10MB（${(buf.length / 1048576).toFixed(1)}MB）—— 已跳过，换小一点的图`);
    return null;
  }
  const ext = path.split('.').pop()?.toLowerCase() || '';
  const mime = MIME_BY_EXT[ext];
  if (!mime) {
    console.warn(`⚠ ${label} 扩展名无法识别（${ext || '无'}）—— 已跳过（支持: ${Object.keys(MIME_BY_EXT).join('/')}）`);
    return null;
  }
  return { url: `url("data:${mime};base64,${buf.toString('base64')}")`, sizeKB: (buf.length / 1024).toFixed(0) };
}

// classes: 作用域外观类列表（['theme-zai-light'] / ['theme-zai-dark'] / 两者）。
// 图片 data URI 只在一处定义为 CSS 变量 --zcode-wallpaper（var() 在解析前做原始令牌替换,
// 可安全用于 background 简写）, 各贴图规则引用变量 —— 同一图片在两个槽位间只嵌入一次。
function wallpaperCss(img, classes, shellAlpha, panelAlpha) {
  const shellVeil = `color-mix(in oklab, var(--color-background) ${shellAlpha}%, transparent)`;
  const panelVeil = `color-mix(in oklab, var(--color-background) ${panelAlpha}%, transparent)`;
  const htmlSel = classes.map((c) => `html.${c}`).join(', ');
  const layer = `var(--zcode-wallpaper) center / cover no-repeat var(--color-background)`;
  const rules = classes.map((c) => {
    const s = `html.${c} `;  // 后代作用域前缀
    return `
${s}div.flex.h-dvh.flex-col.overflow-hidden {
  background: linear-gradient(${shellVeil} 0 100%), ${layer};
}
${s}#content section.rounded-xl,
${s}.side-pane-open-tab-shell {
  background: linear-gradient(${panelVeil} 0 100%), ${layer};
}
/* 防御: 壳之下的祖先必须保持透明，否则挡住壳上的图片（含圆角边缘） */
html.${c}, ${s}body, ${s}#root { background: transparent !important; }`;
  }).join('\n');
  return `
/* 壁纸(${classes.join(' + ')}): 壳与面板各自分层贴图（不用 fixed, 见上方注释） */
${htmlSel} { --zcode-wallpaper: ${img}; }${rules}`;
}

async function buildCss() {
  const parts = [THEMES[slots.dark].dark, THEMES[slots.light].light];
  // 内置壁纸主题: 按图片把槽位分组 —— 两个槽位用同一张图时只嵌入一次
  const byImage = new Map();   // image 文件名 -> [槽位名...]
  for (const slotName of ['light', 'dark']) {
    const t = THEMES[slots[slotName]];
    if (t.image) {
      const group = byImage.get(t.image) || [];
      group.push(slotName);
      byImage.set(t.image, group);
    }
  }
  for (const [image, slotNames] of byImage) {
    const img = await loadImageUrl(resolve(SCRIPT_DIR, 'wallpapers', image), '内置壁纸');
    if (!img) continue;
    const shellAlpha = 100 - SHELL_OPACITY;
    const panelAlpha = Math.max(shellAlpha, PANEL_MIN_VEIL);
    console.log(`壁纸[${slotNames.join('+')} 槽]: wallpapers/${image}（${img.sizeKB}KB, 壳可见度 ${SHELL_OPACITY}%, 面板遮罩 ${panelAlpha}%）`);
    parts.push(wallpaperCss(img.url, slotNames.map((n) => `theme-zai-${n}`), shellAlpha, panelAlpha));
  }
  // ZCODE_BG_IMAGE: 一次性全局覆盖（两个外观类都写, 置于内置壁纸之后 → 同等优先级靠后生效）, 不写配置
  if (BG_IMAGE) {
    const path = resolve(BG_IMAGE.replace(/^~\//, `${process.env.HOME}/`));
    const img = await loadImageUrl(path, 'ZCODE_BG_IMAGE');
    if (img) {
      const shellAlpha = 100 - BG_OPACITY;
      const panelAlpha = Math.max(shellAlpha, PANEL_MIN_VEIL);
      console.log(`壁纸[全局覆盖]: ${path}（${img.sizeKB}KB, 可见度 ${BG_OPACITY}%, 面板遮罩 ${panelAlpha}%, 不写配置）`);
      parts.push(wallpaperCss(img.url, ['theme-zai-light', 'theme-zai-dark'], shellAlpha, panelAlpha));
    }
  }
  return parts.join('\n');
}

const CUSTOM_CSS = await buildCss();

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

const SLOTS_DESC = `light=${slots.light} dark=${slots.dark}`;
const INJECT_JS = `(() => {
  const id = 'zcode-custom-theme';
  document.getElementById(id)?.remove();
  const s = document.createElement('style');
  s.id = id;
  s.textContent = ${JSON.stringify(CUSTOM_CSS)};
  (document.head || document.documentElement).appendChild(s);
  return 'injected(${SLOTS_DESC})' + '; classes=' + document.documentElement.className;
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
} else {
  // demo: before/after 对比截图
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
}
