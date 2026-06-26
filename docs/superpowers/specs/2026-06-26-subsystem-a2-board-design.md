# 子系统 A2 · 任务看板 + 多粒度视图 设计规格

- **日期**：2026-06-26
- **状态**：交互已 6 版原型定稿（见 ADR-013），待规格复核后进入实现计划
- **关联**：[../../决策记录.md](../../决策记录.md) ADR-012/013、原型 `docs/prototypes/a2-board-demo-v1~v6.html`（v6 为定稿）、地基规格 `2026-06-24-foundation-design.md`

---

## 1. 背景与目标

地基已提供：本地优先数据层（TaskRepository/InMemory）、taskStore、SyncService（幂等同步）、4 主题系统、待办页雏形（周历带 + 趋势柱图 + 范围筛选 + 任务卡 + 只读详情抽屉）。

**A2 在地基之上构建完整的"看 / 拖 / 改 / 回顾"待办体验**：
- 任务以**状态板**（看板）形式管理，拖拽改状态/调顺序。
- **月历**视图按日查看任务分布与历史。
- 任务**可点开编辑**（标题/内容/状态/紧急度/截止）。
- 拖拽改状态需**确认**，防误操作。
- 修复地基遗留的 `board_order` 冲突与 `withinRange` 语义问题。

这是子系统 A 的第一块（A2）；A1（多模态+AI录入）、A3（智能编排）后续独立规格。

### 1.1 既定约束（继承）
移动端优先（Capacitor）；触摸拖拽必须用支持 touch 的库；4 主题实时换肤；本地优先 + 幂等同步；单用户（user_id 预留）；密钥不进 DB。

## 2. 范围

### 2.1 包含（In Scope）
- **三种视图**（顶部图标切换，独占行不遮挡）：状态板 / 月历 / 列表。
- **状态板**：5 状态列纵向铺开；拖拽改状态（跨列，**带确认弹窗**）；列内拖调序（不确认）；点卡进详情。
- **月历视图**：固定尺寸格子；任务文字过长单行截断 `…`；每格最多 2 条（紧急/高优先）+「+X 更多」；只读；年/月/日跳转组件；点某天展开当天全部（含已完成历史）。
- **列表视图**：地基列表升级——每项状态图标+色条+紧急度+时间；长标题两行省略；点卡进详情。
- **可编辑任务详情**：标题/内容/状态/紧急度/截止日期；保存生效。
- **地基修复**：`board_order` 改 float（max+1 / 相邻中点）；`withinRange` 语义修正（今日=今天到期含逾期；本周=本周内含逾期；无截止归"未排期"）。
- `taskStore` 新增 `moveStatus` / `reorder` / `updateTask(全字段)`。
- dnd-kit 触摸拖拽 + 全程 4 主题感知。

### 2.2 不包含（Out of Scope，延后）
- 历史可视化（月历热力图年度趋势等）→ 后续独立子项目。
- 多模态录入（语音/文字/照片→AI解析）、AI 紧急度/编排 → A1/A3。
- 原生 SQLite 真实实现（仍用 InMemory + stub）。
- 搜索/筛选（按状态/紧急度/文字）→ 后续。

## 3. 关键决策（摘要，详见 ADR-013）
| 决策 | 选择 |
|---|---|
| 看板主维度 | 状态板（拖拽）+ 月历（只读）+ 列表，图标切换 |
| 拖拽改什么 | 状态板：跨列改状态（带确认）、列内调序；月历不拖 |
| 改日期方式 | 详情抽屉日期选择器（不拖，日期开放范围） |
| 月历范围 | 整月，年/月/日跳转，不局限一周 |
| 拖拽库 | dnd-kit（触摸支持） |
| board_order | float（max+1 新建，相邻中点重排） |
| 视图切换器 | 顶部独占行，不遮挡 |

## 4. 技术栈（增量）
| 项 | 选型 |
|---|---|
| 拖拽 | `@dnd-kit/core` + `@dnd-kit/sortable` + 触摸/指针传感器 |
| 日期 | 原生 `<input type=date>`（详情）；月历纯计算 |
| 状态管理 | 复用 Zustand taskStore（扩展） |
| 样式 | 复用 4 主题 CSS 变量语义类 |

## 5. 整体架构
```
TasksPage（顶部视图切换器：状态板/月历/列表）
├─ StatusBoard（DndContext + 5 列 SortableContext）
│   └─ SortableTaskCard（包 TaskCard + 拖拽手柄；点卡→详情）
├─ CalendarView（月历 + 跳转组件 + 点天展开抽屉）
└─ ListView（升级版列表；点卡→详情）
+ TaskDetailDrawer（可编辑：标题/内容/状态/紧急度/截止 + 保存）
+ ConfirmDialog（拖拽改状态确认）
+ taskStore 扩展（moveStatus/reorder/updateTask）
```
全程用语义色（`bg-card text-ink border-line accent` 等），切主题自动换肤。带提醒任务改 due_at/status → `pending_up` 触发 SyncService 上行。

## 6. 组件设计

### 6.1 视图切换器 `ViewSwitcher`
- 顶部独占一行，3 图标（状态板/月历/列表），激活态 accent。本地 state（或 store）记当前视图。

### 6.2 状态板 `StatusBoard`（dnd-kit）
- 5 列（待办/进行中/完成/搁置/延期），每列 `SortableContext`（items=该列任务 id）。
- 列头：状态图标（色块）+ 名称 + 计数。
- 卡片：`SortableTaskCard`，左侧状态色条 + 标题（两行省略）+ 紧急度色点+文字 + 时间。
- **拖拽落点判定**：`onDragEnd` 拿到 active(被拖卡) + over(目标：列或卡)。
  - over 是**别的状态列/卡**（status 变化）→ **弹 ConfirmDialog**；确认 → `moveStatus(id, newStatus)` + 插入到 over 位置（`reorder`）；取消 → 不变。
  - over 是**同列卡**（status 不变，仅调序）→ 直接 `reorder`，不弹确认。
- 列纵向铺开（`flex-col`），整体垂直滚动，适配窄屏。

### 6.3 月历 `CalendarView`
- 7 列网格，格子**固定高度**（~74px，`overflow:hidden`）。
- 每格：日期号（今天高亮）+ 待办总数 + 最多 2 条事件（紧急/高优先排序）。
- 事件条：单行 `white-space:nowrap; overflow:hidden; text-overflow:ellipsis` 截断；左侧色条按紧急度；已完成加删除线+淡。
- 超出 2 条 →「+X 更多」。
- **跳转组件**（"跳转 ▾"展开）：选年/月 + 日 → 翻到该月并高亮该日；"回今天"。
- **点某格 → `DayPanel` 抽屉**：当天全部任务，分"未完成 / 已完成（历史）"两段；点条 → 详情。只读（不在月历改日期）。

### 6.4 列表 `ListView`
- 地基列表升级：每项 横向布局 = 状态图标(色块) + 主区(标题两行省略 + 紧急度) + 右侧(状态文字 + 时间)。
- 点项 → 详情。

### 6.5 任务详情 `TaskDetailDrawer`（可编辑）
- 字段：标题(text)、内容(textarea)、状态(select 5)、紧急度(select 4)、截止(`<input type=date>`)。
- 保存 → `taskStore.updateTask(id, patch)`（全字段）→ 改了 due_at/status 的带提醒任务 → `pending_up`。
- 取消/返回 不改。

### 6.6 拖拽确认 `ConfirmDialog`
- "把「X」从 待办 改为 进行中？" + 确认/取消。确认应用 `moveStatus`+`reorder`，取消回滚（重新渲染原状）。

## 7. 数据层变更（修地基 + 扩展）

### 7.1 `Task` 类型（不变，复用地基）
已有 `status/urgency/due_at/board_order/sync_state/content` 等字段，A2 全用。

### 7.2 `board_order` 改 float + InMemoryTaskRepository 修正
- 新建：`board_order = (列内最大 order) + 1`（而非 `items.size`，避免软删冲突）。
- 列内重排（拖到两卡间）：`order = (前卡.order + 后卡.order) / 2`（float 中点，支持无限次重排）。
- 接口不变（`TaskRepository`），仅 `InMemoryTaskRepository`（与未来 SqliteTaskRepository）实现调整。

### 7.3 `taskStore` 扩展
- `moveStatus(id, status)`：改 status + 按拖落位置 reorder（中点）+ 刷新 + 标 `pending_up`。
- `reorder(id, beforeId|null)`：列内重排（中点）+ 刷新。
- `updateTask(id, patch)`：全字段更新（详情编辑用）+ 刷新 + 改 due/status 的带提醒任务标 `pending_up`。
- 现有 `createTask/setStatus/remove/loadFromRepo/reset` 保留（`setStatus` 可由 `updateTask` 覆盖或保留）。

### 7.4 `withinRange` 语义修正（`lib/taskViews.ts`）
- `today`：`due_at` 是今天（同日）**或逾期**（过去且未完成）。
- `week`：本周内（周一~周日，按日历周）含逾期。
- `month`：本月内含逾期。
- 无 `due_at`：归"未排期"，不出现在 today/week/month（仅 all）。
- `all`：全部。
- （月历视图不依赖 withinRange，直接按 `due_at` 日期归格。）

## 8. 视觉/交互细节（原型 v6 已验证）
- 卡片：左 3px 状态色条；标题 `-webkit-line-clamp:2` 两行省略；紧急度色点（urgent=urgent色/high=late色/余=ink3）。
- 月历格：固定高，事件 `ellipsis` 单行截断，最多 2 + 更多。
- 状态图标：5 状态各有 SVG 图标 + 色（todo/doing/done/shelved/delayed）。
- 拖拽视觉：拖起卡 `opacity:.4`；目标列 `outline` 高亮。
- 4 主题：全部用 CSS 变量语义类，状态色建议也纳入主题 token（每主题一套状态色，或共用一套——实现时定，倾向共用一套克制状态色 + 主题 accent）。

## 9. 错误处理
- 拖拽确认取消 → 状态不变（无副作用）。
- 详情保存空标题 → 保留原标题（不存空）。
- 月历跳转非法日 → clamp 到当月最大日。
- dnd-kit 拖到非法区（非列/非卡）→ 忽略。

## 10. 测试策略（Vitest + RTL）
- `lib/taskViews` withinRange 新语义 + 测试（今天/逾期/本周/无截止）。
- `board_order` 中点逻辑：新建 max+1、重排中点、无冲突（InMemoryTaskRepository 测试扩展）。
- `taskStore`：`moveStatus`/`reorder`/`updateTask` 各自测试（含 pending_up 标记）。
- `StatusBoard`：dnd-kit 用 RTL `fireEvent`/模拟 dragEnd 测落点 → 确认弹窗出现 → 确认后 status 变；取消后不变；同列拖不弹窗。
- `CalendarView`：格子截断（最多2+更多）、今天高亮、跳转翻月、点格展开当天。
- `TaskDetailDrawer`：编辑保存生效、改 due 触发 pending_up。
- 主题：渲染不报错（4 主题）。

## 11. A2 完成验收标准
- [ ] 顶部图标切换 状态板/月历/列表，不遮挡内容。
- [ ] 状态板 5 列纵向，拖跨列改状态（弹确认，确认改+取消回滚），列内拖调序（不弹）。
- [ ] 月历固定格 + 截断 + 最多2条+更多 + 今天高亮 + 年月日跳转 + 点天展开当天全部(含历史)。
- [ ] 列表每项状态图标+色条+紧急度+时间，长标题两行省略。
- [ ] 详情可编辑（标题/内容/状态/紧急度/截止），保存生效，改 due/status 带提醒任务 → pending_up。
- [ ] `board_order` float 中点（无软删冲突）；`withinRange` 新语义。
- [ ] 全程 4 主题可切、实时换肤；触摸拖拽（dnd-kit）。
- [ ] Vitest 全绿，tsc 干净，build 成功。

## 12. 后续（A1/A3 指针）
- A1（多模态+AI录入）：语音/文字/照片 → task_parse/urgency_rank → 自动填详情字段。
- A3（智能编排）：schedule_arrange 结合行程+待办综合排程，可人工改排。
- 历史可视化：月历热力图 / 年度趋势（独立子项目）。

## 13. 开放问题
- **R1 状态色与主题**：5 状态色是每主题各一套，还是共用一套？倾向共用克制状态色 + 主题 accent，实现时定。
- **R2 月历性能**：大量任务时月历格内排序/截断每格计算——按月过滤后量可控；如超大再虚拟化。
- **R3 board_order float 精度**：极多次重排后 float 精度收敛——可定期重排归一化（Subsystem A 后期）。
