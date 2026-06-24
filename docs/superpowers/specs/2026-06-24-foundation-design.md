# 共享地基 设计规格（Foundation）

- **日期**：2026-06-24
- **状态**：已与用户确认，待规格复核后进入实现计划
- **作者**：Claude（与用户共同 brainstorm）
- **关联**：[../../决策记录.md](../../决策记录.md)、[../../进度.md](../../进度.md)

---

## 1. 背景与目标

用户需要一个**移动端优先**的个人效率 App，解决三大场景：

1. **待办/任务编排（子系统 A）**：语音/文字/照片多模态快速录入 → AI 整理并判紧急度 → 结合行程综合编排 → 到点多渠道提醒 → 可拖拽改排 → 多状态、多粒度回顾。
2. **元认知·细小问题反思（子系统 B）**：随手记录零散能力短板小问题 → 节假日/周末提醒 → 后台自动调研产出"由易到难"资料 → 同类问题聚类归并。
3. **元认知·主动学习路径（子系统 C）**：针对某学科提供参考链接 → AI 结合参考+延伸生成学习资料 → 汇总成上层学习路径 → 每概念配由浅入深例子。

**本规格只覆盖「共享地基」**——三个子系统共同依赖的平台底座：移动端外壳、后端骨架、核心数据模型、密钥/Agent 配置层、通知调度框架、本地↔后端同步框架。地基刻意保持精简，按"待办"的真实需求设计抽象，避免过度预判 B/C。

### 1.1 既定约束（用户预先设定）

- **开发流程**：image2 生成原型图 → image2 透明素材 → codex 拆组件逐一生成 → Figma 组装（前端 → 后台）。
- **隐私/开源**：API Key 与个人信息必须可从代码仓剥离；前端配置 → 后端读取并落盘到"可见项目文件夹"下的配置文件。
- **关键节点记录**：重大决策与里程碑必须建目录/文件记录，防长上下文压缩后遗忘核心。
- **测试**：复用现有 skill（TDD / systematic-debugging / webapp-testing 等）降低 bug。
- **UI 参考**：知乎《移动端 UI 设计》相关文章（https://zhuanlan.zhihu.com/p/466178241 ）。
- **全量对话记录**：每轮对话由 Stop hook 增量写入 `对话记录/对话记录.md`，原始不提炼。

## 2. 范围

### 2.1 本规格包含（In Scope）

- Capacitor + React/TS 前端外壳，三模块导航占位页。
- 设备端 SQLite 业务数据层（tasks 表 + 通用同步/user_id 约定）。
- FastAPI 后端骨架：健康检查、配置读写、Agent 注册桩、提醒入队与派发、调度器。
- 本地优先的定向同步框架。
- 密钥/配置"可剥离"机制（`config/secrets.local.json` + 模板 + .gitignore）。
- 单用户认证（预留 user_id）。
- 通知调度（邮件 + Webhook + App 内消息）。
- 项目目录骨架、决策记录、进度跟踪。

### 2.2 本规格不包含（Out of Scope）

- 子系统 A 的完整业务：拖拽看板、日/周/月/年视图、AI 智能编排算法、多模态录入的真实 AI 实现（地基只提供桩与框架）。
- 子系统 B/C 的业务逻辑（地基只留表壳与 Agent 角色位）。
- 真·系统级移动推送（FCM/APNs）——作为增强项，MVP 不做。
- 多用户注册/登录/配额（仅预留 user_id 字段）。

## 3. 关键架构决策（摘要，详见决策记录.md）

| # | 决策 | 选择 |
|---|---|---|
| ADR-001 | 构建顺序 | 共享地基 → 子系统 A → B → C |
| ADR-002 | APP 形态 | Web 技术栈 + Capacitor/Tauri 套壳 |
| ADR-003 | 用户/部署模型 | 单用户 MVP，数据模型预留 user_id |
| ADR-004 | 后端技术栈 | Python + FastAPI |
| ADR-005 | 数据架构 | 本地优先（设备端 SQLite 为业务数据源） |
| ADR-006 | 后端存储 | SQLite 单文件，未来可切 Postgres |
| ADR-007 | 通知渠道(MVP) | 邮件 + App内消息 + Webhook |
| ADR-008 | 密钥存放 | 只存 `config/secrets.local.json`，绝不进 DB |
| ADR-009 | AI 接口 | 统一 OpenAI 兼容（base_url+key+model） |

## 4. 技术栈

| 层 | 选型 | 备注 |
|---|---|---|
| 前端框架 | React 18 + TypeScript + Vite | 契合 figma/codex 组件工作流 |
| 移动套壳 | Capacitor（iOS/Android/桌面） | 拿到系统级能力：语音、后台、相册 |
| 样式 | Tailwind CSS | 与用户全局 UI skill 一致 |
| 设备端存储 | `@capacitor-community/sqlite` | 业务数据源，离线可用 |
| 前端状态 | Zustand（建议） | 轻量 |
| 后端框架 | Python 3.11 + FastAPI + Uvicorn | |
| ORM/迁移 | SQLAlchemy 2.0 + Alembic | SQLite 默认，Postgres 可切 |
| 调度 | APScheduler（AsyncIO） | 到点触发提醒/调研 |
| HTTP 客户端 | httpx | 调 LLM、发 Webhook |
| 邮件 | aiosmtplib | 异步发件 |
| 测试 | pytest（后端）/ Playwright（前端，后续） | TDD |

## 5. 整体架构

```
┌─────────── 手机端 (Capacitor + React/TS) ──────────────┐
│  UI 外壳：待办 / 反思 / 学习 三模块导航（占位页）         │
│  本地 SQLite = 业务数据源(tasks/reflections/learning)    │
│  离线录入 → 连网时"定向同步"                              │
└─────────────────┬──────────────────────────────────────┘
          REST/JSON │ ① 有提醒的任务↑   ② 调研结果↓
┌──────────────────▼▼───────────────────────────────────┐
│         后端 (FastAPI) —— "工人"，无业务数据源            │
│  提醒调度(APScheduler) │ Agent/调研执行 │ 配置密钥读取     │
│  后端SQLite: reminder_queue / research_* / users(预留)   │
└───────┬───────────────────────────┬────────────────────┘
   SMTP 邮件                  调用 LLM（各厂商，密钥在 config 文件）
        │ Webhook
        ▼
   邮箱 / 第三方推送（Bark/钉钉/飞书/企微）
```

**核心约束**：后端**绝不存业务数据**，也**绝不把密钥写进数据库**。这是开源可剥离的根本。

## 6. 目录结构

```
ToDoListAgent/
├─ app/                     # 前端 React+TS+Capacitor
├─ server/                  # 后端 FastAPI
│  └─ data/                 # 后端 SQLite 落地 (gitignored)
├─ config/                  # ← "可见的项目文件夹"
│  ├─ secrets.example.json  # 提交的模板（占位符）
│  └─ secrets.local.json    # 真实密钥 (gitignored，可剥离)
├─ docs/
│  ├─ superpowers/specs/    # 设计规格
│  ├─ 决策记录.md            # ADR：所有架构决策
│  └─ 进度.md                # 里程碑/任务进度
├─ 对话记录/                 # 全量对话 (gitignored)
└─ .gitignore
```

## 7. 核心数据模型

> 所有表均预留 `user_id`（MVP 固定 = 1），为多用户平滑升级。

### 7.1 设备端 SQLite（业务数据源）

**tasks**
| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT(PK) | 客户端生成 UUID |
| user_id | INTEGER | 预留，默认 1 |
| title | TEXT | 标题 |
| content | TEXT | 详情（可含照片引用、语音转写） |
| input_source | TEXT | voice / text / photo |
| urgency | TEXT | low/normal/high/urgent（AI 填，可手改） |
| status | TEXT | todo/doing/done/shelved/delayed |
| due_at | TIMESTAMP | 截止 |
| scheduled_at | TIMESTAMP | 建议完成时间 |
| board_order | REAL | 看板排序（子系统 A 用） |
| created_at / updated_at | TIMESTAMP | |
| deleted_at | TIMESTAMP | 软删 |
| sync_state | TEXT | clean / pending_up / pending_down |

> reflections / learning 表在 B、C 规格里新增；地基只定好同步框架与 user_id 约定。

### 7.2 后端 SQLite（工人状态）

**reminder_queue**
| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER(PK) | |
| user_id | INTEGER | 预留 |
| task_ref | TEXT | 客户端 task.id（幂等键） |
| fire_at | TIMESTAMP | 触发时间 |
| channels | JSON | ["email","webhook","inapp"] 子集 |
| status | TEXT | pending/firing/fired/failed/dead |
| payload | JSON | 提醒内容快照 |
| attempts | INTEGER | 重试计数 |
| last_error | TEXT | |

**research_jobs / research_results**（B/C 用，地基留表壳，可为空表）

**inapp_notifications**（App 内消息）
| 字段 | 类型 | 说明 |
|---|---|---|
| id | INTEGER(PK) | |
| user_id | INTEGER | 预留 |
| reminder_id | INTEGER | 关联 reminder_queue（可空） |
| title / body | TEXT | |
| created_at | TIMESTAMP | |
| read_at | TIMESTAMP | 客户端拉取/已读后回写 |

**users**（预留，MVP 仅 user_id=1 一行）

> 注意：agent 配置、SMTP、webhook 等**敏感配置一律不进 DB**，见第 9 节。

## 8. 密钥/配置的"可剥离"方案（硬需求）

- **密钥只存在于 `config/secrets.local.json`**，结构见 `config/secrets.example.json`，含：
  - `agents`：每个 Agent 功能角色的 `{provider, base_url, model, api_key}`；
  - `notifications`：`{smtp{...}, webhooks:[...]}`；
  - `auth`：主访问令牌。
- App 内"设置页"编辑 → `POST /api/config` → 后端**原子写入**该文件；调用 AI / 发通知时再读取。
- **数据库永不出现密钥**；日志永不打印密钥。
- 开源剥离 = 删除 `config/secrets.local.json` 与 `server/data/*.db`，仓库即零敏感信息。
- `.gitignore` 排除 `config/secrets.local.json`、`server/data/`、`对话记录/`。

## 9. AI/Agent 配置层（每功能可独立配 API）

- 定义 Agent **功能角色**（地基提供注册框架 + 桩，真实实现在各子系统）：
  - `task_parse`：多模态录入解析（语音/照片 → 结构化待办）—— 子系统 A
  - `urgency_rank`：紧急度判定 —— 子系统 A
  - `schedule_arrange`：综合编排 —— 子系统 A
  - `researcher`：自动调研 —— 子系统 B/C
  - `cluster`：同类问题聚类 —— 子系统 B
  - `learning_path_gen`：学习路径生成 —— 子系统 C
- 统一走 **OpenAI 兼容接口**（base_url + api_key + model），覆盖 OpenAI/Claude/DeepSeek/智谱/通义/Kimi 等绝大多数厂商。
- `agent_registry`：`function_name → call(input)`，按 `secrets.local.json` 中该功能的配置路由。
- **优雅降级**：某功能未配置或调用失败 → 退回手动/默认，绝不阻塞任务保存。

## 10. 定向同步机制（非全量复制，故简单）

- **上行**：仅"带提醒的任务"（`due_at`/`scheduled_at` 非空）→ 客户端 POST 提醒意图到后端 → 后端按 `task_ref` 幂等 upsert 进 `reminder_queue`；本地删/改 → 同步删/改对应队列项。
- **下行**：仅"调研结果"（B/C）→ App 拉取写入本地。
- **触发**：App 启动、恢复联网、手动刷新、本地写入带提醒任务之后。
- **冲突**：单用户 → 以 `updated_at` 最后写入胜出；`reminder_queue` 以 `task_ref` 幂等，天然无冲突。
- 业务数据的"源"始终在设备端；后端不持有 tasks 全量副本。

## 11. 通知调度

- APScheduler（进程内 AsyncIO 调度）扫描到点 `reminder_queue` 项 → 派发：
  - **邮件**：aiosmtplib，SMTP 凭据来自 `secrets.local.json`；
  - **Webhook**：httpx POST 到用户配置的 Bark/钉钉/飞书/企微 URL；
  - **App 内消息**：写入后端通知表，客户端启动时拉取。
- **可靠性**：失败退避重试 + 死信（`status=dead`），**幂等派发**（按 reminder_id + 渠道去重，不重发）。
- **MVP 限制（须明确告知）**：无 FCM/APNs；App 关闭时**靠邮件/Webhook 保底送达**；App 内消息需打开 App 才见。真·系统推送列为增强项。

## 12. 认证（单用户）

- 首次运行设置主令牌，写入 `secrets.local.json.auth`。
- 后端 API 以 Bearer Token 守卫；`user_id=1` 固定。
- 设备端可选 PIN / 生物锁（Capacitor 组件），保护本地数据。

## 13. 错误处理

- **任务先落本地，AI 增强 异步**：录入即存本地，AI 解析/紧急度失败不影响保存，标记待重试。
- 调度失败可重试、可观测（`attempts`/`last_error`）。
- 同步失败：本地 `sync_state` 保留 `pending_up`，下次重试，不丢数据。
- AI 调用：超时/限流/鉴权失败 → 优雅降级 + 日志（不含密钥）。

## 14. 测试策略

- 后端：pytest，TDD（superpowers:test-driven-development）；覆盖 config 读写、reminder 入队/派发幂等、调度、同步 upsert、agent 桩降级。
- 调试：superpowers:systematic-debugging 处理 bug。
- 前端：后续 Playwright（webapp-testing skill）；本地 SQLite 操作单测。
- 关键不变量用测试钉住：**密钥不入 DB、开源剥离后仓库零敏感信息**。

## 15. 地基"完成"验收标准

- [ ] Capacitor App 在手机与浏览器均能启动，三模块导航占位页可切换。
- [ ] 设备端 SQLite 初始化 tasks 表（含 user_id），离线可增删改查任务。
- [ ] 后端 FastAPI 启动：`/health`、`/api/config` 读写、agent_registry 桩、`/api/reminders` 入队、调度器运行。
- [ ] 一个带提醒的任务：本地创建 → 定向同步到后端 → 到点在测试渠道（邮件/Webhook/App内）真实触发，且不重发。
- [ ] `config/secrets.local.json` + `secrets.example.json` + `.gitignore` 就位；DB 内无密钥；仓库剥离后零敏感信息（有测试/脚本校验）。
- [ ] `docs/决策记录.md`、`docs/进度.md`、本规格就位。

## 16. 后续子系统（指针）

- **子系统 A（待办编排）**：拖拽看板、日/周/月/年视图、`task_parse`/`urgency_rank`/`schedule_arrange` 真实实现、多模态录入。→ 独立规格。
- **子系统 B（细小问题反思）**：reflections 表、`researcher`/`cluster`、节假日提醒、聚类 UI。→ 独立规格。
- **子系统 C（主动学习路径）**：learning 表、`learning_path_gen`、参考链接→路径生成、由浅入深例子。→ 独立规格。

## 17. 开放问题与风险

- **R1 离线录入与提醒一致性**：离线创建带提醒任务，恢复网络前到点 → 后端无法派发。缓解：本地到点先弹 App 内通知（App 在前台时），联网后补派发邮件/Webhook；并在 UI 标注"待同步"。
- **R2 国产模型 OpenAI 兼容性差异**：部分厂商接口字段/工具调用语义不同。缓解：agent_registry 适配层做最小差异抹平，必要时按 provider 分支。
- **R3 开源剥离校验**：需脚本/CI 检查仓库不含真实密钥模式（如 `sk-`、长 token）。缓解：pre-commit/CI 扫描。
- **R4 同步并发**：单用户基本无并发，但"App 在前台编辑同时后端到点派发"需保证 `task_ref` 幂等与 `fire_at` 取最新。缓解：upsert 时比较 `updated_at`。
