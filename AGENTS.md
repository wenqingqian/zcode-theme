# zcode-theme

## 项目背景

ZCode 桌面应用（Electron）主题注入工具：通过 CDP 远程调试向渲染进程注入 CSS 变量覆盖实现自定义换肤，提供一键安装、启动器自动注入与多主题切换（amber / latte / mint，各含深浅变体）。

## 实验环境

macOS（darwin arm64）+ Node ≥ 22（内置 fetch/WebSocket，零 npm 依赖）；目标应用 ZCode 桌面版（/Applications/ZCode.app）；详情见 AGENTSPACE/tests.md

## 关键代码仓库

- `~/Documents/mytest/zcode-theme`（GitHub: wenqingqian/zcode-theme，公开）— 本仓库即全部代码：
  - `zcode-theme.mjs` — Node 注入器（核心）：`inject` / `demo` / `shot` 三种模式，CDP WebSocket 注入 CSS 变量
  - `zcode-theme` — bash 启动器：启动 ZCode 并自动注入（快/慢路径），`inject` / `off` 子命令
  - `install.sh` — 一键安装脚本（支持 `curl | bash` 管道）
  - `README.md` — 完整使用说明

## AGENTSPACE

本项目的实验与迭代状态由 `AGENTSPACE/` 管理(独立 git 仓库): plan(任务计划)、iterations(代码变更迭代)、utils(复用工具)、tests(环境与测试)、notes(知识)。

### 何时读取 AGENTSPACE/AGENTS.md

对话涉及本项目的**实验、代码改动、项目迭代或状态查询/变更**时 → 先读 `AGENTSPACE/AGENTS.md` 并按其规则工作(它会引导你读取 tests.md、iterations.md 等入口文件)。

### 何时不必读取

与本项目无关的问答、闲聊、无状态变化的纯查询, 且用户未明确要求使用 AGENTSPACE 时。

### 硬规则

- AGENTSPACE 初始化只通过显式 `/init-agentspace` 命令, 绝不自动创建
- AGENTSPACE 的索引/条目状态(plan.md、iterations.md、两个 index.md)只能由 `AGENTSPACE/scripts/` 下的脚本改写
- 禁止读取插件开发数据: `skills/agentspace-update/versions/`、`DEVELOPMENT.md`、`marketplace.json` 等与项目无关, 不在 AGENTSPACE 管理范围内
