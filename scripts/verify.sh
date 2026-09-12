#!/usr/bin/env bash
# G-survival 検証一括実行。CLAUDE.md / AGENTS.md §6 から呼ぶ。
# 使い方: bash scripts/verify.sh
# ブラウザー検証は開発サーバー(http://127.0.0.1:5173)が起動しているときだけ実行する。

set -uo pipefail
cd "$(dirname "$0")/.."

fail=0
run() {
  echo ""
  echo "===== $1 ====="
  shift
  if "$@"; then echo "--- OK"; else echo "--- NG (exit $?)"; fail=1; fi
}

run "build (tsc --noEmit + vite build)" npm run build
run "smoke.mjs" node --experimental-strip-types smoke.mjs
run "playthrough.mjs --probe" node --experimental-strip-types playthrough.mjs --probe
run "chapter2-maze-check.mjs" node --experimental-strip-types chapter2-maze-check.mjs

echo ""
echo "===== browser-audit.mjs ====="
if curl -sf -o /dev/null --max-time 3 http://127.0.0.1:5173/; then
  if node browser-audit.mjs; then echo "--- OK"; else echo "--- NG"; fail=1; fi
  run "chapter2-audit.mjs" node chapter2-audit.mjs
  run "chapter2-difficulty-audit.mjs" node chapter2-difficulty-audit.mjs
  run "chapter2-route-audit.mjs" node chapter2-route-audit.mjs
  run "nymph-audit.mjs (GLB integration)" node nymph-audit.mjs
else
  echo "--- SKIP: 開発サーバーが未起動。別ターミナルで 'npm run dev' を実行してから再度流すこと。"
  echo "    (SKIP は合格ではない。map.md には SKIP と記録する)"
fi

echo ""
if [ "$fail" -eq 0 ]; then
  echo "自動検証: すべて成功 (SKIP を除く)"
else
  echo "自動検証: 失敗あり。上の NG を確認する"
fi
echo "注意: 恐怖感・初見の分かりやすさ・実プレイ所要時間・実スピーカー音量は、この検証では判定できない。"
exit "$fail"
