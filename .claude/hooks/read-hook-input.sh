#!/usr/bin/env bash
#
# Prints one field of the JSON a Claude Code hook receives on stdin.
#
# Node, not jq: Node is guaranteed in this repository, jq is not.
#
# Usage: read-hook-input.sh <field>   (field is a dotted path, e.g. tool_input.command)
set -euo pipefail

node -e '
  let raw = "";
  process.stdin.on("data", (chunk) => (raw += chunk));
  process.stdin.on("end", () => {
    let value;
    try {
      value = process.argv[1].split(".").reduce((node, key) => node?.[key], JSON.parse(raw));
    } catch {
      value = undefined;
    }
    process.stdout.write(typeof value === "string" ? value : "");
  });
' "$1"
