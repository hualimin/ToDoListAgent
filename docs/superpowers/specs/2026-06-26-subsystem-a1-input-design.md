# 子系统 A1 · 多模态录入 + AI 解析 设计规格

- **日期**：2026-06-26
- **状态**：交互已确认，待实现
- **关联**：ADR-009（OpenAI 兼容）、ADR-012（A 拆分）、地基规格

---

## 1. 目标

用户用**语音 / 文字 / 照片**快速录入待办 → AI 自动解析（标题/内容/紧急度/截止）→ 创建任务。AI 返回**自由文本**（不强制 JSON），原始图片在详情展示给用户。

## 2. 范围

### 2.1 包含
- **前端录入栏**：3 模式切换（文字 / 语音 / 照片），集成到 TasksPage 顶部。
- **文字模式**：输入文本 → 提交解析。
- **语音模式**：Web Speech API（`SpeechRecognition`）实时转写 → 用户确认 → 提交文本。不支持时隐藏语音按钮。
- **照片模式**：拍照/选图（`<input type=file accept=image capture>`）→ 客户端压缩（最长边 ≤1280px，JPEG quality 0.7）→ 预览 → 提交（base64 + 原图保留）。
- **后端解析端点**：`POST /api/tasks/parse`，接收 `{text?, image_base64?}` → 调 `task_parse` agent → 返回自由文本解析结果 + 紧急度 + 可选截止。
- **task_parse agent 真实实现**：构建 LLM 消息（文字 + 可选 image_url vision），Prompt 引导返回结构化但不强制 JSON（自由文本 + 尝试提取字段）。
- **agent_registry 扩展**：`call_agent` 支持多模态消息（content 数组含 `{type:text}` / `{type:image_url}`）。
- **优雅降级**：AI 未配置/失败 → 原文做标题、普通紧急度、无截止。不阻塞录入。
- **Task 数据**：加 `image_data?: string`（base64 原图）。详情抽屉显示原图。
- **`input_source`** 已有（voice/text/photo）✓。

### 2.2 不包含
- 批量导入、多图、语音回放 → 后续。
- 付费语音 API（Whisper/讯飞）→ 架构预留切换接口，本期不实装。
- task_parse 的截止提取精度保证（LLM 尽力提取，不准用户手改）。

## 3. 技术方案

| 项 | 选型 |
|---|---|
| 语音转写 | Web Speech API `SpeechRecognition`（客户端，免费） |
| 图片 | `<input capture>` 拍照/选图 + Canvas 压缩 + base64 |
| AI 文字解析 | OpenAI 兼容 chat/completions（agent_registry 扩展） |
| AI 图片读取 | 同 API 的 vision 模式（content 含 image_url，兼容 GPT-4o/智谱GLM-4V） |
| 解析返回 | 自由文本（LLM 自然语言描述 + 尝试提取字段） |

## 4. 架构

```
TasksPage 录入栏（3 模式切换）
├─ 文字: input → submit
├─ 语音: SpeechRecognition → 实时转写显示 → 确认 → submit text
└─ 照片: capture/选图 → Canvas 压缩 → 预览 → submit text + image_base64
         ↓
POST /api/tasks/parse { text?, image_base64? }
         ↓
后端 task_parse agent:
  - 构建 messages: [{ role:user, content:[{type:text,text:prompt+input}, {type:image_url?,...}] }]
  - 调 LLM → 自由文本响应
  - 尝试从响应提取 title/urgency/due_at（宽松解析）
  - 失败/未配 → 降级（原文做标题）
         ↓
返回 { title, content, urgency, due_at?, raw_response }
         ↓
前端 createTask({title, content, urgency, due_at, input_source, image_data?})
```

## 5. 组件设计

### 5.1 前端
- `InputBar`（录入栏）：3 模式图标切换 + 输入区 + 提交按钮。
  - 文字：`<input>` / `<textarea>`。
  - 语音：`SpeechRecognition` start/stop → 实时转写 interim 显示 → 确认。
  - 照片：`<input type=file accept=image/* capture="environment">` → Canvas 压缩 → `<img>` 预览 → 确认。
- 提交：调 `apiClient.post('/api/tasks/parse', {text, image_base64?})` → 拿到 `{title, content, urgency, due_at}` → `taskStore.createTask(...)`。
- `TaskDetailDrawer` 增强：photo 任务显示 `<img src={data:image;base64,...}>` 原图。
- 语音不支持检测：`if (!('SpeechRecognition' in window || 'webkitSpeechRecognition' in window))` → 隐藏语音按钮。

### 5.2 后端
- `POST /api/tasks/parse`（新 router `tasks.py`）：
  - 入参：`ParseRequest { text?: str, image_base64?: str }`（至少一个非空）。
  - 调 `agent_registry.call_agent_multimodal('task_parse', messages)` → 自由文本。
  - 宽松解析：从文本提取紧急度关键词（紧急/urgent → urgent，高/high → high…）、截止关键词（明天/下周/具体日期…）。
  - 降级：异常/未配 → `{ title: text or '新任务', content: raw_response or '', urgency: 'normal', due_at: null }`。
- `agent_registry` 扩展 `call_agent_multimodal(function_name, content_blocks)`：构建 OpenAI 兼容 messages（content 为数组，含 text + image_url）。
- `task_parse` 在 `secrets.local.json` 配置（provider/base_url/model/api_key），用户配 vision-capable 模型（如 gpt-4o / glm-4v）。

### 5.3 数据
- Task 加 `image_data: str | None`（types.ts + InMemoryTaskRepository + 后端不需——前端本地）。
- 详情显示：`task.image_data` → `<img>`。

## 6. 错误处理
- AI 未配置 → 降级（原文标题、normal 紧急度）。录入不阻塞。
- AI 超时/错误 → 同降级 + 提示"AI 解析失败，已用原文创建"。
- Web Speech API 不支持 → 隐藏语音按钮。
- 图片过大 → 压缩后提交；压缩后仍 > 2MB → 截断/警告。
- 语音转写为空 → 不提交 + 提示"未识别到语音"。

## 7. 测试
- **后端**：`/api/tasks/parse` 正常（mock agent 返回文本→提取字段）；未配置降级；image_base64 传入 agent 的 messages（mock 验证 image_url 在 content 中）。
- **前端**：InputBar 3 模式切换；语音不支持时隐藏；照片压缩后 base64 非空；提交→createTask；详情显示 image。

## 8. 验收
- [ ] 文字录入 → AI 解析 → 结构化任务出现在看板。
- [ ] 语音录入 → 转写 → AI 解析 → 任务。
- [ ] 照片录入 → 压缩 → AI 视觉读取 → 任务（含原图存 `image_data`）。
- [ ] 详情显示原图（photo 任务）。
- [ ] AI 未配置 → 降级（原文标题），不阻塞。
- [ ] 前后端测试全绿，build 成功。

## 9. 开放问题
- **R1 紧急度/截止宽松解析**：从 LLM 自由文本中用正则/关键词提取。精度有限，用户可在详情手改。可接受。
- **R2 图片大小**：base64 内联在 task 记录里，大量图片会让本地 DB 变大。长期考虑分离存储（文件路径引用）。MVP 先 base64。
- **R3 SpeechRecognition 中文**：依赖浏览器/系统模型，质量参差。预留切换到付费 API 的接口（`transcribe(audio)` → 后端 Whisper），本期不实装。
