#!/usr/bin/env python3
"""Conversation memory management for Codex.

Storage: JSON file at <skill_dir>/memory.json
Each memory entry records a key takeaway, decision, or fact from a conversation.
"""

import json
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta

# UTC+8 for Ulaanbaatar / China time
TZ = timezone(timedelta(hours=8))
MEMORY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "memory.json")


def _load():
    if not os.path.exists(MEMORY_FILE):
        return {"memories": [], "preferences": {}}
    with open(MEMORY_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def _save(data):
    os.makedirs(os.path.dirname(MEMORY_FILE), exist_ok=True)
    with open(MEMORY_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def cmd_read():
    """Output all memories as JSON."""
    data = _load()
    print(json.dumps(data, ensure_ascii=False, indent=2))


def cmd_summary():
    """Print a compact summary of all memories, newest first."""
    data = _load()
    memories = sorted(data["memories"], key=lambda m: m["timestamp"], reverse=True)
    if not memories:
        print("No memories stored yet.")
        return

    prefs = data.get("preferences", {})
    if prefs:
        print("=== PREFERENCES ===")
        for k, v in prefs.items():
            print(f"  {k}: {v}")
        print()

    print(f"=== MEMORIES ({len(memories)} total) ===")
    for m in memories:
        tag_str = f" [{', '.join(m.get('tags', []))}]" if m.get("tags") else ""
        imp = m.get("importance", "medium")
        print(f"[{imp.upper()}] {m['timestamp'][:10]} | {m['content']}{tag_str}")


def cmd_add(content, tags=None, importance="medium", session=""):
    """Add a new memory entry."""
    data = _load()
    entry = {
        "id": uuid.uuid4().hex[:12],
        "timestamp": datetime.now(TZ).isoformat(),
        "content": content,
        "tags": tags or [],
        "importance": importance,
        "session": session,
    }
    data["memories"].append(entry)
    _save(data)
    print(f"[OK] Memory added: {entry['id']} - {content[:60]}...")


def cmd_search(query):
    """Search memories by content or tags (case-insensitive)."""
    data = _load()
    q = query.lower()
    results = []
    for m in data["memories"]:
        if q in m["content"].lower() or any(q in t.lower() for t in m.get("tags", [])):
            results.append(m)
    if not results:
        print(f"No memories matching '{query}'.")
        return
    print(f"Found {len(results)} match(es) for '{query}':")
    for m in sorted(results, key=lambda x: x["timestamp"], reverse=True):
        print(f"  [{m['timestamp'][:10]}] {m['content']}")


def cmd_forget(memory_id):
    """Remove a memory by ID prefix."""
    data = _load()
    before = len(data["memories"])
    data["memories"] = [m for m in data["memories"] if not m["id"].startswith(memory_id)]
    removed = before - len(data["memories"])
    if removed == 0:
        print(f"No memory found with id starting with '{memory_id}'.")
    else:
        _save(data)
        print(f"[OK] Removed {removed} memory/memories.")


def cmd_clear():
    """Clear all memories."""
    _save({"memories": [], "preferences": {}})
    print("[OK] All memories cleared.")


def cmd_set_pref(key, value):
    """Set a user preference."""
    data = _load()
    if "preferences" not in data:
        data["preferences"] = {}
    data["preferences"][key] = value
    _save(data)
    print(f"[OK] Preference set: {key} = {value}")


def cmd_delete_pref(key):
    """Delete a user preference."""
    data = _load()
    if key in data.get("preferences", {}):
        del data["preferences"][key]
        _save(data)
        print(f"[OK] Preference '{key}' removed.")
    else:
        print(f"Preference '{key}' not found.")


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Conversation Memory Manager")
    sub = parser.add_subparsers(dest="command")

    sub.add_parser("read", help="Read all memories as JSON")
    sub.add_parser("summary", help="Print compact memory summary")

    p_add = sub.add_parser("add", help="Add a memory")
    p_add.add_argument("--content", required=True, help="Memory content")
    p_add.add_argument("--tags", help="Comma-separated tags")
    p_add.add_argument("--importance", default="medium", choices=["low", "medium", "high"])
    p_add.add_argument("--session", default="", help="Session label")

    p_search = sub.add_parser("search", help="Search memories")
    p_search.add_argument("query", help="Search query")

    p_forget = sub.add_parser("forget", help="Remove a memory")
    p_forget.add_argument("id", help="Memory ID prefix")

    sub.add_parser("clear", help="Clear all memories")

    p_pref = sub.add_parser("set-pref", help="Set a user preference")
    p_pref.add_argument("key", help="Preference key")
    p_pref.add_argument("value", help="Preference value")

    p_delpref = sub.add_parser("delete-pref", help="Delete a user preference")
    p_delpref.add_argument("key", help="Preference key")

    args = parser.parse_args()
    if args.command == "read":
        cmd_read()
    elif args.command == "summary":
        cmd_summary()
    elif args.command == "add":
        tags = [t.strip() for t in args.tags.split(",")] if args.tags else []
        cmd_add(args.content, tags, args.importance, args.session)
    elif args.command == "search":
        cmd_search(args.query)
    elif args.command == "forget":
        cmd_forget(args.id)
    elif args.command == "clear":
        cmd_clear()
    elif args.command == "set-pref":
        cmd_set_pref(args.key, args.value)
    elif args.command == "delete-pref":
        cmd_delete_pref(args.key)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
