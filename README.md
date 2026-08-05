# zcode-theme

ZCode 桌面应用（Electron）**主题注入工具**：通过 CDP 远程调试向渲染进程注入 CSS 变量覆盖，实现自定义换肤。无需修改安装目录、无需签名重打包。

内置 **3 套主题**（各含浅色 + 深色变体，跟随 app 当前外观设置自动切换）：

| 主题 | 浅色变体 | 深色变体 |
| --- | --- | --- |
| `amber` | Amber Paper（暖纸） | Midnight Amber |
| `latte` | Catppuccin Latte（奶油蓝） | Midnight Amber |
| `mint` | Mint Tea（薄荷绿） | Midnight Amber |

> 灵感来源：ZCode 3.5.2 起有「统一外观设置」，但只支持内置主题且**没有配置文件入口**。本工具用开发者通道（CDP）实现任意配色，不动 app 本体。

---

## 环境要求

- **macOS**（darwin arm64 / x86_64）
- **ZCode 桌面应用** ≥ 3.6.5（`/Applications/ZCode.app`）
- **Node.js ≥ 22**（注入器只依赖内置 `fetch` + `WebSocket`，**零 npm 依赖**）
- 不需要 root，不需要关 SIP

检查环境：

```bash
node -v        # v22.x 以上
ls /Applications/ZCode.app   # 存在即可
```

## 一键安装

```bash
curl -fsSL https://raw.githubusercontent.com/wenqingqian/zcode-theme/main/install.sh | bash
```

脚本会做：环境预检（macOS / Node ≥ 22 / ZCode.app）→ 安装 `zcode-theme` 启动器和 `zcode-theme.mjs` 注入器到 `~/.local/bin/` → 检查 PATH → 打印用法。

- 自定义安装目录：`ZCODE_THEME_DIR=/opt/bin curl -fsSL ... | bash`
- 本地安装（clone 后）：`bash install.sh`
- 重新安装可随时重跑，幂等。

> 注意：`~/.local/bin` 不在 PATH 时脚本会提示加入方式（`export PATH="$HOME/.local/bin:$PATH"`）。

## 快速上手

| 命令 | 作用 |
| --- | --- |
| `zcode-theme` | 启动 ZCode 并自动注入默认主题（amber） |
| `zcode-theme mint` | 启动并注入指定主题 |
| `zcode-theme inject` | 不重启，给**运行中**的实例注入主题 |
| `zcode-theme inject latte` | 同上，指定主题 |
| `zcode-theme off` | 普通模式启动（不带调试端口，不注入） |

日常用法：`zcode-theme` 一条命令搞定「启动 + 换肤」。

### 行为细节

- **快路径**：app 已在运行且调试端口已开 → 直接注入，不打扰现有会话。
- **慢路径**：app 在运行但端口未开 → 自动退出 → 带 `--remote-debugging-port=9222` 重启 → 等待端口就绪 → 注入（带 45s 重试，等首屏渲染完成）。
- **指定主题**：`zcode-theme <主题>` 与 `zcode-theme inject <主题>` 均支持；不指定时用默认 `amber`。

## 自定义配色

主题调色板在注入器文件顶部（安装位置 `~/.local/bin/zcode-theme.mjs`）：

```mjs
const DARK_AMBER = `...`    // 深色变体（Midnight Amber）
const AMBER_LIGHT = `...`   // 浅色变体（Amber Paper）
const PALETTES = { amber: {...}, latte: {...}, mint: {...} }
```

改法：复制一份主题块，改 CSS 变量值（每个变量都有注释说明用途），加进 `PALETTES` 即可注册新主题。核心变量速查：

```css
--color-background       主背景
--color-background-alt   次级背景
--color-panel/header    面板 / 头部
--color-brand/accent    品牌色 / 强调色
--color-foreground      正文
--color-border          边框
--color-terminal-*      终端配色（mint/latte 已配，amber 未配）
```

保存后无需重装：`zcode-theme inject <新主题>` 即时生效。改完建议先 `zcode-theme inject` 看效果再重启 app。

## 背景图

除了纯色主题，还可以用**本地图片做全窗口背景**（侧栏等透明区域自然透出压暗后的图片，聊天区/面板保持不透明、文字零干扰）：

```bash
ZCODE_BG_IMAGE=~/Pictures/wallpaper.jpg zcode-theme                     # 启动并带背景图
ZCODE_BG_IMAGE=~/wall.jpg ZCODE_BG_OPACITY=40 zcode-theme inject latte   # 换主题 + 调可见度
```

- **支持格式**：png / jpg / jpeg / webp / gif，单张 ≤ 10MB
- **实现方式**：图片以 base64 data URI 内嵌进注入的 CSS（不依赖 `file://` 权限），重启 app 后由启动器重新注入，自动恢复
- **压图方式**：图片与一层主题色渐变遮罩作为**分层背景贴在同一元素**上（遮罩色跟随主题，深浅色自动适配）——刻意不在子元素上叠半透明背景，因为那会卡死 Chromium 合成器（实测截图无响应、UI 渲染异常）
- **`ZCODE_BG_OPACITY`**：图片可见度 0–100（默认 60；`100` = 无遮罩全透出，`0` = 纯色回退）
- **持久生效**：把 export 写进 `~/.zshrc`，之后直接 `zcode-theme` 即可：

```bash
export ZCODE_BG_IMAGE="$HOME/Pictures/wallpaper.jpg"
export ZCODE_BG_OPACITY=60
```

- 不设置 `ZCODE_BG_IMAGE` 时行为与之前完全一致（纯色主题），两种模式随意切换

## 预览与截图

注入器直接运行（需要 app 已带调试端口启动，即先 `zcode-theme` 启动过）：

```bash
cd ~/.local/bin   # 或在任意目录用绝对路径
node zcode-theme.mjs inject mint    # 注入 mint
node zcode-theme.mjs demo  latte    # before/after 对比截图 → ./zcode-theme-demo/
node zcode-theme.mjs shot  my.png   # 注入 + 单张截图
```

环境变量：

| 变量 | 默认 | 作用 |
| --- | --- | --- |
| `ZCODE_CDP_PORT` | `9222` | CDP 调试端口（被占用时换） |
| `ZCODE_THEME` | `amber` | 注入器默认主题 |
| `ZCODE_THEME_INJECTOR` | 自动探测 | 指定注入器路径（启动器用） |
| `ZCODE_BG_IMAGE` | 无 | 背景图片路径（见「背景图」小节） |
| `ZCODE_BG_OPACITY` | `60` | 背景图可见度 0–100 |

## 工作原理

1. ZCode 以 `--remote-debugging-port=9222` 启动（Chromium 内置 DevTools 协议，未禁）。
2. 注入器通过 `http://127.0.0.1:9222/json` 找到页面 target，用 WebSocket 连上。
3. 在页面里插入 `<style id="zcode-custom-theme">`，覆盖 `html.theme-zai-dark / .theme-zai-light` 定义的 CSS 变量 —— 主题类不动，只覆盖变量值，全 UI 即时换肤。
4. 重启 app 后注入器自动重跑（快路径/慢路径），主题重新应用。

## 已知限制

- **标题栏**走独立 IPC（nativeTheme），只认 light/dark/system，CSS 覆盖不到 macOS 标题栏。
- **Dock 直接点图标启动**不会自动注入（没带调试端口）——自动换肤请用 `zcode-theme`。
- 注入期间 9222 端口对 localhost 保持监听（同一台机器的进程可连；在意的话用 `zcode-theme off` 重启一次关掉）。
- 深色变体目前三套主题共用 Midnight Amber（amber 的深色），想区分可在 `PALETTES` 里给 latte/mint 配独立深色。
- 不修改 app 安装目录 → **app 更新不影响本工具**（注入器是独立文件）。

## 卸载

```bash
rm -f ~/.local/bin/zcode-theme ~/.local/bin/zcode-theme.mjs
```

app 本身从未被修改，删除这两个文件即完全卸载。

## 常见问题

**`zcode-theme` 报端口未就绪？**
多半是旧实例没退干净或端口被别的进程占用。`ZCODE_CDP_PORT=9223 zcode-theme` 换端口重试。

**注入 45s 超时失败？**
app 首屏未就绪或已注入过旧样式。确认 app 前台已打开后重跑 `zcode-theme inject`。

**`inject` 后没变化？**
先确认当前外观设置：主题类名需是 `theme-zai-dark` / `theme-zai-light`（设置 → 外观 → 界面主题选 ZAI 系列）。若用的第三方主题类，需把选择器改成对应类名。

**终端颜色没变？**
终端是程序化配色。amber 未定义 `--color-terminal-*`（保持原样）；latte / mint 已定义完整 16 色。

**背景图没生效？**
先确认：路径和格式正确（png/jpg/jpeg/webp/gif，≤10MB）、`ZCODE_BG_IMAGE` 已 export 或写进 `~/.zshrc` 后重开终端。注入日志会打印 `背景图: <路径>（mime, 大小, 可见度）`——没这行说明 env 没传进来；有 `⚠` 警告说明文件不可读或超限。

**遮罩太重/太轻？**
`ZCODE_BG_OPACITY` 0–100 随意调：数字越大图越透，越小越接近纯色。注意图片只在侧栏等透明区域透出，聊天区/面板始终不透明（这是刻意的：半透明面板叠在背景图上会触发 Chromium 合成器卡死）。

**bash 报 `unbound variable`？**
macOS 自带 bash 3.2 对中文/全角字符紧跟变量名有解析 bug，脚本内已全部用 `${VAR}` 形式规避；如果你自己改脚本，记住变量后面接中文一律加花括号。

## License

MIT
