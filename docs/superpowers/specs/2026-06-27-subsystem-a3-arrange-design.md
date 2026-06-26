# 子系统 A3 · 智能编排 设计规格

- **日期**：2026-06-27
- **状态**：方案确认，待实现
- **关联**：ADR-012（A 拆分）、地基规格

---

## 1. 目标

用户点"一键智能排程" → AI 排出任务优先级+时长 → 确定性算法分配**零冲突**精确时间槽 → 展示建议 → 用户接受/改。

## 2. 架构：AI 排序 + 算法分配

```
一键排程
  ↓
POST /api/tasks/arrange { tasks: [{task_ref,title,urgency,due_at}], busy: [{start,end}] }
  ↓
后端：
  1. AI(schedule_arrange) → 返回优先级排序 [{task_ref, priority, est_minutes, reason}]
     - AI 未配 → 规则排序（urgent>high>normal>low → due_at 早的先 → 创建早的先）
  2. 确定性算法 arrange_slots(优先级列表, busy, 可用时段=9-21点, 粒度=30min)
     → 逐个分配不冲突的 scheduled_at
     → 截止前排不下 → status='overflow' + warn
  ↓
返回 [{task_ref, suggested_at, reason, status: 'scheduled'|'overflow'}]
  ↓
前端：建议列表 → 接受(updateTask scheduled_at) / 跳过 / 改(详情)
```

## 3. 确定性算法（零冲突核心）

```python
def arrange_slots(ranked_tasks, busy_slots, avail_hours=(9,21), granularity_min=30):
    """
    ranked_tasks: AI/规则排好序的任务 [{task_ref, est_minutes, due_at}]
    busy_slots: 已占用时段 [{start: ISO, end: ISO}]（已有 scheduled_at 的任务）
    返回: [{task_ref, suggested_at, status}]
    """
    # 从今天起逐天、逐槽（30min）扫描
    # 对每个任务（按优先级）：
    #   找第一个 满足条件的空槽：
    #     - 在可用时段内（9-21点）
    #     - 不与 busy 重叠
    #     - 持续 est_minutes（跨多个 30min 槽都空）
    #     - 在 due_at 之前结束（若有截止）
    #   找到 → 分配 + 加入 busy（占用该时段）
    #   找不到（截止前排不下）→ overflow
```

**零冲突保证**：每分配一个任务即占用该时段加入 busy，后续任务自动跳过——数学上不可能重复。

## 4. AI 角色（schedule_arrange）

Prompt: "以下是待排程任务列表，请按建议执行顺序排序，并为每个任务预估所需时长（分钟）和简短理由。返回 JSON 数组：[{task_ref, est_minutes, reason}]\n任务：{json}"

AI 只管排序+估时，不管分配时间（避免 LLM 算不准）。返回 JSON（这里需要结构化，不像 A1 的自由文本——因为要提取 task_ref/est_minutes）。

**降级**：AI 未配/失败 → 规则排序：
- urgency 权重：urgent=0, high=1, normal=2, low=3
- 同 urgency 内按 due_at 升序（无 due_at 排末尾）
- est_minutes 默认 60

## 5. 组件

### 后端
- `POST /api/tasks/arrange`：接收 `{tasks: [...], busy: [...]}` → AI 排序 + 算法分配 → 返回 `[{task_ref, suggested_at, reason, status}]`
- `schedule_arrange` agent 实现（复用 agent_registry.call_agent，返回 JSON 文本 → 解析）
- `arrange_slots.py`：确定性冲突算法（纯函数，可测）
- `schemas.py`：ArrangeRequest / ArrangeResponseItem / ArrangeResponse

### 前端
- `ArrangePanel`：排程面板——"一键排程"按钮 → 调 `/api/tasks/arrange` → 展示建议列表（任务标题 + 建议时间 + 理由 + 接受/跳过）→ 接受 → `updateTask(scheduled_at)` + 标记
- 集成到 TasksPage（顶部加按钮 或 独立面板）

### 数据
- `scheduled_at`（已有字段）用于存排程结果。
- 无新字段。

## 6. 错误处理
- AI 返回非 JSON → 降级规则排序。
- 所有任务都 overflow → 返回空 + 提示"排满了，请调整截止/减少任务"。
- 部分溢出 → 已排的返回 + 溢出的标 overflow 让用户决定。

## 7. 测试
- `arrange_slots.py`：零冲突（分配后无重叠）、截止约束（截止前排不下→overflow）、可用时段（夜间不排）、粒度正确、空任务列表。
- `/api/tasks/arrange`：mock AI 返回 JSON → 正确排序+分配；AI 未配 → 规则降级。
- 前端：建议列表渲染 + 接受 → scheduled_at 更新。

## 8. 验收
- [ ] 一键排程 → AI 排序 + 算法分配 → 建议列表（零冲突）。
- [ ] 接受建议 → 任务 scheduled_at 更新。
- [ ] 截止前排不下 → overflow 标记 + 提示。
- [ ] AI 未配 → 规则降级（仍零冲突）。
- [ ] 前后端测试全绿。
