#!/bin/sh
# 영상에 쓰는 장면을 차례로 모두 찍는다 (저장소 맨 위에서, http.server 8765가 떠 있을 때)
export NODE_PATH=$(npm root -g)
cd "$(dirname "$0")/.."
node promo/avatars.js
for s in drive beacons basic; do ONLY=$s timeout 900 node promo/capture.js; done
ONLY=map timeout 900 node promo/capture.js
ls promo/cap | sed 's/-[0-9]*\.\(jpg\|png\)//' | sort | uniq -c | tr '\n' ' '
