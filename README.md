<div align="center">

# 🧠 ToDoListAgent

**AI 驱动的个人效率系统** — 待办编排 · 元认知反思 · 主动学习路径

[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com)
[![Capacitor](https://img.shields.io/badge/Capacitor-8-119EFF?logo=capacitor&logoColor=white)](https://capacitorjs.com)
[![Python](https://img.shields.io/badge/Python-3.12-3776AB?logo=python&logoColor=white)](https://python.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://typescriptlang.org)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

📱 移动端优先 · 🎨 4 套主题可切换 · 🔒 密钥零泄露 · 🔌 多模型供应商

</div>

---

## ✨ 功能概览

### 📋 待办编排（子系统 A — ✅ 已完成）

| 功能 | 说明 |
|---|---|
| **多模态录入** | 📝 文字 / 🎤 语音（Web Speech API）/ 📷 照片 → AI 自动解析标题、紧急度、截止时间 |
| **智能看板** | 5 状态拖拽看板（待办/进行中/完成/搁置/延期），跨列拖拽弹确认防误操作 |
| **月历视图** | 固定格子 + 文字截断 + 年月日跳转 + 点天展开当天全部任务 |
| **AI 智能排程** | 一键排程：AI 排优先级 → 确定性零冲突算法分配时间槽（数学保证不重叠）|
| **多渠道提醒** | App 内消息 + 邮件（SMTP）+ Webhook（Bark/钉钉/飞书/企微）|
| **4 套主题** | 自然手作 · 纸本日记 · 瑞士极简 · 明快活力 — 实时切换 |

### 📚 主动学习路径（子系统 C — ✅ 已完成）

| 功能 | 说明 |
|---|---|
| **参考导入** | 粘贴 URL（后端抓取正文）+ 文字补充 |
| **AI 生成路径** | 结构化学习路径：概念列表，每个含解释 + 由浅入深 3 层例子（入门/进阶/实战）|
| **自定义调研** | 每条路径可选默认 deep-research 模式 或 自定义提示词 |
| **进度追踪** | 每个概念可标记 待学/学习中/已学 |

### 🔧 供应商管理（✅ 已完成）

- 统一配置多家模型供应商（智谱 / DeepSeek / OpenAI / MiniMax / Anthropic…）
- 配一次 API Key → 各功能（解析/排程/学习路径）下拉选模型
- 内置「检测可用模型」+「测试连接」

### 🧠 细小问题反思（子系统 B — 🚧 规划中）

随手记录能力短板 → 节假日提醒 → 后台自动调研 → 同类聚类归并

---

## 🏗️ 架构

```
┌─────────────────────────────┐         ┌──────────────────────────────┐
│        手机 App (Capacitor)   │         │         后端服务 (FastAPI)     │
│                              │  HTTP   │                              │
│  React 19 + TypeScript       │ ◄─────► │  AI 解析 · 智能排程 · 自动调研  │
│  Tailwind + 4 主题           │         │  定时提醒 · 邮件 · Webhook     │
│  本地 SQLite（离线优先）       │         │  APScheduler · SQLAlchemy     │
│  dnd-kit 拖拽                 │         │                              │
└─────────────────────────────┘         └──────────────┬───────────────┘
                                                         │
                                          ┌──────────────▼───────────────┐
                                          │    大模型 API（OpenAI 兼容）    │
                                          │  智谱 / DeepSeek / OpenAI...   │
                                          └──────────────────────────────┘
```

**本地优先**：业务数据存在设备端 SQLite，离线可用。后端只存提醒队列 + 调研结果 + 密钥配置。

---

## 🚀 快速开始

### 后端

```bash
cd server
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# 配置（首次）：在 App 设置页配置，或手动编辑
cp ../config/secrets.example.json ../config/secrets.local.json
# 编辑 secrets.local.json：设 access_token + 配置 providers（API Key）

alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

### 前端

```bash
cd app
npm install
npm run dev          # → http://localhost:5173
```

打开 App → **设置** → 填后端地址（`http://localhost:8000`）+ 访问令牌 → 配置模型供应商 → 开始使用。

### 原生打包

```bash
cd app
npm run build
npx cap add android   # 或 ios
npx cap sync
npx cap open android  # 在 Android Studio 中构建 APK
```

---

## 🎨 主题预览

| 自然手作（默认）| 纸本日记 | 瑞士极简 | 明快活力 |
|---|---|---|---|
| 鼠尾草绿 + 陶土 | 暖纸 + 朱砂印章 | 网格 + 黑白蓝 | 暖底 + 渐变多彩 |

→ [在线预览 4 套主题](docs/prototypes/index.html)

---

## 🔒 隐私设计

- **密钥绝不入库**：API Key 只存 `config/secrets.local.json`（`.gitignore` 排除），数据库零密钥
- **开源可剥离**：删除 `secrets.local.json` + `server/data/*.db` → 仓库零敏感信息（有测试保证）
- **本地优先**：任务数据存设备端，后端不持有全量副本

---

## 🧪 测试

```bash
# 后端（59 个测试）
cd server && pytest -v

# 前端（62 个测试）
cd app && npm test
```

---

## 🛠️ 技术栈

| 层 | 技术 |
|---|---|
| **前端** | React 19 · TypeScript 6 · Vite 8 · Tailwind CSS 3 · dnd-kit · Zustand · React Router |
| **移动** | Capacitor 8（Android/iOS 套壳）· @capacitor-community/sqlite |
| **后端** | Python 3.12 · FastAPI · SQLAlchemy 2 · APScheduler · Alembic |
| **AI** | OpenAI 兼容接口（智谱/DeepSeek/OpenAI/MiniMax 等）· 多模态 vision |
| **测试** | Vitest + Testing Library（前端）· pytest（后端）|

---

## 📁 项目结构

```
ToDoListAgent/
├── app/                    # 前端 React + Capacitor
│   ├── src/
│   │   ├── components/     # UI 组件（看板/月历/列表/详情/输入栏...）
│   │   ├── pages/          # 待办/反思/学习/设置
│   │   ├── store/          # Zustand 状态管理
│   │   ├── themes/         # 4 套主题 token + CSS 变量
│   │   └── lib/            # 工具函数（视图/排序/图片压缩...）
│   └── capacitor.config.ts
├── server/                 # 后端 FastAPI
│   ├── app/
│   │   ├── routers/        # API 路由（config/tasks/reminders/learning...）
│   │   ├── agent_registry.py   # AI 调用（OpenAI 兼容 + 多模态）
│   │   ├── arrange_slots.py    # 零冲突排程算法
│   │   ├── scheduler.py        # 定时提醒调度
│   │   └── notifications.py    # 邮件/Webhook/App内派发
│   └── tests/
├── config/                 # 密钥配置（secrets.local.json 被 gitignore）
├── docs/
│   ├── superpowers/specs/  # 设计规格
│   ├── superpowers/plans/  # 实现计划
│   ├── prototypes/         # 主题原型 + 交互 demo
│   ├── 决策记录.md          # 架构决策记录（ADR）
│   └── 进度.md              # 项目进度
└── 对话记录/               # 全量开发对话记录（gitignore）
```

---

## 📝 开发流程

```
image2 原型图 → image2 透明素材 → codex 拆组件 → Figma 组装 → 前端 → 后端
```

TDD 驱动：每个功能先写测试 → 实现 → 审查 → 提交。子代理串行执行 + 两阶段代码审查。

---

## 📊 项目状态

| 模块 | 状态 |
|---|---|
| ✅ 共享地基（后端 + 前端 + 主题系统） | 完成 |
| ✅ 子系统 A（多模态录入 + 看板 + 智能编排） | 完成 |
| ✅ 子系统 C（主动学习路径） | 完成 |
| ✅ 供应商管理（多模型 + 功能分配） | 完成 |
| 🚧 子系统 B（细小问题反思 + 聚类） | 规划中 |
| ⬜ 历史可视化（月历热力 / 年趋势） | 待启动 |
| ⬜ 原生 SQLite 实现 | 真机阶段 |

---

## 📄 License

MIT
