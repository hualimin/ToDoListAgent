# 子系统 C · 主动学习路径 实现计划

> REQUIRED SUB-SKILL: superpowers:subagent-driven-development.

**Goal:** 用户粘贴参考(URL/文字)+选调研模式 → AI 生成结构化学习路径(JSON: 概念列表+3层例子) → 前端展示+进度标记。

**Architecture:** 后端 url_fetcher(去HTML标签) + POST /api/learning/paths(AI生成JSON+降级) + learning router。前端 LearningStore + LearningPathForm(表单) + LearningPathView(概念卡片+展开+进度) + LearnPage集成。

**Spec:** [../specs/2026-06-27-subsystem-c-learning-design.md](../specs/2026-06-27-subsystem-c-learning-design.md)

---

## Task 1: 后端 — url_fetcher + /api/learning/paths 端点

**Files:** Create `server/app/url_fetcher.py`、`server/app/routers/learning.py`；Modify `server/app/schemas.py`、`server/app/main.py`；Create `server/tests/test_learning.py`

- [ ] **Step 1: `url_fetcher.py`** (spec 4.1 的代码)
- [ ] **Step 2: `schemas.py` 追加** LearningExample / LearningConcept / LearningPathRequest / LearningPathResponse (spec 4.3)
- [ ] **Step 3: `routers/learning.py`** — POST /api/learning/paths (抓URL+合并文字+构建prompt+AI生成JSON+降级) (spec 4.2)
- [ ] **Step 4: `main.py` 挂路由** `app.include_router(learning.router)`
- [ ] **Step 5: `test_learning.py`** — mock agent 返回 JSON → 正确结构；AI 未配 → 降级；URL+文字混合
- [ ] **Step 6: pytest + 提交**

## Task 2: 前端 — 类型 + Store + 表单 + 路径展示 + LearnPage

**Files:** Create `app/src/db/learningTypes.ts`、`app/src/store/learningStore.ts`、`app/src/components/LearningPathForm.tsx`、`LearningPathView.tsx`；Modify `app/src/pages/LearnPage.tsx`；Create tests

- [ ] **Step 1: `learningTypes.ts`** — LearningPath / Concept / Example 类型 (spec 5)
- [ ] **Step 2: `learningStore.ts`** — Zustand: paths[] + addPath + updateConceptStatus + loadFromRepo
- [ ] **Step 3: `LearningPathForm.tsx`** — 主题+URL/文字+模式(默认/自定义)+自定义提示词 → POST /api/learning/paths → addPath
- [ ] **Step 4: `LearningPathView.tsx`** — 概念卡片列表(可展开3层例子+参考) + 状态标记(待学/学习中/已学) + 进度
- [ ] **Step 5: `LearnPage.tsx`** — 无路径→新建表单；有路径→路径列表+新建按钮
- [ ] **Step 6: 测试** — 表单提交→路径渲染；概念展开+状态切换
- [ ] **Step 7: vitest + tsc + 提交**

## Task 3: 全量回归 + 合并 + 推送

- [ ] 后端 pytest 全绿 + 前端 vitest + tsc + build 全绿
- [ ] 合并 main + 推送

---

## 自检
- Spec 覆盖：url_fetcher+端点→Task 1；类型+Store+表单+展示+LearnPage→Task 2；回归→Task 3。✅
- 范围：C 单计划。路径编辑/重排/社区分享排除。✅
