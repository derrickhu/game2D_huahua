#!/bin/bash
# 项目 stop 钩子入口。Cursor 的钩子环境不一定加载 nvm，这里把本机 Node 补进 PATH。
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT" || exit 0

NODE_BIN=""
if [ -d "$HOME/.nvm/versions/node" ]; then
  NODE_BIN="$(ls -d "$HOME"/.nvm/versions/node/*/bin 2>/dev/null | tail -1)"
fi
if [ -n "$NODE_BIN" ]; then
  export PATH="$NODE_BIN:/opt/homebrew/bin:/usr/local/bin:$PATH"
fi

if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' '{}'
  exit 0
fi

exec node "$ROOT/.cursor/hooks/pack-wechat-douyin.mjs"
