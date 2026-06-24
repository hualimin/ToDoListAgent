#!/usr/bin/env node
/**
 * Stop hook: 每轮回答结束后触发，把本会话 transcript 中"新增"的对话行，
 * 以原始内容（不提炼）增量追加到统一的对话记录 md 文件中。
 *
 * 输入(stdin JSON): { transcript_path, session_id, hook_event_name, ... }
 * 写出: <项目根>/对话记录/对话记录.md  （追加）
 * 状态: <项目根>/对话记录/.log-state.json （记录每个 transcript 已处理到第几行）
 *
 * 设计原则：任何异常都静默吞掉，绝不阻断主对话流程。
 */
const fs = require('fs');
const path = require('path');

function main() {
  let raw = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { raw += chunk; });
  process.stdin.on('end', () => {
    try {
      run(JSON.parse(raw || '{}'));
    } catch (_) {
      // 静默失败
    }
    // hook 不需要返回任何控制信号
  });
}

function run(input) {
  const transcriptPath = input.transcript_path;
  if (!transcriptPath || !fs.existsSync(transcriptPath)) return;

  const projectRoot = path.join(__dirname, '..', '..');
  const logDir = path.join(projectRoot, '对话记录');
  fs.mkdirSync(logDir, { recursive: true });
  const logFile = path.join(logDir, '对话记录.md');
  const stateFile = path.join(logDir, '.log-state.json');

  // 读取状态
  let state = {};
  try { state = JSON.parse(fs.readFileSync(stateFile, 'utf8')); } catch (_) {}

  const lines = fs.readFileSync(transcriptPath, 'utf8').split('\n').filter((l) => l.trim());
  const key = transcriptPath; // 每个会话一个独立的 transcript_path
  const startIdx = state[key] || 0;
  if (lines.length <= startIdx) return; // 没有新内容

  // 首次创建文件时写表头
  if (!fs.existsSync(logFile)) {
    fs.writeFileSync(
      logFile,
      '# 项目全量对话记录\n\n> 本文件由 `.claude/hooks/log-conversation.js`（Stop hook）自动增量追加，记录原始提问与回答，不做任何提炼。\n\n---\n',
      'utf8'
    );
  }

  let buf = '';
  for (let i = startIdx; i < lines.length; i++) {
    let obj;
    try { obj = JSON.parse(lines[i]); } catch (_) { continue; }

    const type = obj.type; // 'user' | 'assistant' | 'summary' ...
    const msg = obj.message;
    if (!msg || (type !== 'user' && type !== 'assistant')) continue;
    if (!msg.content) continue;

    const role = msg.role || type;
    const ts = obj.timestamp
      ? new Date(obj.timestamp).toLocaleString('zh-CN', { hour12: false })
      : '';

    // 把 content（字符串或内容块数组）转成完整文本
    const text = contentToText(msg.content, role);
    if (!text || !text.trim()) continue;

    const header = role === 'user' ? '## 👤 用户' : '## 🤖 助手';
    buf += `\n${header}${ts ? `\n*${ts}*` : ''}\n\n${text}\n`;
  }

  if (buf.trim()) fs.appendFileSync(logFile, buf, 'utf8');

  state[key] = lines.length;
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2), 'utf8');
}

/** 把 message.content 渲染成尽量完整、可读的 markdown 文本（保留原始内容）。 */
function contentToText(content, role) {
  if (typeof content === 'string') return content;

  if (!Array.isArray(content)) {
    try { return JSON.stringify(content, null, 2); } catch (_) { return ''; }
  }

  const parts = [];
  for (const block of content) {
    if (!block || typeof block !== 'object') continue;
    switch (block.type) {
      case 'text':
        parts.push(block.text || '');
        break;
      case 'thinking':
        // 保留思考过程（可选，便于过程留痕）
        if (block.thinking) parts.push(`<details><summary>💭 思考过程</summary>\n\n${block.thinking}\n\n</details>`);
        break;
      case 'tool_use':
        parts.push(`> 🔧 工具调用: \`${block.name}\`\n> \`\`\`json\n${safeStringify(block.input)}\n\`\`\``);
        break;
      case 'tool_result':
        parts.push(`> 📋 工具结果:\n> \`\`\`\n${truncate(contentToString(block.content))}\n\`\`\``);
        break;
      default:
        parts.push(`> (${block.type})`);
    }
  }
  return parts.join('\n\n');
}

function contentToString(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map((c) => (c && c.text) || safeStringify(c)).join('\n');
  return safeStringify(content);
}

function safeStringify(v) {
  try { return JSON.stringify(v, null, 2); } catch (_) { return String(v); }
}

function truncate(s, max = 4000) {
  if (typeof s !== 'string') s = String(s);
  return s.length > max ? s.slice(0, max) + `\n…[已截断，原始长度 ${s.length}]` : s;
}

main();
