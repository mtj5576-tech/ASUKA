#!/usr/bin/env python3
"""Codex long-term memory backed by an Obsidian vault on E:\codexmo\codex.

The machine-readable JSON lives in E:\\codexmo\\codex\\.codex-memory\\memory.json.
The same records are rendered as human-readable Markdown notes in the vault.
Only explicitly authorized memories should be written with status=confirmed.
Suggested memories default to status=pending and land in 00-收件箱.
"""

import argparse
import json
import os
import re
import sys
import uuid
from datetime import datetime, timedelta

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

VAULT_DIR = os.environ.get("CODEX_MEMORY_VAULT", r"E:\codexmo\codex")
DATA_DIR = os.path.join(VAULT_DIR, ".codex-memory")
MEMORY_FILE = os.path.join(DATA_DIR, "memory.json")
LEGACY_FILE = os.path.join(
    r"C:\Users\ZhuanZ\.codex\skills\conversation-memory", "memory.json"
)

TYPE_DIRS = {
    "inbox": "00-收件箱",
    "decision": "10-重要决策",
    "habit": "20-行为习惯",
    "preference": "20-行为习惯",
    "project": "30-项目资料",
    "conversation": "40-对话细节",
    "daily": os.path.join("40-对话细节", "每日记录"),
}

PROJECT_KEYWORDS = {
    "A股量化交易": ["ashare-quant", "量化", "交易", "QMT", "A股"],
    "肯尼亚涂料建材销售": ["涂料", "paint-marketing", "建材"],
    "肯尼亚新能源销售": ["新能源", "光伏", "new-energy-intel", "肯尼亚"],
    "Codex技能与工具链": ["skill", "codex", "conversation-memory", "编码", "技能"],
}


def _load():
    if not os.path.exists(MEMORY_FILE):
        return {"memories": [], "preferences": {}}
    with open(MEMORY_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    data.setdefault("memories", [])
    data.setdefault("preferences", {})
    return data


def _save(data):
    os.makedirs(DATA_DIR, exist_ok=True)
    with open(MEMORY_FILE, "w", encoding="utf-8", newline="\n") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def _now():
    return datetime.now().astimezone().isoformat(timespec="seconds")


def _safe(text):
    text = re.sub(r'[\\/:*?"<>|\r\n\t]', " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _q(value):
    if value is None:
        value = ""
    return json.dumps(str(value), ensure_ascii=False)


def _title(mem):
    content = (mem.get("content") or "").strip()
    if not content:
        return mem.get("id", "未命名")
    title = _safe(content)
    if len(title) > 38:
        title = title[:38].rstrip(" -")
    return title or mem.get("id", "未命名")


def _project_for(mem):
    project = (mem.get("project") or "").strip()
    if project:
        return project
    hay = " ".join([str(mem.get("content", "")), " ".join(mem.get("tags", []) or []), mem.get("session", "") or ""]).lower()
    for name, words in PROJECT_KEYWORDS.items():
        if any(w.lower() in hay for w in words):
            return name
    return ""


def _dir_for(mem):
    if not mem.get("authorized") or mem.get("status") == "pending":
        return "00-收件箱"
    mtype = mem.get("type", "inbox")
    base = TYPE_DIRS.get(mtype, "00-收件箱")
    if mtype == "project":
        project = _project_for(mem)
        if project:
            return os.path.join(base, project)
    return base


def _note_path(mem, used=None):
    used = used or set()
    d = (mem.get("timestamp") or _now())[:10]
    slug = _safe(_title(mem)) or "note"
    slug = re.sub(r"^\d{4}-\d{2}-\d{2}-", "", slug)
    suffix = (mem.get("id") or uuid.uuid4().hex[:12])[:6]
    filename = f"{d}-{slug}-{suffix}.md"
    rel = os.path.join(_dir_for(mem), filename)
    n = 2
    while rel.lower() in used:
        filename = f"{d}-{slug}-{suffix}-{n}.md"
        rel = os.path.join(_dir_for(mem), filename)
        n += 1
    used.add(rel.lower())
    return rel


def _frontmatter(mem):
    lines = [
        "---",
        f"type: {mem.get('type', 'inbox')}",
        f"status: {mem.get('status', 'pending')}",
        f"authorized: {str(bool(mem.get('authorized'))).lower()}",
        f"created: {(mem.get('timestamp') or _now())[:10]}",
        f"importance: {mem.get('importance', 'medium')}",
    ]
    if mem.get("session"):
        lines.append(f"session: {_q(mem.get('session'))}")
    if mem.get("project"):
        lines.append(f"project: {_q(mem.get('project'))}")
    tags = mem.get("tags") or []
    if tags:
        lines.append(f"tags: {json.dumps(tags, ensure_ascii=False)}")
    if mem.get("id"):
        lines.append(f"source_id: {_q(mem.get('id'))}")
    lines.append("---")
    return "\n".join(lines) + "\n\n"


def _write_note(mem):
    rel = _note_path(mem)
    mem["note_path"] = rel
    abs_path = os.path.join(VAULT_DIR, rel.replace("/", os.sep))
    os.makedirs(os.path.dirname(abs_path), exist_ok=True)
    body = f"# {_title(mem)}\n\n{mem.get('content', '').strip()}\n"
    with open(abs_path, "w", encoding="utf-8", newline="\n") as f:
        f.write(_frontmatter(mem) + body)
    return rel


def _classify_legacy(m):
    tags = {t.lower() for t in (m.get("tags") or [])}
    content = (m.get("content") or "") + " " + " ".join(tags) + " " + (m.get("session") or "").lower()
    if "偏好" in tags or "用户信息" in tags or any(k in content for k in ["使用中文", "时区", "不要标注来源", "格式", "速度", "希望codex", "希望用现有"]):
        return "habit"
    if any(k in tags for k in ["客户", "线索", "项目", "光伏", "新能源", "涂料", "建材", "量化", "交易", "ashare-quant", "new-energy-intel", "paint-marketing"]):
        if any(k in content for k in ["日报", "报告", "客户", "线索", "终端", "项目", "已生成", "已创建"]):
            return "project"
        return "conversation"
    if any(k in content for k in ["已生成", "已创建", "会话", "日报", "报告", "线索"]):
        return "conversation"
    return "decision"


def _convert_legacy(old):
    memories = []
    used = set()
    for m in old.get("memories", []):
        mtype = _classify_legacy(m)
        project = ""
        if mtype == "project":
            project = _project_for({"content": m.get("content", ""), "tags": m.get("tags", []), "session": m.get("session", "")})
        new_m = {
            "id": m.get("id") or uuid.uuid4().hex[:12],
            "type": mtype,
            "status": "confirmed",
            "authorized": True,
            "timestamp": m.get("timestamp") or _now(),
            "content": m.get("content", ""),
            "tags": m.get("tags", []),
            "importance": m.get("importance", "medium"),
            "session": m.get("session", ""),
            "project": project,
        }
        _write_note(new_m)
        memories.append(new_m)
    return {"memories": memories, "preferences": old.get("preferences", {})}


def cmd_summary():
    data = _load()
    prefs = data.get("preferences", {})
    memories = sorted(data["memories"], key=lambda x: x.get("timestamp", ""), reverse=True)
    if prefs:
        print("=== PREFERENCES ===")
        for k, v in prefs.items():
            print(f"  {k}: {v}")
        print()
    print(f"=== MEMORIES ({len(memories)} total) ===")
    for m in memories:
        tags = m.get("tags") or []
        tag_str = f" [{', '.join(tags)}]" if tags else ""
        status = m.get("status", "pending")
        auth = "AUTH" if m.get("authorized") else "PEND"
        print(f"[{m.get('importance', 'medium').upper()}|{status.upper()}|{auth}] {m.get('timestamp', '')[:10]} | {m.get('content', '')}{tag_str}")


def cmd_list(args):
    data = _load()
    rows = sorted(data["memories"], key=lambda x: x.get("timestamp", ""), reverse=True)
    if args.status:
        rows = [m for m in rows if m.get("status") == args.status]
    if args.type:
        rows = [m for m in rows if m.get("type") == args.type]
    if not rows:
        print("No memories found.")
        return
    for m in rows:
        print(f"{m.get('id', '')[:12]}  {m.get('timestamp', '')[:10]}  {m.get('type', 'inbox'):12}  {m.get('note_path', '')}")


def cmd_add(args):
    data = _load()
    status = args.status or "pending"
    authorized = args.authorized == "yes" or status == "confirmed"
    mtype = args.type or "inbox"
    mem = {
        "id": uuid.uuid4().hex[:12],
        "type": mtype,
        "status": status,
        "authorized": authorized,
        "timestamp": args.timestamp or _now(),
        "content": args.content,
        "tags": [t.strip() for t in args.tags.split(",") if t.strip()] if args.tags else [],
        "importance": args.importance or "medium",
        "session": args.session or "",
        "project": args.project or "",
    }
    _write_note(mem)
    data["memories"].append(mem)
    _save(data)
    print(f"[OK] {mem['id']} -> {mem['note_path']}")


def cmd_confirm(memory_id):
    data = _load()
    matches = [m for m in data["memories"] if m.get("id", "").startswith(memory_id)]
    if not matches:
        print(f"No memory found with id starting with '{memory_id}'.")
        return
    for m in matches:
        old_rel = m.get("note_path")
        if old_rel:
            old_abs = os.path.join(VAULT_DIR, old_rel.replace("/", os.sep))
            if os.path.exists(old_abs):
                os.remove(old_abs)
        m["status"] = "confirmed"
        m["authorized"] = True
        _write_note(m)
    _save(data)
    for m in matches:
        print(f"[OK] Confirmed {m['id']} -> {m['note_path']}")


def cmd_search(query):
    data = _load()
    q = query.lower()
    results = []
    for m in data["memories"]:
        hay = (m.get("content", "") + " " + " ".join(m.get("tags", []) or []) + " " + m.get("session", "")).lower()
        if q in hay:
            results.append(m)
    if not results:
        print(f"No memories matching '{query}'.")
        return
    print(f"Found {len(results)} match(es) for '{query}':")
    for m in sorted(results, key=lambda x: x.get("timestamp", ""), reverse=True):
        print(f"  [{m.get('timestamp', '')[:10]}] {m.get('content', '')}")


def cmd_forget(memory_id):
    data = _load()
    before = len(data["memories"])
    remaining = []
    removed = []
    for m in data["memories"]:
        if m.get("id", "").startswith(memory_id):
            removed.append(m)
        else:
            remaining.append(m)
    if not removed:
        print(f"No memory found with id starting with '{memory_id}'.")
        return
    for m in removed:
        rel = m.get("note_path")
        if rel:
            abs_path = os.path.join(VAULT_DIR, rel.replace("/", os.sep))
            if os.path.exists(abs_path):
                os.remove(abs_path)
    data["memories"] = remaining
    _save(data)
    print(f"[OK] Removed {len(removed)} memory/memories.")


def cmd_export():
    data = _load()
    used = set()
    for m in data["memories"]:
        old_rel = m.get("note_path")
        if old_rel:
            old_abs = os.path.join(VAULT_DIR, old_rel.replace("/", os.sep))
            if os.path.exists(old_abs):
                os.remove(old_abs)
        _write_note(m)
        used.add(m["note_path"].lower())
    _save(data)
    print(f"[OK] Exported {len(data['memories'])} notes.")


def cmd_sync_legacy(args):
    legacy_path = args.legacy or LEGACY_FILE
    if not os.path.exists(legacy_path):
        print(f"Legacy memory file not found: {legacy_path}")
        return
    with open(legacy_path, "r", encoding="utf-8") as f:
        old = json.load(f)
    if os.path.exists(MEMORY_FILE):
        with open(MEMORY_FILE, "r", encoding="utf-8") as f:
            current = json.load(f)
        if current.get("memories"):
            print("Vault memory already contains entries; use export instead of sync-json.")
            return
    data = _convert_legacy(old)
    _save(data)
    print(f"[OK] Imported {len(data['memories'])} memories from legacy JSON.")


def cmd_recent(args):
    """List recently updated memories without loading the whole vault."""
    data = _load()
    rows = sorted(data["memories"], key=lambda x: x.get("timestamp", ""), reverse=True)
    if args.type:
        rows = [m for m in rows if m.get("type") == args.type]
    if args.project:
        rows = [m for m in rows if _project_for(m) == args.project or m.get("project") == args.project]
    if args.days is not None:
        try:
            cutoff = datetime.now().astimezone() - timedelta(days=int(args.days))
            filtered = []
            for m in rows:
                ts = m.get("timestamp", "")
                try:
                    dt = datetime.fromisoformat(ts)
                except ValueError:
                    continue
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=datetime.now().astimezone().tzinfo)
                if dt >= cutoff:
                    filtered.append(m)
            rows = filtered
        except ValueError:
            pass
    limit = int(args.limit) if args.limit else 40
    rows = rows[:limit]
    if not rows:
        print("No recent memories found.")
        return
    for m in rows:
        tags = m.get("tags") or []
        tag_str = f" [{', '.join(tags)}]" if tags else ""
        status = m.get("status", "pending")
        print(f"[{m.get('timestamp', '')[:10]}|{m.get('type', 'inbox')}|{status}] {m.get('content', '')}{tag_str}")


def cmd_update(args):
    data = _load()
    matches = [m for m in data["memories"] if m.get("id", "").startswith(args.id)]
    if not matches:
        print(f"No memory found with id starting with '{args.id}'.")
        return
    for m in matches:
        if args.content is not None:
            m["content"] = args.content
        if args.type is not None:
            m["type"] = args.type
        if args.tags is not None:
            m["tags"] = [t.strip() for t in args.tags.split(",") if t.strip()]
        if args.importance is not None:
            m["importance"] = args.importance
        if args.project is not None:
            m["project"] = args.project
        if args.status is not None:
            m["status"] = args.status
            if args.status == "confirmed":
                m["authorized"] = True
        if args.timestamp is not None:
            m["timestamp"] = args.timestamp
        old_rel = m.get("note_path")
        if old_rel:
            old_abs = os.path.join(VAULT_DIR, old_rel.replace("/", os.sep))
            if os.path.exists(old_abs):
                os.remove(old_abs)
        _write_note(m)
    _save(data)
    for m in matches:
        print(f"[OK] Updated {m['id']} -> {m['note_path']}")


def cmd_set_pref(key, value):
    data = _load()
    data.setdefault("preferences", {})[key] = value
    _save(data)
    print(f"[OK] Preference set: {key} = {value}")


def cmd_delete_pref(key):
    data = _load()
    if key in data.get("preferences", {}):
        del data["preferences"][key]
        _save(data)
        print(f"[OK] Preference '{key}' removed.")
    else:
        print(f"Preference '{key}' not found.")


def cmd_clear():
    for folder in TYPE_DIRS.values():
        full = os.path.join(VAULT_DIR, folder)
        if os.path.isdir(full):
            for name in os.listdir(full):
                p = os.path.join(full, name)
                if os.path.isfile(p):
                    os.remove(p)
    _save({"memories": [], "preferences": {}})
    print("[OK] All memories cleared.")


def main():
    parser = argparse.ArgumentParser(description="Codex Obsidian long-term memory manager")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("summary", help="Print compact memory summary")
    sub.add_parser("export", help="Regenerate Markdown notes from JSON")

    p_list = sub.add_parser("list", help="List memory note paths")
    p_list.add_argument("--status", choices=["pending", "confirmed"])
    p_list.add_argument("--type", choices=list(TYPE_DIRS.keys()))

    p_recent = sub.add_parser("recent", help="List recent memories without loading the whole vault")
    p_recent.add_argument("--days", type=int, default=7)
    p_recent.add_argument("--limit", type=int, default=40)
    p_recent.add_argument("--type", choices=list(TYPE_DIRS.keys()))
    p_recent.add_argument("--project", help="Project name")

    p_update = sub.add_parser("update", help="Update an existing memory by ID prefix")
    p_update.add_argument("id", help="Memory ID prefix")
    p_update.add_argument("--type", choices=["decision", "habit", "project", "conversation", "preference", "daily", "inbox"])
    p_update.add_argument("--content", help="New content")
    p_update.add_argument("--tags", help="Comma-separated tags")
    p_update.add_argument("--importance", choices=["low", "medium", "high"])
    p_update.add_argument("--project", help="Project folder name")
    p_update.add_argument("--status", choices=["pending", "confirmed"])
    p_update.add_argument("--timestamp", help="ISO timestamp override")

    p_add = sub.add_parser("add", help="Add a memory")
    p_add.add_argument("--type", choices=["decision", "habit", "project", "conversation", "preference", "daily", "inbox"], required=True)
    p_add.add_argument("--content", required=True, help="Memory content")
    p_add.add_argument("--tags", help="Comma-separated tags")
    p_add.add_argument("--importance", default="medium", choices=["low", "medium", "high"])
    p_add.add_argument("--session", default="", help="Session label")
    p_add.add_argument("--project", default="", help="Project folder name")
    p_add.add_argument("--status", default="pending", choices=["pending", "confirmed"])
    p_add.add_argument("--authorized", default="no", choices=["yes", "no"])
    p_add.add_argument("--timestamp", help="ISO timestamp override")

    p_confirm = sub.add_parser("confirm", help="Authorize and move a pending memory")
    p_confirm.add_argument("id", help="Memory ID prefix")

    p_search = sub.add_parser("search", help="Search memories")
    p_search.add_argument("query", help="Search query")

    p_forget = sub.add_parser("forget", help="Remove a memory by ID prefix")
    p_forget.add_argument("id", help="Memory ID prefix")

    p_pref = sub.add_parser("set-pref", help="Set a user preference")
    p_pref.add_argument("key", help="Preference key")
    p_pref.add_argument("value", help="Preference value")

    p_delpref = sub.add_parser("delete-pref", help="Delete a user preference")
    p_delpref.add_argument("key", help="Preference key")

    p_sync = sub.add_parser("sync-json", help="Import legacy memory.json into the vault")
    p_sync.add_argument("--legacy", help="Legacy JSON path")

    sub.add_parser("clear", help="Clear all memories")

    args = parser.parse_args()
    if args.command == "recent":
        cmd_recent(args)
    elif args.command == "update":
        cmd_update(args)
    elif args.command == "summary":
        cmd_summary()
    elif args.command == "list":
        cmd_list(args)
    elif args.command == "add":
        cmd_add(args)
    elif args.command == "confirm":
        cmd_confirm(args.id)
    elif args.command == "search":
        cmd_search(args.query)
    elif args.command == "forget":
        cmd_forget(args.id)
    elif args.command == "export":
        cmd_export()
    elif args.command == "sync-json":
        cmd_sync_legacy(args)
    elif args.command == "set-pref":
        cmd_set_pref(args.key, args.value)
    elif args.command == "delete-pref":
        cmd_delete_pref(args.key)
    elif args.command == "clear":
        cmd_clear()
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
