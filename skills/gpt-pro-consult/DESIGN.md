# gpt-pro-consult — 설계 문서

작성일: 2026-06-17

## 목적

작업 중 에이전트(Claude Code)가 **명시적 지시를 받았을 때**, 브라우저로 ChatGPT(Pro 계정 로그인 상태)에 접속해 **GPT-5.5 Pro 모델**에게 전략적/난해한 문제를 자문하고, 완료될 때까지 기다린 뒤 응답 전문을 로컬에 회수해 에이전트가 이어서 작업할 수 있게 한다.

GPT-5.5 Pro는 API/Codex로 쓸 수 없고 웹 ChatGPT에서만 접근 가능하다는 제약을 브라우저 자동화로 우회한다.

## 확정된 결정 (브레인스토밍 결과)

| 항목 | 결정 |
|---|---|
| 자동화 수준 | **완전 자동 + 전용 Chrome 프로필** (headful) |
| 발동 방식 | **① 명시 호출(항상)** + **② 자율 호출(작업 유형별 문턱)** — 리서치/큰 방향 설정엔 **후하게(선제적 방향검증 OK)**, 일반 코드 작업엔 **보수적(높은 문턱)**. 자율 호출은 /goal·/loop 등 오래 도는 작업 한정. 정책은 SKILL.md "언제 쓰나" 참조. *(최초 명시 전용 → 2026-06-17 자율 호출 추가 → 같은 날 리서치/방향 작업은 후하게로 세분화)* |
| 대화 연속성 | **일회성** — 호출마다 새 ChatGPT 대화, 프롬프트 1회 → 응답 1회 |
| 구현 언어 | **Node + Playwright** (이미 1.61.0 설치됨) |
| 하드 타임아웃 | **25분** (env로 조정 가능) |
| 전송 게이트 | **없음** — 바로 전송 (자율 호출 시엔 출력에 이유 한 줄만 남기고 승인 대기 안 함) |
| 설치 위치 | `~/.claude/skills/gpt-pro-consult/` |

## 아키텍처

세 구성요소:

```
~/.claude/skills/gpt-pro-consult/
├── SKILL.md            # 에이전트용: 언제(명시+보수적 자율)/어떻게 호출하는지
├── consult.mjs         # 엔진: Playwright 브라우저 자동화
├── selectors.mjs       # ChatGPT DOM 셀렉터 모음 (UI 변경 시 여기만 수정)
├── package.json        # playwright 의존성 명시 (전역 설치 활용)
├── .chrome-profile/    # 전용 user-data-dir, 로그인 쿠키 영속 (.gitignore)
└── DESIGN.md           # 이 문서
```

결과 저장 위치 (스킬 폴더 밖, 호출별 1폴더):

```
~/.claude/gpt-pro-consults/<타임스탬프>-<슬러그>/
├── prompt.md           # 보낸 프롬프트
├── response.md         # GPT-5.5 Pro 응답 전문 (마크다운)
└── meta.json           # {model, started, finished, durationSec, timedOut, url}
```

## 호출 계약 (인터페이스)

에이전트가 다른 작업 도중 Bash로 호출:

```bash
node ~/.claude/skills/gpt-pro-consult/consult.mjs \
  --prompt-file /tmp/consult-q.md \
  [--model "GPT-5.5 Pro"] \
  [--timeout 1500]
# 또는 --prompt "짧은 질문 문자열"
```

- 성공 시 **stdout 마지막 줄에 결과 폴더의 `response.md` 절대경로**를 출력 → 에이전트가 그 경로를 Read.
- 진행 로그는 stderr로.
- 실패/타임아웃 시 비-0 종료코드 + stderr에 사유. 타임아웃이어도 부분 응답은 저장.

긴 코드/맥락을 담아야 하므로 `--prompt-file` 사용을 기본으로 한다(에이전트가 자기완결적 프롬프트를 파일로 작성).

## 실행 흐름 (consult.mjs)

1. **인자 파싱** — prompt 확보, model/timeout 기본값 적용.
2. **전용 프로필로 Chrome 기동** — `chromium.launchPersistentContext('.chrome-profile', { headless: false, channel: 'chrome' })`. headless 금지(봇탐지 회피).
3. **로그인 체크** — `chatgpt.com` 접속 후 로그인 상태 판정(컴포저 입력창 존재 여부). 미로그인 시: 창을 띄운 채 stderr로 *"이 창에서 ChatGPT에 로그인하세요"* 안내, 컴포저가 나타날 때까지 폴링 대기(최대 5분). 최초 1회만 발생.
4. **새 대화 + 모델 선택** — 새 채팅으로 이동, 모델 피커를 열어 대상 모델 클릭. **전송 전, 현재 선택된 모델 라벨이 대상과 일치하는지 검증.** 불일치 시 즉시 중단·에러(엉뚱한 모델 자문 사고 방지).
5. **프롬프트 주입 + 전송** — 컴포저에 입력(사람처럼 약간의 타이핑 딜레이), 전송.
6. **완료 감지** (핵심):
   - 1단계: 정지(stop) 버튼이 나타날 때까지 대기 = 생성 시작 (Pro는 thinking이 길 수 있음).
   - 2단계: 정지 버튼이 사라지고 + 마지막 어시스턴트 메시지 텍스트 길이가 ~10초간 불변 = 완료.
   - 하드 타임아웃(기본 1500초) 도달 시: 그때까지의 내용 저장 + `timedOut:true`.
7. **응답 추출** — 마지막 어시스턴트 메시지의 **Copy 버튼 클릭 → 클립보드(`navigator.clipboard.readText`) 읽기**로 마크다운 원본 회수(코드블록/서식 보존). 실패 시 메시지 컨테이너 innerText 폴백.
8. **저장 + 출력** — 결과 폴더에 prompt.md/response.md/meta.json 기록, response.md 경로를 stdout 마지막 줄로 출력.
9. **정리** — 컨텍스트 close.

## 핵심 리스크와 완화

- **셀렉터 취약성** (ChatGPT UI 변경): 모든 DOM 셀렉터를 `selectors.mjs` 한 곳에 모음. 깨지면 거기만 수정. SKILL.md에 "셀렉터 갱신 절차" 명시.
- **봇탐지/계정 위험**: headful + 실제 프로필 쿠키라 위험 낮음(0 아님). 타이핑/클릭에 소폭 딜레이. headless 절대 금지.
- **모델 오선택**: 전송 전 선택 모델 검증 게이트로 방지.
- **무한 대기**: 하드 타임아웃 + thinking 단계 인지형 완료감지.
- **클립보드 권한**: launchPersistentContext에 `clipboard-read` 권한 부여.

## 테스트 / 검증 전략

자동화된 단위테스트는 외부 서비스 의존이라 비현실적. 대신:
1. **드라이런**: 짧은 프롬프트("Reply with the single word: PONG")로 end-to-end 1회 → response.md에 PONG 확인.
2. **모델 검증**: meta.json의 model 필드가 대상과 일치하는지 확인.
3. **타임아웃 경로**: timeout을 아주 짧게(예: 30초) 줘서 부분저장+timedOut 동작 확인.
4. SKILL.md에 위 수동 검증 절차를 기록.

## 범위 밖 (YAGNI)

- 스레드 유지/후속 질문 (일회성으로 결정).
- 자동 발동 (명시 호출 전용으로 결정).
- 파일 첨부 업로드 (텍스트 프롬프트로 충분; 코드는 프롬프트에 인라인).
- 다중 동시 호출.
