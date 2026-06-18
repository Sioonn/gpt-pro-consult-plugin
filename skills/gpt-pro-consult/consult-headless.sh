#!/usr/bin/env bash
# 헤드리스 Linux 서버용 래퍼 — 가상 디스플레이(Xvfb) 위에서 consult.mjs 실행.
#
# ⚠ 최초 로그인엔 쓰지 말 것: Xvfb는 보이지 않으므로 로그인 클릭을 할 수 없다.
#    1회 로그인은 `ssh -X`(X11 포워딩) 또는 VNC로 진짜 화면을 띄워서 먼저 해둔다:
#        ssh -X user@server
#        node "$(dirname "$0")/consult.mjs" --prompt "Reply with: PONG"   # 창이 로컬에 떠 → 로그인
#    로그인 후 쿠키는 ~/.claude/gpt-pro-consult-profile 에 영속되므로,
#    그 다음부턴 이 래퍼로 무인 실행하면 된다:
#        bash consult-headless.sh --prompt-file /tmp/q.md
#
# 필요: xvfb (sudo apt install -y xvfb), Google Chrome(Linux), Node 18+.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v xvfb-run >/dev/null 2>&1; then
  echo "xvfb-run 없음 → 설치: sudo apt install -y xvfb" >&2
  exit 127
fi

# -a: 빈 디스플레이 번호 자동 선택. 화면 크기는 봇탐지 회피용으로 일반 해상도.
exec xvfb-run -a --server-args="-screen 0 1280x900x24" node "$DIR/consult.mjs" "$@"
