#!/usr/bin/env python3
"""Smoke-test a local Windows-MCP stdio server.

Spawns the `windows-mcp serve` stdio transport, performs the MCP initialize
handshake, then requests tools/list and prints the tool names. Exits non-zero
when the handshake fails or an expected tool is missing.

Usage:
    python scripts/verify_server.py [--exe PATH] [--timeout SECONDS]
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
import threading
import time

DEFAULT_EXE = os.path.join(os.path.expanduser("~"), ".local", "bin", "windows-mcp.exe")

# ControlStatus only exists on the Git main branch, which is exactly why the
# deploy step installs from source instead of PyPI.
EXPECTED_TOOLS = {
    "ControlStatus",
    "App",
    "PowerShell",
    "FileSystem",
    "Screenshot",
    "Snapshot",
    "DisplayInventory",
    "Click",
    "Type",
    "Scroll",
    "Move",
    "Shortcut",
    "Wait",
    "WaitFor",
    "Scrape",
    "MultiSelect",
    "MultiEdit",
    "Clipboard",
    "Process",
    "Notification",
    "Registry",
}


def _pump(stream, sink: list) -> None:
    for line in stream:
        sink.append(line.rstrip("\n"))


def _stderr_tail(stderr_lines: list, count: int = 20) -> str:
    return "".join(stderr_lines[-count:]).strip()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--exe", default=DEFAULT_EXE, help="Path to windows-mcp.exe")
    parser.add_argument("--timeout", type=float, default=90.0, help="Handshake timeout in seconds")
    args = parser.parse_args()

    if not os.path.isfile(args.exe):
        print(f"error: server executable not found: {args.exe}", file=sys.stderr)
        return 2

    env = os.environ.copy()
    env.setdefault("ANONYMIZED_TELEMETRY", "false")

    proc = subprocess.Popen(
        [args.exe, "serve"],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        encoding="utf-8",
        bufsize=1,
        env=env,
    )

    stdout_lines: list = []
    stderr_lines: list = []
    threading.Thread(target=_pump, args=(proc.stdout, stdout_lines), daemon=True).start()
    threading.Thread(target=_pump, args=(proc.stderr, stderr_lines), daemon=True).start()

    def send(payload: dict) -> None:
        proc.stdin.write(json.dumps(payload) + "\n")
        proc.stdin.flush()

    def wait_for_id(target_id: int):
        deadline = time.time() + args.timeout
        while time.time() < deadline:
            for line in list(stdout_lines):
                try:
                    message = json.loads(line)
                except ValueError:
                    continue
                if message.get("id") == target_id:
                    return message
            time.sleep(0.2)
        return None

    try:
        send(
            {
                "jsonrpc": "2.0",
                "id": 1,
                "method": "initialize",
                "params": {
                    "protocolVersion": "2025-06-18",
                    "capabilities": {},
                    "clientInfo": {"name": "windows-mcp-verify", "version": "1.0"},
                },
            }
        )
        init = wait_for_id(1)
        if init is None:
            print("error: no response to initialize", file=sys.stderr)
            detail = _stderr_tail(stderr_lines)
            if detail:
                print(detail, file=sys.stderr)
            return 1

        send({"jsonrpc": "2.0", "method": "notifications/initialized"})
        send({"jsonrpc": "2.0", "id": 2, "method": "tools/list", "params": {}})
        listing = wait_for_id(2)
        if listing is None:
            print("error: no response to tools/list", file=sys.stderr)
            detail = _stderr_tail(stderr_lines)
            if detail:
                print(detail, file=sys.stderr)
            return 1

        names = [tool["name"] for tool in listing.get("result", {}).get("tools", [])]
        server_info = init.get("result", {}).get("serverInfo", {})
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()

    print(f"initialize ok: {server_info}")
    print(f"tool count: {len(names)}")
    print("tools: " + ", ".join(names))

    missing = EXPECTED_TOOLS - set(names)
    if missing:
        print(f"error: missing expected tools: {sorted(missing)}", file=sys.stderr)
        return 1

    print("OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
