#!/bin/bash
# zcode-theme 一键安装脚本
#
# 用法:
#   网络安装:   curl -fsSL https://raw.githubusercontent.com/wenqingqian/zcode-theme/main/install.sh | bash
#   本地安装:   bash install.sh        (在仓库目录内)
#   自定义目录: ZCODE_THEME_DIR=/opt/bin bash install.sh
#
# 安装内容 (~/.local/bin/ 或自定义目录):
#   zcode-theme      启动器命令 (zcode-theme / inject / off)
#   zcode-theme.mjs  Node 注入器 (内置三套主题: amber / latte / mint)
#
# 卸载: rm -f "$ZCODE_THEME_DIR/zcode-theme" "$ZCODE_THEME_DIR/zcode-theme.mjs"
set -u

# 网络安装时通过此地址拉取文件; 本地安装时优先复制脚本同目录的文件
REPO_RAW="https://raw.githubusercontent.com/wenqingqian/zcode-theme/main"
INSTALL_DIR="${ZCODE_THEME_DIR:-$HOME/.local/bin}"

# ---------- 环境预检 ----------
if [ "$(uname -s)" != "Darwin" ]; then
  echo "✗ zcode-theme 目前仅支持 macOS（目标应用是 ZCode.app）" >&2
  exit 1
fi

if [ ! -d "/Applications/ZCode.app" ]; then
  echo "✗ 未找到 /Applications/ZCode.app，请先安装 ZCode 桌面应用" >&2
  exit 1
fi

if ! command -v node >/dev/null 2>&1; then
  echo "✗ 未找到 node，请先安装 Node.js ≥ 22（https://nodejs.org）" >&2
  exit 1
fi
NODE_MAJOR="$(node -v | sed 's/^v//' | cut -d. -f1)"
if [ "$NODE_MAJOR" -lt 22 ]; then
  echo "✗ Node 版本过低: $(node -v)（注入器依赖 Node ≥ 22 的内置 WebSocket）" >&2
  echo "  建议: brew install node 或从 https://nodejs.org 安装 LTS" >&2
  exit 1
fi

# ---------- 安装 ----------
mkdir -p "$INSTALL_DIR"

fetch() {
  local name="$1" src=""
  if [ -f "$(dirname "$0")/$name" ]; then
    src="$(dirname "$0")/$name"     # 本地安装: 复制同目录文件
  else
    src="${REPO_RAW}/$name"         # 管道安装: 从 GitHub 下载
  fi
  if [ -f "$src" ]; then
    cp "$src" "$INSTALL_DIR/$name"
  else
    curl -fsSL "$src" -o "$INSTALL_DIR/$name" || {
      echo "✗ 下载 ${name} 失败: ${src}" >&2
      exit 1
    }
  fi
  chmod +x "$INSTALL_DIR/$name"
  echo "  ✓ ${INSTALL_DIR}/${name}"
}

echo "== 安装到 ${INSTALL_DIR} =="
fetch zcode-theme
fetch zcode-theme.mjs

# ---------- PATH 检查 ----------
case ":$PATH:" in
  *":${INSTALL_DIR}:"*) : ;;
  *) echo "⚠  ${INSTALL_DIR} 不在 PATH 中，请把它加进去（~/.zshrc 或 ~/.bash_profile）:"; echo "     echo 'export PATH=\"${INSTALL_DIR}:\$PATH\"' >> ~/.zshrc" ;;
esac

# ---------- 完成提示 ----------
echo ""
echo "== 安装完成 =="
echo "启动并自动换肤:          zcode-theme"
echo "指定主题启动:            zcode-theme mint"
echo "注入运行中的实例:        zcode-theme inject latte"
echo "普通模式启动(不注入):    zcode-theme off"
echo ""
echo "可用主题: amber（暖琥珀）/ latte（奶油蓝）/ mint（薄荷绿），均含深浅变体"
echo "自定义配色: 编辑 ${INSTALL_DIR}/zcode-theme.mjs 顶部主题常量即可"
