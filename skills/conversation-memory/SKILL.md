---
name: conversation-memory
description: >-
  Persistent long-term memory for Codex conversations, stored in an Obsidian
  vault at E:\codexmo\codex. Use at the START of every conversation to load past
  context. Use when the user asks to remember, recall, search, or manage memory.
  Use at the END to save only explicitly authorized new information.
---

# Conversation Memory (Obsidian)

长期记忆现在以 `E:\codexmo\codex` 这个 Obsidian 库为人类可读主存储，同时保留机器可读的
JSON 数据在 `E:\codexmo\codex\.codex-memory\memory.json`。Markdown 笔记和 JSON 同步更新。

## Startup（每次会话开始，禁止全库加载）

不要运行 `summary`，那会加载全部记忆。按下面顺序只读取必要内容：

1. 读取 `E:\codexmo\codex\00-索引.md`，了解分类入口。
2. 根据当前任务和 `cwd` 判断所属项目，只读取该项目对应的 `README.md` 或索引笔记。
3. 查看最近更新：

```powershell
python "<skill_dir>/scripts/vault_memory.py" recent --days 7 --limit 30
```

4. 需要细节时再用 `search` 定位并读取相关原文。
5. 禁止一次性读取、总结或导出整个 `E:\codexmo\codex` 库。

## 保存规则（必须遵守）

- 只有用户明确授权的内容才写入正式分类，并使用 `--status confirmed --authorized yes`。
- 没有明确授权的内容只能进入 `00-收件箱`，默认 `--status pending`，然后告诉用户等待确认。
- 不要自动把未经确认的内容归入 `10-重要决策`、`20-行为习惯`、`30-项目资料` 或 `40-对话细节`。

## 常用命令

添加一条已授权记忆：

```powershell
python "<skill_dir>/scripts/vault_memory.py" add --type decision --content "用户决定：..." --tags "决策,项目名" --importance high --session "session-label" --status confirmed --authorized yes
```

添加一条待确认建议：

```powershell
python "<skill_dir>/scripts/vault_memory.py" add --type habit --content "用户似乎偏好：..." --tags "偏好" --importance medium --status pending
```

确认收件箱中的某条记忆并归入正式分类：

```powershell
python "<skill_dir>/scripts/vault_memory.py" confirm <id-prefix>
```

搜索：

```powershell
python "<skill_dir>/scripts/vault_memory.py" search "<query>"
```

查看最近更新：

```powershell
python "<skill_dir>/scripts/vault_memory.py" recent --days 7 --limit 30
```

查看所有笔记路径：

```powershell
python "<skill_dir>/scripts/vault_memory.py" list
```

更新一条已有记忆：

```powershell
python "<skill_dir>/scripts/vault_memory.py" update <id-prefix> --content "新内容" --tags "新标签"
```

设置偏好：

```powershell
python "<skill_dir>/scripts/vault_memory.py" set-pref "<key>" "<value>"
```

删除一条记忆：

```powershell
python "<skill_dir>/scripts/vault_memory.py" forget <id-prefix>
```

手动重建 Markdown 笔记：

```powershell
python "<skill_dir>/scripts/vault_memory.py" export
```

## 类型与分类

- `decision` -> `10-重要决策`
- `habit` / `preference` -> `20-行为习惯`
- `project` -> `30-项目资料`，必要时按 `--project` 建子目录
- `conversation` -> `40-对话细节`
- `daily` -> `40-对话细节/每日记录`
- `inbox` / 未授权 -> `00-收件箱`

## 自动维护

系统已在 `E:\codexmo\codex\.codex-memory\jobs` 配置三个维护任务：

- 每日 23:00 整理当天项目沟通记录并提取新增信息。
- 每周日 23:30 做知识库复盘，合并重复内容。
- 每周日 23:45 归档已结束项目，生成摘要并迁移原始资料。

这些任务会调用同一个记忆 CLI，不应手工绕过它直接改 Markdown。

## Shutdown（每次会话结束）

先运行 `recent --days 7 --limit 30` 查看近期内容。只把真正新增且用户已授权的事项写入。
若用户没有明确授权，则以 `pending` 写入 `00-收件箱`，不要重复保存已存在的内容。

优先保存：

1. 用户明确做出的决策及理由
2. 新增的用户事实、偏好、项目、工具或路径
3. 已完成的工作和当前状态
4. 用户明确关心的开放问题或下一步

`--importance high` 用于用户会介意重复说明的内容。
