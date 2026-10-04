#!/bin/bash
# ============================================================
# 部署前数据回捞：把线上沙箱的运行时数据拉回本地目录，
# 使下一次部署（本地上传覆盖沙箱）能带上最新数据，避免后台数据"被重置"。
# 用法：bash scripts/sync-online-data.sh [线上地址]
# 每次部署前执行一次即可。
# ============================================================
set -e
SITE="${1:-https://tuoquan-ai.app.workbuddy.host}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
mkdir -p "$ROOT/data" "$ROOT/uploads"

pull_json () { # $1=api路径 $2=输出文件 $3=json提取表达式(python)
  curl -sf -X POST "$SITE/api/$1" -H 'Content-Type: application/json' -d '{}' \
    | python3 -c "import sys,json;d=json.load(sys.stdin);open('$2','w').write(json.dumps($3,ensure_ascii=False,indent=2))" \
    && echo "  ✓ $1 → $2"
}

echo "[1/3] 回捞收款配置与订单台账..."
pull_json "pay/info"      "$ROOT/data/payinfo.json"   "d.get('payInfo',{})"
pull_json "pay/order/list" "$ROOT/data/payorders.json" "d.get('orders',[])[:200]"

echo "[2/3] 回捞 uploads 图片（收款码/企业微信码等）..."
FILES=$(curl -sf -X POST "$SITE/api/uploads/list" -H 'Content-Type: application/json' -d '{}' | python3 -c "import sys,json
try: print(' '.join(json.load(sys.stdin).get('files',[])))
except Exception: print('')" 2>/dev/null || true)
if [ -z "$FILES" ]; then
  echo "  ⚠ 线上暂无 /api/uploads/list 接口（部署 v=144 后可用），跳过图片回捞"
fi
n=0
for f in $FILES; do
  curl -sf "$SITE/uploads/$f" -o "$ROOT/uploads/$f" && n=$((n+1))
done
[ "$n" -gt 0 ] && echo "  ✓ 已回捞 $n 张图片"

echo "[3/3] 完成。本地目录已带上最新运行时数据，可执行部署。"
