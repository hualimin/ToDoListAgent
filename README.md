# ToDoListAgent

移动端优先的个人效率 App：**AI 待办编排** + **元认知反思** + **主动学习路径**。

> 🚧 开发中 —— 当前阶段：**共享地基（Foundation）**。代码尚未开始，目前含设计规格与决策记录。

## 三大子系统
- **A · 待办编排**：语音/文字/照片多模态录入 → AI 整理并判紧急度 → 结合行程综合编排 → 到点多渠道提醒 → 拖拽改排 → 多状态、多粒度回顾。
- **B · 细小问题反思**：随手记录零散能力短板 → 节假日/周末提醒 → 后台自动调研（由易到难资料）→ 同类问题聚类。
- **C · 主动学习路径**：参考链接 → AI 生成学习资料与上层路径 → 每概念配由浅入深例子。

## 技术栈
- 前端：React + TypeScript + Vite + **Capacitor**（移动套壳）+ Tailwind
- 设备端：SQLite（本地优先，业务数据源）
- 后端：Python + FastAPI + APScheduler
- AI：统一 OpenAI 兼容接口，每个 Agent 功能角色可独立配置 API

## 文档
- 设计规格：[`docs/superpowers/specs/`](docs/superpowers/specs/)
- 架构决策记录：[`docs/决策记录.md`](docs/决策记录.md)
- 进度：[`docs/进度.md`](docs/进度.md)

## 🔒 隐私与开源
- **密钥只存在 `config/secrets.local.json`（已被 .gitignore 排除，绝不提交）**。
- 数据库、本地对话记录、本地配置同样不入库。
- 本地配置：`cp config/secrets.example.json config/secrets.local.json` 后填入真实值，或在 App「设置页」配置（经后端原子写入）。

## 开发流程
image2 原型图 → image2 透明素材 → codex 拆组件逐一生成 → Figma 组装（前端 → 后台）。

## 后端运行（server/）

```bash
cd server
python3 -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"

# 1) 配置密钥（首次）：复制模板并编辑填入你的 API Key / SMTP / 访问令牌
cp ../config/secrets.example.json ../config/secrets.local.json
#   编辑 ../config/secrets.local.json（已被 .gitignore 排除，绝不提交）

# 2) 数据库迁移
alembic upgrade head

# 3) 启动服务（开发模式）
DISABLE_SCHEDULER=0 uvicorn app.main:app --reload --port 8000
#   生产：去掉 --reload；默认会启动后台调度器（每 30s 扫描到期提醒并派发）
```

测试（在 `server/` 下）：`pytest -v`。

## 前端运行（app/）

```bash
cd app
npm install
npm run dev          # 浏览器开发，默认 http://localhost:5173
npm run build        # 生产构建 → dist/（供 Capacitor 打包）
npm test             # Vitest 单测
```
首次使用：打开 App「设置」页，填后端地址与访问令牌（与后端 secrets.local.json 的 access_token 一致），并可在「主题」切换 4 套皮肤。
默认主题：自然手作。原生打包（Android/iOS）：`npx cap add android` / `npx cap add ios` 后 `npx cap sync`（原生 SQLite 实现待真机阶段补全）。
