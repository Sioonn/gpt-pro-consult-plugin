---
name: gpt-pro-consult
description: Consult GPT-5.5 Pro (web ChatGPT, an expert in our domain) for hard strategic/architectural problems. Drives a dedicated logged-in Chrome profile to send a prompt to GPT-5.5 at Pro effort, waits for completion, returns the full answer to disk. Triggers — (1) the user EXPLICITLY asks (e.g. "GPT Pro에 자문 구해", "ChatGPT Pro한테 물어봐"); (2) AUTONOMOUSLY during long-running autonomous work (e.g. /goal, /loop, multi-step plans), with a threshold that depends on the work type: for RESEARCH or setting BIG STRATEGIC DIRECTION (research scoping, choosing an approach/methodology, architecture big-picture, key trade-offs) consult GENEROUSLY and even proactively to validate direction — wrong direction is costly; for ROUTINE CODE/implementation work be CONSERVATIVE — only when genuinely blocked after ≥2 serious attempts or on a high-stakes hard-to-reverse decision, and after cheaper options (re-reading code, web search, deeper reasoning, a subagent) are exhausted. EXPENSIVE (opens a browser, consumes a Pro query, takes minutes): do NOT use for routine bugs, simple lookups, or minor decisions, and never repeat the identical question.
---

# GPT-5.5 Pro 자문 (브라우저 자동화)

GPT-5.5 Pro는 API/Codex로 못 쓰고 웹 ChatGPT에서만 된다. 이 스킬은 **사용자가 명시적으로 시켰을 때만**, 전용 Chrome 프로필(ChatGPT Pro 로그인 상태)을 띄워 GPT-5.5 + 강도 Pro로 프롬프트를 보내고, **완료까지 기다린 뒤** 응답 전문을 로컬에 저장한다. 일회성(매번 새 대화).

## 언제 쓰나 (중요)

이 자문은 **비싸다** — 브라우저를 띄우고, Pro 쿼리를 1회 소모하고, 수 분이 걸린다. 그래서 두 경우에만 쓴다.

### 1) 명시 호출 (항상 허용)
- 사용자가 "GPT Pro에 자문", "ChatGPT Pro한테 물어봐", "GPT-5.5 Pro에게 전략 물어봐" 등 **명시적으로 지시**하면 바로 쓴다.

### 2) 자율 호출 — 작업 유형에 따라 문턱이 다름
`/goal`·`/loop`·다단계 계획처럼 **오래 도는 자율 작업** 중, 사용자에게 매번 물을 수 없을 때 에이전트가 알아서 부를 수 있다. 문턱은 **작업의 성격**에 따라 다르게 잡는다.

**A. 리서치 / 큰 방향 설정 → 후하게 불러도 됨**
방향이 틀리면 비용이 큰 **중대한 의사결정**이라, 막히지 않았더라도 **방향 검증·대안 비교·맹점 점검용**으로 적극 자문해도 된다. 해당:
- 리서치 과제의 설계·범위·핵심 질문 잡기, 자료 해석의 큰 틀.
- 전략/아키텍처의 **큰 그림**, 여러 접근법·방법론 중 택1, 핵심 트레이드오프 결정.
- "이 방향이 맞나?"를 초반에 점검해 헛수고를 막아야 할 때.
→ 이런 국면에선 **선제적으로** 자문해 방향을 잡는 게 권장된다(중요한 작업이니까).

**B. 일반 코드 / 구현 작업 → 보수적으로 (높은 문턱)**
아래를 **전부** 만족할 때만:
- [ ] **진짜 막혔다**: 서로 다른 접근을 **2회 이상 진지하게** 시도했는데 안 됨, **또는** 되돌리기 어렵고/비용 큰 **고위험 결정**에서 확신이 안 섬.
- [ ] **더 싼 수단을 이미 소진**: 코드/문서 재독, 웹 검색, 더 깊은 자체 추론, 서브에이전트로도 안 됨.
- [ ] **전문가 조언이 경로를 실제로 바꿀** 만한 사안이다.

**공통:** 자문 직전 **출력에 한 줄로 이유를 밝히고**(예: "리서치 방향 검증 위해 GPT-5.5 Pro 자문" / "X 2회 시도 실패 → 전략 자문") 진행한다. 자율 작업이므로 **승인 대기는 하지 않는다**.

### ❌ 부르지 말 것 (유형 불문)
- 일상적 버그·단순 조회·사소한 결정 → 직접 해결.
- 코드만 읽거나 검색하면 바로 풀릴 일.
- **완전히 동일한 질문**을 이미 자문했음(똑같은 건 반복 금지 — 단 리서치/방향 작업에서 *다른* 하위 질문은 OK).
- 짧은 대화형 턴(사용자가 바로 옆에 있을 땐 자문 대신 사용자에게 물어라).

## 프롬프트 작성 (정교하게 — 가장 중요)

GPT-5.5 Pro는 **우리 분야의 전문가**다. 동시에 우리 레포·터미널·대화 맥락엔 **접근이 전혀 없다**(서브에이전트보다 더 깜깜하다). 그러니 **워크플로우/서브에이전트에 작업을 넘길 때 쓰는 그 구체성 그대로**, 자기완결적인 브리프로 써야 한다. 막연한 질문엔 막연한 답만 온다.

정교한 프롬프트에 담을 것:
1. **맥락(Context)** — 무엇을 만들고 있고, 기술 스택/제약/목표는 무엇인지. **관련 코드·에러·로그·설계를 인라인으로** (Pro는 파일을 못 연다).
2. **문제(Problem)** — 정확히 무엇이 막혔거나 무엇을 결정해야 하는지. 증상과 (추정)원인을 구분.
3. **이미 시도/고려한 것** — 무엇을 해봤고 왜 안 됐는지 → 뻔하거나 중복된 조언 차단.
4. **묻는 것(Ask)** — 구체적으로. 예: "방법론 A vs B의 트레이드오프", "이 상황에서 어떤 전략을 골라야 하나", "이 설계의 결함과 더 나은 대안". 가능하면 **평가 기준**(성능/유지보수성/구현비용 등 우선순위)을 제시.
5. **원하는 출력 형식** — 예: 추천 1개 + 근거, 단계별 계획, 비교표, 위험요소 목록.

```text
[맥락] Node 백엔드, 초당 5천 요청, Postgres 단일 인스턴스. 목표: p99 지연 <100ms.
       현재 핫패스 코드: <인라인>
[문제] 특정 쿼리에서 p99가 400ms로 튐. 인덱스는 있는데 가끔 seq scan으로 빠짐.
[시도] 통계 ANALYZE 갱신, 인덱스 힌트 시도 → 부분 개선뿐.
[질문] 이 워크로드에서 (a) 읽기 복제본 분리 (b) 파티셔닝 (c) 캐시 계층 중
       무엇을 우선해야 하나? 각 방법의 트레이드오프와 권장 순서를 근거와 함께.
[형식] 추천 1순위 + 이유, 그다음 대안들, 각 도입 위험요소.
```

이 정도로 정교하게 만든 뒤 `--prompt-file`로 넘긴다.

## 사용법

> **경로 주의(중요):** `S`는 **이 스킬의 base 디렉터리**다 — 스킬이 로드될 때 *"Base directory for this skill:"*로 표시되는 그 경로. 개인 스킬이면 `~/.claude/skills/gpt-pro-consult`지만, **플러그인으로 설치되면 플러그인 캐시 경로**다. 하드코딩하지 말고 항상 그 표시된 base 경로를 `S`로 쓸 것.

프롬프트는 위 가이드대로 자기완결적으로(필요한 코드·맥락 인라인 포함) 작성해 파일로 넘긴다.

```bash
S="<이 스킬의 base 디렉터리>"   # 로드 시 표시된 경로
# (최초 1회) 의존성 설치
[ -d "$S/node_modules" ] || (cd "$S" && npm install)

# 자문 실행 — 프롬프트를 파일로
node "$S/consult.mjs" --prompt-file /tmp/consult-q.md
# 또는 짧으면
node "$S/consult.mjs" --prompt "한 줄 질문"
```

옵션: `--timeout <초>`(기본 1500=25분), `--model <부분일치>`(기본 `5.5`), `--debug`(메뉴 항목 덤프), `--keep-open`(끝나도 창 유지).

### 출력 회수

- **stdout 마지막 줄 = `response.md` 절대경로.** 그 경로를 Read해서 조언을 읽고 이어서 작업한다.
- 진행 로그는 stderr.
- 종료코드: `0` 정상 / `3` 타임아웃(부분 응답 저장됨) / `1`·`2` 실패.
- 저장 구조: `~/.claude/gpt-pro-consults/<타임스탬프>-<슬러그>/` 에 `prompt.md`, `response.md`, `meta.json`(+실패 시 `error.png`).

호출 예(에이전트 관점):
```bash
cat > /tmp/consult-q.md <<'EOF'
다음 설계의 동시성 전략을 평가해줘. ...(코드/맥락 인라인)...
EOF
RESP=$(node "$S/consult.mjs" --prompt-file /tmp/consult-q.md | tail -1)
# 이후 $RESP 를 Read 툴로 열어 조언 반영
```

## 동작 메커니즘

1. 전용 프로필(`~/.claude/gpt-pro-consult-profile`, 스킬 폴더 밖)로 **headful** Chrome 기동(봇탐지 회피, headless 금지).
2. 로그인 체크 — 미로그인 시 창을 띄운 채 *"이 창에서 로그인하세요"* 안내 후 최대 5분 대기(최초 1회).
3. 새 대화 → 강도 피커에서 **Pro 선택 + 검증**(피커 버튼이 "Pro"인지 확인, 아니면 중단). 베이스 모델 GPT-5.5는 best-effort 확인(경고만).
4. 프롬프트 주입(여러 줄 보존 위해 Enter 아닌 전송버튼 클릭) → 전송.
5. 완료 감지: 중지버튼 등장=시작 → 중지버튼 소멸 + 답변 텍스트 10초 불변=완료. 하드 타임아웃 25분.
6. 응답 회수: 마지막 답변의 **복사버튼→클립보드**(마크다운 원문), 실패 시 innerText 폴백.

## 검증 절차 (배포/수리 후)

```bash
S="<이 스킬의 base 디렉터리>"   # 로드 시 표시된 경로
# 1) end-to-end 스모크: 짧은 프롬프트
node "$S/consult.mjs" --prompt "Reply with exactly one word: PONG"
#   → response.md 에 PONG, meta.json model 에 effort=Pro 확인
# 2) 타임아웃 경로
node "$S/consult.mjs" --prompt "long question" --timeout 30
#   → 종료코드 3, meta.json timedOut:true, 부분응답 저장 확인
```

## 🔧 자가 수리 플레이북 (UI 변경/고장 시 — 에이전트가 스스로 고칠 것)

이 스킬은 ChatGPT 웹 UI에 의존한다. UI가 바뀌면 깨질 수 있다. **고장 나면 사용자에게 떠넘기지 말고, 아래 절차로 에이전트(Claude Code/Codex 등)가 직접 고친다.**

### 핵심 원칙: 최소 수정
- **`selectors.mjs`만** 고치는 것을 기본으로 한다. `consult.mjs`의 제어 흐름·완료감지·저장 로직은 건드리지 않는다.
- 기존 셀렉터 후보는 **지우지 말고 남긴다**(폴백). 새로 찾은 셀렉터를 **후보 배열 맨 앞에 추가**한다.
- role이 바뀐 경우에만(예: `menuitemradio`→다른 값) `consult.mjs`의 `getByRole(...)` **그 한 줄의 role 인자만** 바꾼다.
- 추측 금지. 반드시 `inspect.mjs` 실측 덤프를 근거로 고친다.

### 1단계 — 어디가 깨졌는지 특정
실패 실행의 **stderr 마지막 성공 로그 + 에러 메시지**, 그리고 결과 폴더의 **`error.png`**를 본다. 단계 → 고칠 곳 매핑:

| 증상(로그/에러) | 고칠 대상 |
|---|---|
| `로그인 확인 실패` (이미 로그인했는데도) | `SEL.composer`, `SEL.loginWall` |
| `강도 피커 버튼을 찾지 못함` | `findEffortPicker` (가정: `button[aria-haspopup="menu"]` + 텍스트=강도라벨), `EFFORT_LABELS` |
| `강도 메뉴에서 "Pro" 항목을 찾지 못함` / `강도 검증 실패` | 메뉴 항목 role(`consult.mjs`의 `getByRole('menuitemradio',...)`), `EFFORT_TARGET` |
| `컴포저를 찾지 못함` | `SEL.composer` |
| 전송이 안 됨(응답 없음) | `SEL.sendButton` |
| `생성 시작 감지 못함` / 항상 타임아웃 | `SEL.stopButton`, `SEL.assistantTurn` |
| 응답이 잘리거나 빔(코드블록만 등) | `SEL.copyTurnButton`(코드블록 복사버튼 혼동), 길이가드 |

### 2단계 — 실측 확보
```bash
node "$S/inspect.mjs"   # $S = 이 스킬의 base 디렉터리(로드 시 표시됨)
```
→ 로그인 대기 후 **컴포저 후보 / 모든 버튼(testid·aria·haspopup) / 강도 피커 / 강도 메뉴 항목**을 `inspect-out/`(JSON+스크린샷)에 덤프. 이 실측값으로 실제 `data-testid`/`role`/`aria-label`/`class`를 확인한다.
- 답변측(전송·중지·복사버튼)은 자문을 1회 돌린 뒤 그 답변 화면에서, 또는 `consult.mjs --keep-open --debug --prompt "test"`로 창을 띄운 채 확인한다.

### 3단계 — `selectors.mjs` 최소 수정
덤프에서 확인한 실제 셀렉터를 해당 항목 후보 배열 **맨 앞에 추가**(기존은 폴백 유지).

### 4단계 — 검증 (필수)
```bash
node "$S/consult.mjs" --prompt "Reply with exactly one word: PONG"
```
→ `response.md`에 `PONG`, `meta.json`에 `effort=Pro`, **종료코드 0**이면 수리 완료. 안 되면 1~3단계 반복.

### 잘 안 바뀌는 안정 앵커 (참고, 2026-06-17 실측)
- 답변: `[data-message-author-role="assistant"]` (가장 안정적)
- 컴포저: `div#prompt-textarea[contenteditable="true"]` (같은 name의 숨은 `<textarea>` fallback에 주의 — 그걸 잡으면 안 됨)
- 강도 피커: `button[aria-haspopup="menu"]` 중 텍스트가 현재 강도("Pro" 등)
- 강도 항목: `role="menuitemradio"` (즉시/중간/높음/매우 높음/Pro), 베이스 모델: `role="menuitem"` "GPT-5.5"
- 턴 복사: `[data-testid="copy-turn-action-button"]` (코드블록 복사와 구분)

## 배포 & 최초 설치

- **배포 대상: macOS / Windows / Linux(서버, 헤드리스 가능).** Chrome 경로는 `resolveChrome()`가 OS별로 처리. 특이 설치면 `CHROME_PATH` env로 override. Linux 서버는 아래 "Linux 서버(헤드리스)" 섹션 참조.
- 배포에 포함: `SKILL.md`, `consult.mjs`, `selectors.mjs`, `inspect.mjs`, `package.json`, `package-lock.json`. (`.mjs`도 전부 함께 배포됨)
- **로그인 프로필은 스킬 폴더 밖**(`~/.claude/gpt-pro-consult-profile`)에 저장됨 — 배포물(스킬 폴더)에 쿠키가 **애초에 포함되지 않음**. 플러그인 업데이트에도 로그인 유지.
- 받는 쪽 최초 1회:
  1. 의존성 설치 — `cd <스킬폴더> && npm install` (playwright-core 받음). Node 18+ 필요.
  2. Google Chrome 설치돼 있어야 함. ChatGPT **Pro 계정** 필요(강도 Pro용).
  3. 첫 자문 실행 시 Chrome 창이 뜨면 거기서 ChatGPT 로그인(이후 쿠키 영속).

## Linux 서버(헤드리스)에서 쓰기 (Ubuntu/Debian)

이 스킬은 headful Chrome을 쓰므로 화면이 필요하다. 헤드리스 서버에선 **Xvfb(가상 디스플레이)**로 돌리고, **최초 로그인만 `ssh -X`/VNC로 진짜 화면**에 띄워 한다.

```bash
# 1) Google Chrome (Linux) 설치
wget -q https://dl.google.com/linux/direct/google-chrome-stable_current_amd64.deb
sudo apt install -y ./google-chrome-stable_current_amd64.deb
# 2) Xvfb 설치
sudo apt install -y xvfb
# 3) Node 18+ 확인 (없으면 nvm/apt로 설치)
node -v
```

**최초 1회 로그인 (진짜 화면 필요):**
```bash
# 로컬에서 X 포워딩으로 접속 (mac 클라이언트는 XQuartz 필요, Linux는 기본)
ssh -X user@server
# 서버에서 — xvfb 말고 포워딩된 디스플레이로 실행 → Chrome 창이 로컬에 뜸
node "$S/consult.mjs" --prompt "Reply with: PONG"   # 그 창에서 ChatGPT(Pro) 로그인
# 로그인되면 쿠키가 ~/.claude/gpt-pro-consult-profile 에 영속됨
```
(VNC를 써도 됨 — Xvfb+x11vnc로 한 번 보고 로그인.)

**이후 무인 실행 (Xvfb):**
```bash
bash "$S/consult-headless.sh" --prompt-file /tmp/q.md   # xvfb-run으로 헤드리스 자동 실행
```

- Linux에선 `resolveChrome()`가 `/usr/bin/google-chrome-stable` 등을 자동 탐색(특수 경로면 `CHROME_PATH`).
- Linux 서버는 샌드박스 기동 실패가 흔해 **기본적으로 샌드박스 해제**(`USE_SANDBOX=false`). 강제하려면 `GPT_CONSULT_SANDBOX=1`.
- 봇탐지: 학술망(대학 IP)·소량·단독 ChatGPT 웹 사용이면 위험 낮음. 단 웹 UI 자동화는 OpenAI 약관 위반이라 계정 제재 가능성이 **구조적으로 0은 아님**(IP 무관).

## 주의

- 전용 프로필(`~/.claude/gpt-pro-consult-profile`) 쿠키로 동작 — 그 프로필에 ChatGPT Pro가 로그인돼 있어야 함(스킬 폴더 밖이라 배포물엔 미포함).
- `node_modules/`는 `.gitignore` 처리됨(받는 쪽이 `npm install`).
- 동시 다중 호출 비지원(같은 프로필 동시 사용 금지).
