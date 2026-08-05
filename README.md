# zcode-theme

ZCode 桌面应用（Electron）**主题注入工具**：通过 CDP 远程调试向渲染进程注入 CSS 变量覆盖，实现自定义换肤。无需修改安装目录、无需签名重打包。

内置 **6 套主题**，按名字一条命令注入，图片与纯色同一接口——不用关心背后是图还是色：

| 主题 | 浅色变体 | 深色变体 | 说明 |
| --- | --- | --- | --- |
| `amber` | Amber Paper（暖纸） | Midnight Amber | 纯色 |
| `latte` | Catppuccin Latte（奶油蓝） | Catppuccin Mocha | 纯色 |
| `mint` | Mint Tea（薄荷绿） | Midnight Mint（深青黑） | 纯色 |
| `sea` | Catppuccin Latte | Catppuccin Mocha | **内置暗蓝海面壁纸** |
| `mist` | Mint Tea | Midnight Mint | **内置雾山壁纸** |
| `castle` | Castle Stone（石堡米灰） | Demon Castle（暗夜漆黑 + 绯红地狱火） | **内置像素恶魔城堡大厅壁纸** |

所有主题均含浅色 + 深色变体，跟随 app 外观设置自动切换；壁纸主题的图片在侧栏等透明区域自然透出（聊天区罩浓遮罩保文字可读）。壁纸来源：`sea`/`mist` 来自 [picsum.photos](https://picsum.photos)（id/1019 海面、id/1018 雾山，Unsplash 源图）；`castle` 由 [ansimuz](https://opengameart.org/users/ansimuz) 的哥特教堂像素素材（Gothicvania 系列，公有领域 / public domain）拼合重制——彩窗、骷髅柱、祭坛、石像鬼、烛火大厅。均已重编码为基线 JPEG 随仓库分发。

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

脚本会做：环境预检（macOS / Node ≥ 22 / ZCode.app）→ 安装 `zcode-theme` 启动器、`zcode-theme.mjs` 注入器和 `wallpapers/` 内置壁纸到 `~/.local/bin/` → 检查 PATH → 打印用法。

- 自定义安装目录：`ZCODE_THEME_DIR=/opt/bin curl -fsSL ... | bash`
- 本地安装（clone 后）：`bash install.sh`
- 重新安装可随时重跑，幂等。

> 注意：`~/.local/bin` 不在 PATH 时脚本会提示加入方式（`export PATH="$HOME/.local/bin:$PATH"`）。

## 快速上手

```bash
zcode-theme             # 启动 ZCode 并按记忆注入（首次默认 amber，之后记住你的选择）
zcode-theme sea         # 启动并把浅色+深色外观都设为 sea
zcode-theme inject      # 不重启，给运行中的实例按记忆注入
zcode-theme inject mist # 同上，指定主题
zcode-theme off         # 普通模式启动（不带调试端口，不注入）
```

**选择会被记住**：每次显式指定主题都写入 `~/.config/zcode-theme/config.json`，之后裸 `zcode-theme` / `zcode-theme inject` 自动复用——不需要 export 任何环境变量。

### 浅色 / 深色外观槽位

app 的浅色、深色外观各有一份配置（两个「槽位」）。不带 flag 时两个槽位一起设；带 `--light` / `--dark` 时只设对应槽位，另一个保持原配置：

```bash
zcode-theme sea            # light 槽 = sea, dark 槽 = sea（两个外观都是 sea）
zcode-theme mist --light   # 只把浅色外观设为 mist；深色外观保持原配置
zcode-theme mint --dark    # 只把深色外观设为 mint
```

这样两个外观可以用不同主题，比如浅色用 `sea`（Latte + 海面壁纸）、深色用 `mint`（纯色深青黑）：切外观时配色和壁纸各自跟随——**槽位没有壁纸时，切到该外观壁纸自然消失**。

flag 可加在 `zcode-theme` / `inject` 命令的任意位置；也可用环境变量 `ZCODE_VARIANT=light|dark`（flag 优先）。

> **语义变更说明**：早期版本的 `--light/--dark` 是「强制该变体铺满两种外观」；自槽位模型起改为「选择只设置哪个外观槽位」。想两个外观同色 = 不带 flag。

### 行为细节

- **快路径**：app 已在运行且调试端口已开 → 直接注入，不打扰现有会话。
- **慢路径**：app 在运行但端口未开 → 自动退出 → 带 `--remote-debugging-port=9222` 重启 → 等待端口就绪 → 注入（带 45s 重试，等首屏渲染完成）。
- **持久化规则**：只有「位置参数显式指定主题 + inject」会写配置文件；`demo`/`shot` 模式和所有环境变量都是一次性试用，不动配置。

## 自定义配色

主题注册表在注入器文件顶部（安装位置 `~/.local/bin/zcode-theme.mjs`）：

```mjs
const DARK_AMBER = `...`    // 深色变体（Midnight Amber）
const AMBER_LIGHT = `...`   // 浅色变体（Amber Paper）
const THEMES = { amber: {...}, latte: {...}, mint: {...}, sea: {...}, mist: {...}, castle: {...} }
```

改法：复制一份主题块，改 CSS 变量值（每个变量都有注释说明用途），加进 `THEMES` 即可注册新主题。核心变量速查：

```css
--color-background       主背景
--color-background-alt   次级背景
--color-panel/header    面板 / 头部
--color-brand/accent    品牌色 / 强调色
--color-foreground      正文
--color-border          边框
--color-terminal-*      终端配色（各主题均已配完整 16 色）
```

保存后无需重装：`zcode-theme inject <新主题>` 即时生效。

## 高级：一次性自定义图片（env 覆盖）

内置壁纸主题（`sea`/`mist`/`castle`）覆盖了日常使用；想临时试一张自己的图，用环境变量做**一次性全局覆盖**（叠加在两个槽位之上，不写配置文件）：

```bash
ZCODE_BG_IMAGE=~/Pictures/wallpaper.jpg zcode-theme inject   # 本次注入用这张图
ZCODE_BG_IMAGE=~/wall.jpg ZCODE_BG_OPACITY=40 zcode-theme    # 可见度调到 40%
```

- **支持格式**：png / jpg / jpeg / webp / gif，单张 ≤ 10MB。**建议用基线（baseline）JPEG**：个别渐进式（progressive）JPEG 位流会卡死 Chromium 合成器（实测截图无响应），内置壁纸已全部重编码为基线
- **实现方式**：图片以 base64 data URI 内嵌进注入的 CSS（不依赖 `file://` 权限）
- **壁纸结构**：主壳与聊天区/面板**各自**携带「渐变遮罩 + 图片」的分层背景（每个元素自身不透明），遮罩色跟随主题、深浅色自动适配——刻意不让半透明元素叠在背景图上、也不用 `background-attachment: fixed` 对齐面板，这两种结构都会卡死 Chromium 合成器。因此面板与壳的贴图不对齐，但浓遮罩下接缝不可见（默认 92%；暗色壁纸主题可下调——castle 用 82%，图本身暗、文字依旧可读）
- **`ZCODE_BG_OPACITY`**：图片可见度 0–100（默认 60），只控制主壳遮罩；聊天区/面板遮罩固定 ≥92% 保可读性（内置主题可各自指定更薄的下限，见上）
- 下一次不带 env 的注入即恢复配置中的主题——这就是「一次性」的含义

## 预览与截图

注入器直接运行（需要 app 已带调试端口启动，即先 `zcode-theme` 启动过）：

```bash
cd ~/.local/bin   # 或在任意目录用绝对路径
node zcode-theme.mjs inject mint    # 注入 mint（会写配置）
node zcode-theme.mjs demo  latte    # before/after 对比截图 → ./zcode-theme-demo/（不写配置）
node zcode-theme.mjs shot  my.png   # 注入 + 单张截图（不写配置）
```

环境变量（全部为一次性覆盖，不写配置；日常无需设置）：

| 变量 | 默认 | 作用 |
| --- | --- | --- |
| `ZCODE_CDP_PORT` | `9222` | CDP 调试端口（被占用时换） |
| `ZCODE_THEME` | 无 | 一次性指定主题名（无位置参数时生效，优先级低于位置参数、高于配置文件） |
| `ZCODE_VARIANT` | `auto` | 一次性槽位选择：`light` / `dark`（`--light`/`--dark` flag 优先） |
| `ZCODE_THEME_INJECTOR` | 自动探测 | 指定注入器路径（启动器用） |
| `ZCODE_BG_IMAGE` | 无 | 一次性自定义背景图（见「高级」小节） |
| `ZCODE_BG_OPACITY` | `60` | 背景图可见度 0–100 |

## 工作原理

1. ZCode 以 `--remote-debugging-port=9222` 启动（Chromium 内置 DevTools 协议，未禁）。
2. 注入器通过 `http://127.0.0.1:9222/json` 找到页面 target，用 WebSocket 连上。
3. 在页面里插入 `<style id="zcode-custom-theme">`，按外观类（`html.theme-zai-dark` / `.theme-zai-light`）分别注入两个槽位的配色与壁纸规则——主题类不动，只覆盖变量值，全 UI 即时换肤，切外观即时跟随。
4. 重启 app 后注入器按配置文件自动重跑（快路径/慢路径），主题重新应用。

## 已知限制

- **标题栏**走独立 IPC（nativeTheme），只认 light/dark/system，CSS 覆盖不到 macOS 标题栏。
- **Dock 直接点图标启动**不会自动注入（没带调试端口）——自动换肤请用 `zcode-theme`。
- 注入期间 9222 端口对 localhost 保持监听（同一台机器的进程可连；在意的话用 `zcode-theme off` 重启一次关掉）。
- 不修改 app 安装目录 → **app 更新不影响本工具**（注入器是独立文件）。

## 卸载

```bash
rm -rf ~/.local/bin/zcode-theme ~/.local/bin/zcode-theme.mjs ~/.local/bin/wallpapers
rm -rf ~/.config/zcode-theme   # 主题选择记录（可选）
```

app 本身从未被修改，删除这些文件即完全卸载。

## 常见问题

**`zcode-theme` 报端口未就绪？**
多半是旧实例没退干净或端口被别的进程占用。`ZCODE_CDP_PORT=9223 zcode-theme` 换端口重试。

**注入 45s 超时失败？**
app 首屏未就绪或已注入过旧样式。确认 app 前台已打开后重跑 `zcode-theme inject`。

**`inject` 后没变化？**
先确认当前外观设置：主题类名需是 `theme-zai-dark` / `theme-zai-light`（设置 → 外观 → 界面主题选 ZAI 系列）。若用的第三方主题类，需把选择器改成对应类名。

**终端颜色没变？**
终端是程序化配色，各主题的深浅变体都已定义完整 16 色；若你的终端区域来自其他变量，可在调色板里自行增补。

**壁纸只在一种外观下出现？**
这是槽位语义：壁纸跟随设置了壁纸主题的那个外观槽位。比如 `zcode-theme mist --light` 只设了浅色槽，切到深色外观（假设深色槽是无图的 `mint`）壁纸自然消失。想两种外观都有壁纸：`zcode-theme mist`（不带 flag 设双槽）。

**自定义背景图没生效？**
确认：路径和格式正确（png/jpg/jpeg/webp/gif，≤10MB）、`ZCODE_BG_IMAGE` 与命令在同一行（env 是一次性的，export 后另开终端才持续）。注入日志会打印 `壁纸[全局覆盖]: <路径>（…不写配置）`——没这行说明 env 没传进来；有 `⚠` 警告说明文件不可读或超限。

**遮罩太重/太轻？**
内置壁纸主题壳可见度固化 60%（castle 为 75%）；自定义图可用 `ZCODE_BG_OPACITY` 0–100 调：数字越大侧栏透出的图越清晰，越小越接近纯色。聊天区/面板的遮罩默认固定 ≥92%（保文字可读），castle 主题因图本身很暗、下限放宽到 82%——这是刻意的：半透明面板叠在背景图上（或用 `fixed` 对齐贴图）会触发 Chromium 合成器卡死。

**bash 报 `unbound variable`？**
macOS 自带 bash 3.2 对中文/全角字符紧跟变量名有解析 bug，脚本内已全部用 `${VAR}` 形式规避；如果你自己改脚本，记住变量后面接中文一律加花括号。

## License

MIT
